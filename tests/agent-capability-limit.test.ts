/**
 * Technically-impossible request: the customer sees NO sentence, the
 * conversation is closed automatically and the merchant is notified.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { reportCapabilityLimit } from "@/lib/agent-capability-limit.server";

function fakeSupabase() {
  const calls: any = { updates: [], inserts: [] };
  const supabase = {
    from(table: string) {
      return {
        update(values: any) {
          return {
            eq(col: string, val: string) {
              calls.updates.push({ table, values, col, val });
              return Promise.resolve({ error: null });
            },
          };
        },
        insert(row: any) {
          calls.inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { supabase, calls };
}

const source = readFileSync(
  fileURLToPath(new URL("../src/routes/api/chat-ai.ts", import.meta.url)),
  "utf8",
);

describe("agent capability limit", () => {
  it("closes the conversation and disables the agent on it", async () => {
    const { supabase, calls } = fakeSupabase();
    await reportCapabilityLimit(supabase, "conv-1", "اعملي خصم 90% دلوقتي");
    expect(calls.updates[0]).toMatchObject({
      table: "conversations",
      values: { status: "closed", agent_enabled: false },
      col: "id",
      val: "conv-1",
    });
  });

  it("notifies the merchant with the customer's last message", async () => {
    const { supabase, calls } = fakeSupabase();
    await reportCapabilityLimit(supabase, "conv-1", "اعملي خصم 90% دلوقتي");
    const n = calls.inserts.find((i: any) => i.table === "notifications");
    expect(n.row.type).toBe("human_needed");
    expect(n.row.conversation_id).toBe("conv-1");
    expect(n.row.message).toContain("اعملي خصم 90% دلوقتي");
    expect(n.row.is_read).toBe(false);
  });

  it("never throws when the database rejects the writes", async () => {
    const broken: any = {
      from() {
        throw new Error("db down");
      },
    };
    await expect(reportCapabilityLimit(broken, "conv-1", "x")).resolves.toBeUndefined();
  });

  it("sends no sentence to the customer in the blocked path", () => {
    expect(source).toMatch(
      /if \(capabilityBlocked && !reply\.trim\(\)\)[\s\S]{0,600}reportCapabilityLimit\(/,
    );
    expect(source).toMatch(
      /reportCapabilityLimit\([\s\S]{0,400}return respond\(\{[\s\S]{0,200}reply: "",/,
    );
  });

  it("does not fall back to the stored filler sentence anymore", () => {
    expect(source).not.toContain("تحت أمرك يا فندم، قولّي إيه اللي محتاجه");
    expect(source).toContain("regenerateCustomerReply");
  });
});
