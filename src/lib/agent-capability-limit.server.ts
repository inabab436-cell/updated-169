/**
 * AGENT CAPABILITY LIMIT (server-only).
 *
 * A narrow, single case: the customer asked the agent to DO something that the
 * agent technically cannot do, so no genuine reply could be produced at all.
 *
 * In that case the customer must not see any sentence (a handover line means
 * nothing to them), the conversation is closed automatically and the merchant
 * is notified so a human can pick it up.
 *
 * This is NOT the human-handover path (`request_handoff` / `needs_human`),
 * which keeps its own behaviour untouched.
 */

export async function reportCapabilityLimit(
  supabase: any,
  conversationId: string,
  lastCustomerMessage?: string | null,
): Promise<void> {
  const excerpt = String(lastCustomerMessage ?? "").trim().slice(0, 180);
  try {
    await supabase
      .from("conversations")
      .update({ status: "closed", agent_enabled: false })
      .eq("id", conversationId);
  } catch {
    /* non-fatal */
  }
  try {
    await supabase.from("notifications").insert({
      type: "human_needed",
      conversation_id: conversationId,
      message: excerpt
        ? `طلب العميل شيئًا لا يستطيع الوكيل تنفيذه تقنيًا — تم إغلاق المحادثة دون رد. آخر رسالة: «${excerpt}»`
        : "طلب العميل شيئًا لا يستطيع الوكيل تنفيذه تقنيًا — تم إغلاق المحادثة دون رد.",
      is_read: false,
      priority: 1,
    });
  } catch {
    /* non-fatal */
  }
}
