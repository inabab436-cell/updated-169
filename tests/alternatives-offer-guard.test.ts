import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { stripUnavailableOffers } from "@/lib/alternatives-offer-guard";

const none = {
  canOfferOtherModels: false,
  canOfferOtherColors: false,
  canOfferOtherSizes: false,
};

describe("alternatives offer guard", () => {
  it("removes an offer of other models when none exist", () => {
    const out = stripUnavailableOffers(
      "تمام يا فندم، مفيش مشكلة. تحب أوريك موديلات تانية؟",
      none,
    );
    expect(out).toBe("تمام يا فندم، مفيش مشكلة.");
  });

  it("removes offers of other colours and sizes when none exist", () => {
    expect(stripUnavailableOffers("عندنا ألوان تانية كمان.", none)).toBe("");
    expect(stripUnavailableOffers("تحب تشوف مقاسات تانية؟", none)).toBe("");
    expect(stripUnavailableOffers("تحب تشوف حاجة تانية؟", none)).toBe("");
  });

  it("keeps offers that are actually available", () => {
    const text = "تحب أوريك موديلات تانية؟";
    expect(
      stripUnavailableOffers(text, {
        canOfferOtherModels: true,
        canOfferOtherColors: false,
        canOfferOtherSizes: false,
      }),
    ).toBe(text);
  });

  it("keeps normal factual sentences", () => {
    const text = "الهودي المضلع خلص حاليًا يا فندم.";
    expect(stripUnavailableOffers(text, none)).toBe(text);
  });

  it("is wired into the chat egress chokepoint", () => {
    const src = readFileSync("src/routes/api/chat-ai.ts", "utf8");
    expect(src).toContain("stripUnavailableOffers");
    expect(src).toContain("computeSuggestableOptions");
  });
});

import { stripEscalationPromises } from "@/lib/alternatives-offer-guard";

describe("empty-catalogue offers and escalation promises", () => {
  it("removes an invitation to browse when nothing is in stock", () => {
    expect(
      stripUnavailableOffers("ممكن أوريك المتاح حالياً؟", { ...none, hasAnythingInStock: false }),
    ).toBe("");
  });

  it("keeps it when something is in stock", () => {
    const t = "ممكن أوريك المتاح حالياً؟";
    expect(stripUnavailableOffers(t, { ...none, hasAnythingInStock: true })).toBe(t);
  });

  it("removes hand-over and follow-up promises", () => {
    expect(
      stripEscalationPromises("إحنا بنأكد الموضوع ده وهنرجع لحضرتك قريب."),
    ).toBe("");
    expect(stripEscalationPromises("هحولك للمسؤول.")).toBe("");
  });

  it("keeps plain factual sentences", () => {
    const t = "أنا ماقدرش أغير سعر المنتج، الأسعار ثابتة.";
    expect(stripEscalationPromises(t)).toBe(t);
  });

  it("is wired into the chat egress chokepoint", () => {
    const src = readFileSync("src/routes/api/chat-ai.ts", "utf8");
    expect(src).toContain("stripEscalationPromises");
    expect(src).toContain("hasAnythingInStock");
  });
});
