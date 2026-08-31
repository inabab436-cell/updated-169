import { describe, it, expect } from "vitest";
import {
  computeOfferUpsells,
  unitsToReachMinimum,
  buildOfferUpsellBlock,
  buildOrderPricingFactsBlock,
} from "@/lib/offer-upsell";

const hoodie = { id: "p1", name: "هودي", price: 500 };

const offer = (over: any = {}) =>
  ({
    id: "o1",
    user_id: "u1",
    title: "عرض الهودي",
    scope: "product",
    product_id: "p1",
    discount_type: "percent",
    discount_value: 10,
    min_order_total: 1000,
    is_active: true,
    starts_at: null,
    ends_at: null,
    ...over,
  }) as any;

describe("offer near-miss facts", () => {
  it("computes the quantity that unlocks the offer and the real saving", () => {
    const [u] = computeOfferUpsells([offer()], [hoodie]);
    expect(u.units_for_minimum).toBe(2);
    expect(u.subtotal_at_units).toBe(1000);
    expect(u.discount_at_units).toBe(100);
    expect(u.total_at_units).toBe(900);
  });

  it("ignores offers that a single piece already qualifies for", () => {
    expect(computeOfferUpsells([offer({ min_order_total: 300 })], [hoodie])).toHaveLength(0);
  });

  it("tells the agent it may never stay silent, nor push", () => {
    const block = buildOfferUpsellBlock(computeOfferUpsells([offer()], [hoodie]), "جنيه");
    expect(block).toContain("ممنوع تسكت عن العرض");
    expect(block).toContain("بدون أي إلحاح");
    expect(block).toContain("2 قطعة");
  });

  it("counts only the same product toward the minimum", () => {
    expect(unitsToReachMinimum(500, 500)).toBe(1);
    expect(unitsToReachMinimum(0, 500)).toBe(0);
  });
});

describe("current order pricing facts", () => {
  it("pins the discounted total so it cannot be forgotten later", () => {
    const block = buildOrderPricingFactsBlock({
      currency: "جنيه",
      subtotal: 1000,
      discount_total: 100,
      total: 900,
      applied_offers: [{ title: "عرض الهودي", discount_amount: 100 }],
    });
    expect(block).toContain("900");
    expect(block).toContain("ممنوع منعًا باتًا ترجع تقول السعر الكامل");
  });

  it("forbids claiming a discount when none applies", () => {
    const block = buildOrderPricingFactsBlock({
      currency: null,
      subtotal: 500,
      discount_total: 0,
      total: 500,
      applied_offers: [],
    });
    expect(block).toContain("ممنوع تقول إن فيه خصم");
  });
});
