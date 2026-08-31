import { describe, expect, it } from "vitest";
import { findNamedProduct, textNamesProduct } from "@/lib/product-name-match";

const products = [
  { id: "p1", name: "هودي مضلع" },
  { id: "p2", name: "قميص كتان" },
];

describe("product naming without substring luck", () => {
  it("matches a glued word (عايزهودي -> هودي مضلع)", () => {
    expect(findNamedProduct(["عايزهودي"], products)?.id).toBe("p1");
  });

  it("matches the agent's own draft reply", () => {
    expect(findNamedProduct(["انا نجوي", "الهودي المضلع موجود"], products)?.id).toBe("p1");
  });

  it("does not match unrelated text", () => {
    expect(findNamedProduct(["عايز بنطلون"], products)).toBeNull();
    expect(textNamesProduct("سلام", "هودي مضلع")).toBe(false);
  });

  it("prefers the more specific product name", () => {
    const specific = [{ id: "a", name: "هودي" }, { id: "b", name: "هودي مضلع" }];
    expect(findNamedProduct(["عايز هودي مضلع"], specific)?.id).toBe("b");
  });

  it("respects the eligibility filter (sold-out products)", () => {
    expect(findNamedProduct(["عايزهودي"], products, (p) => p.id !== "p1")).toBeNull();
  });
});
