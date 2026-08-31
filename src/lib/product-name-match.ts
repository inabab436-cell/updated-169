/**
 * WHICH SAVED PRODUCT IS THIS TEXT TALKING ABOUT?
 *
 * The photo path used to decide this with a raw substring test
 * (`message.includes(product.name)`). That failed on ordinary Arabic writing:
 * a customer typing "عايزهودي" for a product saved as "هودي مضلع" produced no
 * match, so no photo left with the reply while the agent's own sentence
 * ("ده شكله وسعره ...") assumed one had.
 *
 * Matching is therefore done on WORDS, not on one long string: a product is
 * the subject when the text contains its distinctive name word(s), with the
 * usual Arabic spelling variations normalised away.
 */

export interface NameMatchProduct {
  id: string;
  name?: string | null;
}

/** Same normalisation used elsewhere: strip diacritics and unify letters. */
export function normalizeProductText(input: unknown): string {
  return String(input ?? "")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

const STOP_WORDS = new Set(["ال", "من", "في", "على", "the", "a", "of"]);

function nameTokens(name: unknown): string[] {
  return normalizeProductText(name)
    .split(" ")
    .map((t) => t.replace(/^ال(?=.{3,})/, ""))
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/** True when `text` names this product (all-words match, or its longest word). */
export function textNamesProduct(text: unknown, name: unknown): boolean {
  const tokens = nameTokens(name);
  if (tokens.length === 0) return false;
  const hay = ` ${normalizeProductText(text)} `;
  const has = (t: string) => hay.includes(t);
  if (tokens.every(has)) return true;
  // A single distinctive word is enough ("هودي" for "هودي مضلع").
  const longest = tokens.slice().sort((a, b) => b.length - a.length)[0];
  return longest.length >= 4 && has(longest);
}

/**
 * The showable product named by any of the given texts (the customer's
 * message, and/or the agent's own draft reply). Prefers the most specific
 * name match so "هودي مضلع" wins over "هودي".
 */
export function findNamedProduct<T extends NameMatchProduct>(
  texts: Array<unknown>,
  products: readonly T[],
  isEligible: (product: T) => boolean = () => true,
): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const product of products ?? []) {
    if (!isEligible(product)) continue;
    if (!texts.some((t) => textNamesProduct(t, product.name))) continue;
    const score = normalizeProductText(product.name).length;
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }
  return best;
}
