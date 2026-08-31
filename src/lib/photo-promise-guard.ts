/**
 * PHOTO-PROMISE GUARD (root cause of two real defects).
 *
 * 1. The agent used to write "هبعتلك الصورة" / "تحب أشوفك صورة؟" in a turn
 *    where no image was ever attached — a promise the pipeline could not keep,
 *    because attachments only ever leave WITH the same reply.
 * 2. When images WERE attached, the same sentence still appeared, so the agent
 *    announced an action the customer could already see, turn after turn.
 *
 * Both cases are the same textual fact: the reply talks about the ACT of
 * sending / showing a photo. This module detects that sentence deterministically
 * and removes it, without touching anything else in the reply.
 */

/** Phrases whose meaning is "I am going to send / show you a photo". */
const PHOTO_WORD = /(صور[ةه]?|صور|photo|picture|image)/i;

const SEND_INTENT =
  /(هبعت|ابعت|أبعت|هبعتها|هبعتهال|بعتلك|هوريك|أوريك|اوريك|هعرضل|جاري\s+(?:الإرسال|ارسال|إرسال)|هترسل|أرسل|ارسل|إرسال|ارسال|send|sending|attach|shar(?:e|ing))/i;

const ASK_PERMISSION =
  /(تحب|عايز|عاوز|حابب|تريد|هل\s+تحب|do you want|would you like|want me to)/i;

/** Split on sentence-ish boundaries while keeping the separators out. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟\n])\s*/)
    .map((s) => s)
    .filter((s) => s.length > 0);
}

/** True when this single sentence speaks about sending/showing a photo. */
export function sentencePromisesPhoto(sentence: string): boolean {
  if (!PHOTO_WORD.test(sentence)) return false;
  return SEND_INTENT.test(sentence) || ASK_PERMISSION.test(sentence);
}

/** True when any sentence of the reply speaks about sending/showing a photo. */
export function replyPromisesPhoto(text: string | null | undefined): boolean {
  if (!text) return false;
  return splitSentences(text).some(sentencePromisesPhoto);
}

/**
 * Removes only the sentences that talk about sending/showing a photo.
 * Everything else in the reply survives byte-for-byte.
 */
export function stripPhotoPromise(text: string | null | undefined): string {
  if (!text) return "";
  const kept = splitSentences(text).filter((s) => !sentencePromisesPhoto(s));
  return kept
    .map((s) => s.trimEnd())
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
