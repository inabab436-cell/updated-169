/**
 * DETERMINISTIC GUARD — the agent must never invite the customer to consider
 * alternatives that do not exist.
 *
 * The <available_alternatives> block already tells the model what may be
 * proposed this turn, but a prompt rule is advice, not a guarantee: with a
 * single (or sold-out) product in the catalogue the model still produced
 * "تحب تشوف موديلات تانية؟". That question is a failed reply — the customer
 * says yes and there is nothing behind it.
 *
 * This module removes such sentences from a finished reply whenever the
 * corresponding MAY_OFFER_* fact is false. Pure: no network, no database.
 */

export interface OfferPermissions {
  canOfferOtherModels: boolean;
  canOfferOtherColors: boolean;
  canOfferOtherSizes: boolean;
  /** At least one product in the catalogue has real stock right now. */
  hasAnythingInStock?: boolean;
}

/** "another / other / different" in Egyptian Arabic + English. */
const OTHER = /(تاني|تانيه|تانية|تانيين|أخرى|اخرى|أخر|اخر|غيره|غيرها|مختلف|other|another|different)/i;

const MODEL_WORDS = /(موديل|موديلات|منتج|منتجات|حاج[ةه]|قطع|قطعة|تصميم|تصاميم|شكل|أشكال|اشكال|item|product|model)/i;
const COLOR_WORDS = /(لون|ألوان|الوان|colou?r)/i;
const SIZE_WORDS = /(مقاس|مقاسات|size)/i;

/** Wording that puts an option on the table for the customer. */
const OFFERING =
  /(تحب|حابب|عايز تشوف|عاوز تشوف|ممكن أوريك|ممكن اوريك|أوريك|اوريك|أعرضلك|اعرضلك|أرشحلك|ارشحلك|نجربل?ك|عندنا|فيه|في عندنا|would you like|want to see|we have)/i;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!؟?\n])/)
    .map((s) => s)
    .filter((s) => s.length > 0);
}

/** "let me show you what we have / the collection / what's available". */
const SHOW_AVAILABLE =
  /(المتاح|المتوفر|الموجود|اللي عندنا|الكوليكشن|الكتالوج|المعروض|what we have|available|collection)/i;

function isForbiddenOffer(sentence: string, perms: OfferPermissions): boolean {
  // Nothing at all is in stock: any invitation to browse/see what exists is
  // an empty promise, even without the word "another".
  if (perms.hasAnythingInStock === false && OFFERING.test(sentence) && SHOW_AVAILABLE.test(sentence))
    return true;
  if (!OTHER.test(sentence)) return false;
  if (!OFFERING.test(sentence)) return false;
  if (!perms.canOfferOtherModels && MODEL_WORDS.test(sentence)) return true;
  if (!perms.canOfferOtherColors && COLOR_WORDS.test(sentence)) return true;
  if (!perms.canOfferOtherSizes && SIZE_WORDS.test(sentence)) return true;
  return false;
}

/**
 * Remove every sentence that offers an alternative the store cannot actually
 * provide right now. Returns the cleaned reply (may be empty when the whole
 * reply was such an offer — the caller then regenerates).
 */
export function stripUnavailableOffers(reply: string, perms: OfferPermissions): string {
  const raw = String(reply ?? "");
  if (!raw.trim()) return "";
  const kept = splitSentences(raw).filter((s) => !isForbiddenOffer(s, perms));
  return kept.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * The customer must never be told that the request is being escalated,
 * reviewed, confirmed with someone, or answered later: those are internal
 * events. When the agent cannot do something, it says plainly what is true —
 * or (when nothing true is left to say) the conversation is closed silently
 * and the merchant is notified.
 */
const ESCALATION =
  /(هنرجعل?ك|هرجعل?ك|نرجعل?ك|هنرد علي?ك|هرد علي?ك|هنبلغ|هبلغ|هنتواصل|هتواصل|هحول|هحولك|بنأكد|بنتأكد|هنأكد|هنتأكد|هنراجع|هراجع|هنشوف الموضوع|المسؤول|الإدارة|الاداره|الادارة|خدمة العملاء|فريق|get back to you|check with|forward (this|it)|our team|management)/i;

const SOONISH = /(قريب|حال[اً]|بعدين|أول ما|اول ما|لاحق|later|soon|shortly)/i;

export function stripEscalationPromises(reply: string): string {
  const raw = String(reply ?? "");
  if (!raw.trim()) return "";
  const kept = splitSentences(raw).filter(
    (s) => !(ESCALATION.test(s) && (SOONISH.test(s) || /هنرجع|هرجع|هحول|المسؤول|فريق|الإدار|الادار/i.test(s))),
  );
  return kept.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
