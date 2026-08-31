/**
 * SEMANTIC GOVERNORATE RESOLUTION (server-only)
 * =============================================
 *
 * `detectGovernorate` in `order-input-validation.ts` is a deterministic
 * lookup over a fixed list of governorate names plus a handful of very common
 * city aliases. That list can never contain every city, village, district or
 * compound in Egypt, so a perfectly complete address such as
 * "العريش، شارع فلسطين" or "أبو كبير، شارع المحطة" was reported back to the
 * agent as "المحافظة ناقصة". The agent then asked for the governorate again,
 * the customer answered with the same place name, and the loop never ended.
 *
 * This helper closes that gap by MEANING, not by adding more keywords: when
 * the deterministic detector finds nothing, one small model pass reads the
 * address text and answers a single question — which Egyptian governorate
 * does this address belong to, if it can be established at all?
 *
 * It never invents: when the address genuinely does not identify any place
 * (only a street number, or a bare "مصر"), it returns null and the normal
 * "ask the customer" path continues.
 */

import { EGYPT_GOVERNORATES, detectGovernorate } from "@/lib/order-input-validation";
import { safeSlice } from "@/lib/safe-slice";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

/** Canonical governorate spellings the rest of the system matches against. */
const CANONICAL = Array.from(new Set(EGYPT_GOVERNORATES));

export interface ResolvedGovernorate {
  /** A canonical Egyptian governorate name, or null when it is truly absent. */
  governorate: string | null;
}

function canonicalize(value: string): string | null {
  const direct = detectGovernorate(value);
  if (direct) return direct;
  return null;
}

/**
 * Resolve the governorate an address belongs to.
 *
 * Order of resolution:
 *   1. deterministic detection (free, instant),
 *   2. one semantic pass over the address text (any city/village/district),
 *   3. null — the address really does not say where it is.
 */
export async function resolveAddressGovernorate(
  apiKey: string | null | undefined,
  addressText: string,
  extraContext: Array<string | null | undefined> = [],
): Promise<ResolvedGovernorate> {
  const text = String(addressText ?? "").trim();
  if (!text) return { governorate: null };

  const deterministic = detectGovernorate(text);
  if (deterministic) return { governorate: deterministic };

  if (!apiKey) return { governorate: null };

  const context = safeSlice((extraContext ?? []).filter(Boolean).join("\n"), 0, 1200);

  const prompt =
    "You are given a delivery address written in Egyptian Arabic (or a mix of Arabic and English).\n" +
    "Task: decide which Egyptian governorate this address belongs to.\n" +
    "The address may name a city, village, district, neighbourhood, compound, markaz or landmark instead of the governorate itself. Use your geographic knowledge of Egypt to map it to its governorate.\n" +
    "Rules:\n" +
    "- Answer with EXACTLY one governorate name taken from this list, spelled exactly as written here:\n" +
    CANONICAL.map((g) => `  ${g}`).join("\n") +
    "\n- If the text does not identify any real Egyptian place (for example it is only a street number, only a person's name, or just \"مصر\"), answer with the single word: NONE\n" +
    "- Never guess a governorate just because it is common. Only answer when the named place really belongs to it.\n" +
    "- Output the governorate name or NONE only. No explanation, no punctuation.\n\n" +
    `ADDRESS:\n${safeSlice(text, 0, 800)}\n` +
    (context ? `\nOTHER THINGS THE CUSTOMER SAID (context only):\n${context}\n` : "");

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { governorate: null };
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return { governorate: null };
    const answer = raw.trim();
    if (!answer || /^none$/i.test(answer)) return { governorate: null };
    return { governorate: canonicalize(answer) };
  } catch {
    return { governorate: null };
  }
}
