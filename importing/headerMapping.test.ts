import { describe, expect, it } from "vitest";
import { detectHeaderMapping, normalizeHeader } from "./headerMapping";

describe("header mapping", () => {
  it("recognizes canonical and aliased headers despite case and spacing", () => {
    const detection = detectHeaderMapping([" quote_id ", "CLIENT NAME", "Job Description", "Estimate Amount", "Date Created", "Quote Status"]);
    expect(detection.mapping.quoteId).toBe(" quote_id ");
    expect(detection.mapping.customerName).toBe("CLIENT NAME");
    expect(detection.mapping.amount).toBe("Estimate Amount");
    expect(detection.mapping.createdDate).toBe("Date Created");
    expect(detection.mapping.status).toBe("Quote Status");
    expect(detection.missingRequired).toEqual([]);
  });

  it("normalizes repeated parser header suffixes deterministically", () => {
    expect(normalizeHeader("Amount (2)")).toBe("amount");
  });

  it("surfaces ambiguity instead of choosing a column", () => {
    const detection = detectHeaderMapping(["Customer", "Client", "Amount", "Created Date", "Status"]);
    expect(detection.mapping.customerName).toBeUndefined();
    expect(detection.ambiguities).toContainEqual({ field: "customerName", sourceHeaders: ["Customer", "Client"] });
    expect(detection.missingRequired).toContain("customerName");
    expect(detection.missingRequired).toContain("serviceDescription");
  });
});
