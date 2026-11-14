import { describe, expect, it } from "vitest";
import { detectHeaderMapping } from "./headerMapping";
import { mapImportStatus, normalizeImportRow, parseImportDate, parseMoney } from "./normalize";

const headers = ["customer_name", "job_description", "quoted_amount", "created_date", "sent_date", "expiration_date", "status", "source_id"];
const mapping = detectHeaderMapping(headers).mapping;

function row(values: Partial<Record<(typeof headers)[number], string>>) {
  return normalizeImportRow({ rowNumber: 2, rawValues: Object.fromEntries(headers.map((header) => [header, values[header] ?? ""])) }, {
    filename: "test.csv", importId: "import-test", importedAt: "2026-08-12T15:00:00.000Z", mapping,
  });
}

describe("import normalization and validation", () => {
  it.each([
    ["8400", 8400], ["8400.00", 8400], ["$8,400", 8400], ["$8,400.00", 8400],
  ])("normalizes money %s", (raw, expected) => expect(parseMoney(raw).value).toBe(expected));

  it.each(["$8.4.0", "8 400", "free", "", "-20"])('rejects malformed money "%s"', (raw) => expect(parseMoney(raw).error).toBeTruthy());

  it.each([
    ["2026-08-12", "2026-08-12T15:00:00.000Z"], ["8/2/2026", "2026-08-02T15:00:00.000Z"], ["08-02-2026", "2026-08-02T15:00:00.000Z"],
  ])("normalizes explicit date format %s", (raw, expected) => expect(parseImportDate(raw).value).toBe(expected));

  it("keeps optional blank dates blank and rejects impossible dates", () => {
    expect(parseImportDate("")).toEqual({});
    expect(parseImportDate("2026-02-30").error).toContain("real calendar date");
    expect(parseImportDate("12 Aug 2026").error).toContain("supported date format");
  });

  it.each([["open", "sent"], ["pending", "sent"], ["responded", "engaged"], ["approved", "won"], ["rejected", "lost"], ["expired", "expired"]])("maps source status %s to %s", (raw, expected) => expect(mapImportStatus(raw)).toBe(expected));

  it("requires review for an unknown status", () => {
    const result = row({ customer_name: "Acme", job_description: "Repair", quoted_amount: "4200", created_date: "2026-08-01", sent_date: "2026-08-02", status: "awaiting signature", source_id: "A-1" });
    expect(result.disposition).toBe("needs_review");
    expect(result.findings).toContainEqual(expect.objectContaining({ code: "UNKNOWN_STATUS", field: "status" }));
    expect(result.quote).toBeUndefined();
  });

  it("rejects missing customer, invalid amount, impossible dates, and inconsistent chronology", () => {
    const result = row({ customer_name: "", job_description: "Repair", quoted_amount: "oops", created_date: "2026-08-05", sent_date: "2026-08-02", expiration_date: "2026-08-01", status: "sent" });
    expect(result.disposition).toBe("rejected");
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["MISSING_CUSTOMER", "INVALID_AMOUNT", "SENT_BEFORE_CREATED", "EXPIRATION_BEFORE_SENT", "MISSING_SOURCE_ID"]));
  });

  it("creates an auditable canonical quote while warning when no stable ID exists", () => {
    const result = row({ customer_name: "  Acme  ", job_description: "  Panel repair  ", quoted_amount: "$4,200", created_date: "2026-08-01", sent_date: "2026-08-02", status: "sent" });
    expect(result.disposition).toBe("ready_with_warning");
    expect(result.quote).toEqual(expect.objectContaining({ customerName: "Acme", serviceDescription: "Panel repair", amount: 4200, sourceProvider: "CSV" }));
    expect(result.quote?.provenance).toEqual(expect.objectContaining({ filename: "test.csv", sourceRow: 2, rawStatus: "sent" }));
  });
});
