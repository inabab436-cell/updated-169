/**
 * LAST-RESORT REPLY REGENERATION (server-only).
 *
 * The route used to fall back to one hard-coded sentence whenever the draft
 * reply came back empty (model produced nothing, or every layer of the egress
 * scrubbers removed the whole text). That canned line is what customers saw
 * whenever anything went wrong internally, and it reads like a recording.
 *
 * Instead of a stored sentence, the model is asked once more to answer the
 * customer from the SAME conversation context, with a short instruction that
 * forbids stalling phrasing. Fail-closed to an empty string: the caller then
 * decides (hand over to a human) rather than emitting a canned line.
 */

const MODEL = "google/gemini-2.5-flash";

const INSTRUCTION = [
  "SYSTEM: your previous draft could not be sent. Write the reply to the customer's LAST message now,",
  "directly and from the real conversation context above: answer what they asked, state plainly what is",
  "true about the store/stock/order, and take the next concrete step.",
  "Never write a generic stalling line such as asking them to repeat what they need, and never mention",
  "any internal problem, system, tool or error. Same dialect, short, natural, human.",
].join(" ");

export async function regenerateCustomerReply(
  apiKey: string | null | undefined,
  messages: Array<Record<string, unknown>>,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!apiKey || !Array.isArray(messages) || messages.length === 0) return "";
  try {
    const res = await fetchImpl("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [...messages, { role: "system", content: INSTRUCTION }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return "";
    const json: any = await res.json();
    return String(json?.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}
