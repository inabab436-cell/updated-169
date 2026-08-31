import { describe, it, expect } from "vitest";
import { mapOfferRow, buildOffersBlock } from "@/lib/offers.server";

const offer = (over: Record<string, unknown> = {}) =>
  mapOfferRow({
    id: "o1",
    title: "عرض الشراب",
    scope: "product",
    product_id: "p1",
    discount_type: "percent",
    discount_value: 20,
    starts_at: new Date(Date.now() - 3600_000).toISOString(),
    is_active: true,
    ...over,
  });

const names = new Map([["p1", "شراب"]]);

describe("offer timing guidance", () => {
  const block = buildOffersBlock({ live: [offer()], past: [] }, names, "جنيه");

  it("tells the agent when to bring the offer up", () => {
    expect(block).toContain("وقت الكلام عن العرض");
    expect(block).toContain("قبل تأكيد الأوردر");
  });

  it("forbids inventing details or spamming them every message", () => {
    expect(block).toContain("ممنوع تزود أي شرط");
    expect(block).toContain("ممنوع تكرر تفاصيل العرض كلها في كل رسالة");
  });

  it("states the real usage frequency", () => {
    expect(block).toContain("على كل طلب للعميل");
    const once = buildOffersBlock(
      { live: [offer({ usage_limit_type: "once_per_customer" })], past: [] },
      names,
      "جنيه",
    );
    expect(once).toContain("مرة واحدة لكل عميل");
  });

  it("says nothing about offers when none is live", () => {
    const none = buildOffersBlock({ live: [], past: [] }, names, "جنيه");
    expect(none).toContain("لا يوجد أي عرض");
    expect(none).not.toContain("وقت الكلام عن العرض");
  });
});
