/**
 * OFFER UPSELL / NEAR-MISS FACTS — deterministic.
 *
 * Two real failures this module fixes:
 *
 * 1. A live offer on a 500 product with a 1000 minimum, customer asks for ONE
 *    piece. The agent stayed silent about the offer, because nothing in the
 *    context told it that the offer is one piece away. The reachable quantity
 *    and the exact saving are now computed in code and handed to the agent as
 *    a fact it MUST state once (as an option, never as pressure).
 *
 * 2. The agent quoted a discounted total and later, at confirmation, repeated
 *    the full price from memory. The current order is now priced in code every
 *    turn, and the official numbers are pinned in the snapshot, so the agent
 *    has no memory-based total to fall back on.
 *
 * Pure: no network, no database.
 */
import type { OfferRow } from "@/lib/offers.server";

export interface UpsellProduct {
  id: string;
  name: string | null;
  price: number | null;
}

export interface OfferUpsell {
  offer_id: string;
  title: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  min_order_total: number;
  /** Smallest quantity of THIS product that reaches the offer minimum. */
  units_for_minimum: number;
  subtotal_at_units: number;
  discount_at_units: number;
  total_at_units: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function discountFor(offer: OfferRow, subtotal: number): number {
  const v = Number(offer.discount_value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const raw = offer.discount_type === "percent" ? (subtotal * v) / 100 : v;
  return round2(Math.min(Math.max(raw, 0), subtotal));
}

/**
 * For every product-scoped live offer whose minimum is above one unit price,
 * the quantity that unlocks it and what the customer would actually pay.
 */
export function computeOfferUpsells(
  offers: OfferRow[],
  products: UpsellProduct[],
): OfferUpsell[] {
  const out: OfferUpsell[] = [];
  for (const o of offers ?? []) {
    if (o.scope !== "product" || !o.product_id) continue;
    const min = o.min_order_total == null ? 0 : Number(o.min_order_total);
    if (!(min > 0)) continue;
    const p = products.find((x) => String(x.id) === String(o.product_id));
    const unit = Number(p?.price ?? 0);
    if (!p || !Number.isFinite(unit) || unit <= 0) continue;
    if (unit >= min) continue; // one piece already qualifies — nothing to unlock
    const units = Math.ceil(min / unit);
    const subtotal = round2(unit * units);
    const discount = discountFor(o, subtotal);
    out.push({
      offer_id: o.id,
      title: o.title || "عرض",
      product_id: String(o.product_id),
      product_name: String(p.name ?? "").trim() || "المنتج",
      unit_price: unit,
      min_order_total: min,
      units_for_minimum: units,
      subtotal_at_units: subtotal,
      discount_at_units: discount,
      total_at_units: round2(subtotal - discount),
    });
  }
  return out;
}

/** Extra units of the SAME eligible product needed to reach the minimum. */
export function unitsToReachMinimum(unitPrice: number, shortfall: number): number {
  const u = Number(unitPrice);
  const s = Number(shortfall);
  if (!Number.isFinite(u) || u <= 0 || !Number.isFinite(s) || s <= 0) return 0;
  return Math.ceil(s / u);
}

/** The mandatory near-miss facts appended to the offers block. */
export function buildOfferUpsellBlock(
  upsells: OfferUpsell[],
  currency: string | null,
): string {
  if (!upsells.length) return "";
  const cur = currency ? ` ${currency}` : "";
  const lines = upsells.map(
    (u) =>
      `- «${u.title}» على ${u.product_name}: سعر القطعة ${u.unit_price}${cur}، الحد الأدنى ${u.min_order_total}${cur} على قيمة نفس المنتج وحده.` +
      ` أقل كمية توصل للحد الأدنى: ${u.units_for_minimum} قطعة = ${u.subtotal_at_units}${cur}، الخصم ${u.discount_at_units}${cur}، المدفوع ${u.total_at_units}${cur}.` +
      ` قطعة واحدة (${u.unit_price}${cur}) لا تستحق الخصم.`,
  );
  return (
    "\n\nOFFER NEAR-MISS FACTS (محسوبة في الكود — أرقام نهائية ممنوع تعدّلها):\n" +
    lines.join("\n") +
    "\nإلزامي: لو العميل بيسأل أو بيطلب منتج من دول بكمية أقل من الكمية المذكورة، ممنوع تسكت عن العرض." +
    " قول له الحقيقة في جملة واحدة قصيرة: فيه عرض على المنتج ده بالحد الأدنى الفلاني، وطلبه الحالي أقل منه، ولو خد الكمية دي هيكون الخصم كذا والمدفوع كذا." +
    " اعرضها كاختيار مرة واحدة فقط بدون أي إلحاح أو ضغط أو تكرار، ولو رفض كمّل طلبه الأصلي عادي بالسعر الكامل من غير ما تفتح الموضوع تاني." +
    " ممنوع تقترح إضافة منتجات تانية للوصول للحد الأدنى — الحد الأدنى على نفس المنتج وحده.\n"
  );
}

export interface OrderPricingFacts {
  currency: string | null;
  subtotal: number;
  discount_total: number;
  total: number;
  applied_offers: Array<{ title: string; discount_amount: number }>;
}

/**
 * The official price of the order currently on the table. Pinned every turn so
 * a discount that was already granted can never be forgotten at confirmation.
 */
export function buildOrderPricingFactsBlock(facts: OrderPricingFacts | null): string {
  if (!facts) return "";
  const cur = facts.currency ? ` ${facts.currency}` : "";
  const applied = facts.applied_offers.length
    ? facts.applied_offers
        .map((o) => `«${o.title}» بخصم ${o.discount_amount}${cur}`)
        .join(" + ")
    : "لا يوجد خصم مطبّق";
  return (
    "\n\nCURRENT ORDER PRICING (محسوب في الكود دلوقتي — هو الرقم الرسمي الوحيد):\n" +
    `- إجمالي المنتجات قبل الخصم: ${facts.subtotal}${cur}\n` +
    `- الخصم المطبّق: ${facts.discount_total}${cur} (${applied})\n` +
    `- المطلوب دفعه على المنتجات: ${facts.total}${cur}\n` +
    "إلزامي: أي مبلغ تقوله للعميل عن الأوردر ده يكون الرقم ده بالظبط." +
    (facts.discount_total > 0
      ? " الخصم ده متسجّل فعليًا على الأوردر — ممنوع منعًا باتًا ترجع تقول السعر الكامل أو تنسى الخصم في أي رسالة بعد كده، خصوصًا عند تأكيد الأوردر."
      : " ممنوع تقول إن فيه خصم مطبّق على الأوردر ده.") +
    " (الشحن يتحسب فوق ده لو مذكور في مكان تاني.)\n"
  );
}
