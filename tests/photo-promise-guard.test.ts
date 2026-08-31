import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { replyPromisesPhoto, stripPhotoPromise } from "@/lib/photo-promise-guard";

const source = readFileSync("src/routes/api/chat-ai.ts", "utf8");

describe("photo promise guard", () => {
  it("detects a promise to send a photo", () => {
    expect(replyPromisesPhoto("تمام يا فندم، هبعتلك صورة الهودي حالاً.")).toBe(true);
    expect(replyPromisesPhoto("تحب أبعتلك الصورة؟")).toBe(true);
    expect(replyPromisesPhoto("I'll send you a picture in a moment.")).toBe(true);
  });

  it("does not flag an ordinary sales reply", () => {
    expect(replyPromisesPhoto("الهودي البيج متوفر مقاس L بـ 500 جنيه.")).toBe(false);
    expect(replyPromisesPhoto("")).toBe(false);
  });

  it("removes only the photo sentence and keeps the rest", () => {
    const raw = "الهودي البيج متوفر مقاس L. هبعتلك الصورة حالاً. السعر 500 جنيه.";
    expect(stripPhotoPromise(raw)).toBe("الهودي البيج متوفر مقاس L. السعر 500 جنيه.");
  });

  it("returns empty when the whole reply was the promise", () => {
    expect(stripPhotoPromise("تحب أبعتلك صورته؟")).toBe("");
  });
});

describe("chat pipeline wiring", () => {
  it("uses the guard instead of a canned caption under photos", () => {
    expect(source).toContain("replyPromisesPhoto");
    expect(source).toContain("stripPhotoPromise");
    expect(source).not.toContain("اتفضل يا فندم الصور");
  });
});
