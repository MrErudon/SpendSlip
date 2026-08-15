import { describe, expect, it } from "vitest";
import { normalizeMerchant } from "./normalize";

describe("normalizeMerchant", () => {
  it("normalizes Square POS descriptions", () => {
    expect(normalizeMerchant("SQ *JOES COFFEE 48392")).toBe("Joes Coffee");
  });

  it("normalizes Toast POS descriptions", () => {
    expect(normalizeMerchant("TST*THE LOCAL BAR")).toBe("The Local Bar");
  });

  it("normalizes Amazon marketplace descriptions", () => {
    expect(normalizeMerchant("AMZN Mktp US*X7A394")).toBe("Amazon");
    expect(normalizeMerchant("AMAZON.COM*A1B2C3")).toBe("Amazon");
  });

  it("normalizes Walmart store-number descriptions", () => {
    expect(normalizeMerchant("WAL-MART #4832")).toBe("Walmart");
  });

  it("recognizes known merchants regardless of case", () => {
    expect(normalizeMerchant("starbucks store 1234")).toBe("Starbucks");
  });

  it("leaves the raw description untouched (pure function)", () => {
    const raw = "SQ *JOES COFFEE 48392";
    normalizeMerchant(raw);
    expect(raw).toBe("SQ *JOES COFFEE 48392");
  });
});
