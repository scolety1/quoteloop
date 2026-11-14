import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { prioritizeQuotes } from "../domain/attention";
import { calculateMetrics } from "../domain/metrics";
import { DEMO_NOW, type Quote } from "../domain/types";
import { freshDemoQuotes } from "../fixtures/demoQuotes";
import { LocalQuoteRepository } from "../repositories/LocalQuoteRepository";
import { buildImportPreview, commitImport } from "./importService";

const cleanCsv = readFileSync(resolve(process.cwd(), "public/samples/A-clean-standard.csv"), "utf8");
const duplicateCsv = readFileSync(resolve(process.cwd(), "public/samples/D-duplicate-reimport.csv"), "utf8");
const acceptedRows = (preview: ReturnType<typeof buildImportPreview>) => new Set(preview.rows.filter((row) => row.includedByDefault).map((row) => row.sourceRow));

function preview(csvText: string, existingQuotes: Quote[] = [], filename = "input.csv") {
  return buildImportPreview({ csvText, filename, existingQuotes, importedAt: DEMO_NOW });
}

describe("CSV import integration and re-import policy", () => {
  beforeEach(() => window.localStorage.clear());

  it("flows from clean CSV through preview, repository, metrics, and prioritization", async () => {
    const baseline = freshDemoQuotes();
    const resultPreview = preview(cleanCsv, baseline, "A-clean-standard.csv");
    expect(resultPreview.summary).toEqual(expect.objectContaining({ rowsDetected: 12, readyToCreate: 12, updates: 0, duplicatesSkipped: 0, needsReview: 0, rejected: 0 }));
    const committed = commitImport(resultPreview, baseline, acceptedRows(resultPreview));
    expect(committed.quotes).toHaveLength(baseline.length + 12);
    expect(committed.ledgerEntry).toEqual(expect.objectContaining({ createdCount: 12, updatedCount: 0, rowCount: 12 }));

    const repository = new LocalQuoteRepository();
    await repository.save(committed.quotes);
    await repository.saveImport(committed.ledgerEntry);
    expect(await repository.list()).toHaveLength(baseline.length + 12);
    expect(await repository.listImports()).toEqual([committed.ledgerEntry]);

    const imported = committed.quotes.find((quote) => quote.originalId === "JB-9001");
    expect(imported?.provenance?.rawValues.customer_name).toBe("Northstar Bakery");
    expect(calculateMetrics(committed.quotes, DEMO_NOW).pendingRevenue).toBeGreaterThan(calculateMetrics(baseline, DEMO_NOW).pendingRevenue);
    expect(prioritizeQuotes(committed.quotes, DEMO_NOW).some((item) => item.quote.id === imported?.id)).toBe(true);
  });

  it("does not double quote counts or revenue when an identical file is imported twice", () => {
    const firstPreview = preview(cleanCsv, freshDemoQuotes(), "A-clean-standard.csv");
    const first = commitImport(firstPreview, freshDemoQuotes(), acceptedRows(firstPreview));
    const metricsAfterFirst = calculateMetrics(first.quotes, DEMO_NOW);

    const secondPreview = preview(cleanCsv, first.quotes, "A-clean-standard.csv");
    expect(secondPreview.summary).toEqual(expect.objectContaining({ readyToCreate: 0, updates: 0, duplicatesSkipped: 12 }));
    const second = commitImport(secondPreview, first.quotes, acceptedRows(secondPreview));
    expect(second.quotes).toHaveLength(first.quotes.length);
    expect(calculateMetrics(second.quotes, DEMO_NOW)).toEqual(metricsAfterFirst);
  });

  it("classifies stable-ID source changes as updates and unchanged rows as duplicates", () => {
    const firstPreview = preview(cleanCsv, [], "A-clean-standard.csv");
    const first = commitImport(firstPreview, [], acceptedRows(firstPreview));
    const next = preview(duplicateCsv, first.quotes, "D-duplicate-reimport.csv");
    expect(next.summary).toEqual(expect.objectContaining({ readyToCreate: 1, updates: 2, duplicatesSkipped: 1, needsReview: 0 }));
  });

  it("preserves local follow-up activity and promised dates through a source update", () => {
    const firstPreview = preview(cleanCsv, [], "A-clean-standard.csv");
    const first = commitImport(firstPreview, [], acceptedRows(firstPreview));
    const imported = first.quotes.find((quote) => quote.originalId === "JB-9001")!;
    const locallyUpdated: Quote = {
      ...imported,
      lastOutboundFollowUpAt: DEMO_NOW,
      nextFollowUpAt: "2026-08-20T15:00:00.000Z",
      activities: [...imported.activities, { id: "local-call", quoteId: imported.id, occurredAt: DEMO_NOW, direction: "outbound", channel: "call", kind: "follow_up_attempt", provenance: "local", note: "Local follow-up", outcome: "No answer", outcomeCode: "no_answer", directContact: false, nextFollowUpAt: "2026-08-20T15:00:00.000Z" }],
    };
    const current = first.quotes.map((quote) => quote.id === imported.id ? locallyUpdated : quote);
    const next = preview(duplicateCsv, current, "D-duplicate-reimport.csv");
    const result = commitImport(next, current, acceptedRows(next));
    const merged = result.quotes.find((quote) => quote.id === imported.id)!;
    expect(merged.amount).toBe(19200);
    expect(merged.activities).toContainEqual(expect.objectContaining({ id: "local-call", kind: "follow_up_attempt", outcomeCode: "no_answer", provenance: "local" }));
    expect(merged.lastOutboundFollowUpAt).toBe(DEMO_NOW);
    expect(merged.nextFollowUpAt).toBe("2026-08-20T15:00:00.000Z");
    expect(merged.customerEmail).toBe("ops@northstar.example");
  });

  it("requires review when incoming source data conflicts with a locally edited source field", () => {
    const firstPreview = preview(cleanCsv, [], "A-clean-standard.csv");
    const first = commitImport(firstPreview, [], acceptedRows(firstPreview));
    const current = first.quotes.map((quote) => quote.originalId === "JB-9001" ? { ...quote, amount: 20000 } : quote);
    const next = preview(duplicateCsv, current, "D-duplicate-reimport.csv");
    const conflict = next.rows.find((row) => row.values.sourceId === "JB-9001")!;
    expect(conflict.action).toBe("needs_review");
    expect(conflict.findings).toContainEqual(expect.objectContaining({ code: "LOCAL_SOURCE_CONFLICT" }));
  });

  it("uses a conservative fallback fingerprint without treating customer or amount alone as duplicates", () => {
    const firstCsv = "customer,description,amount,created date,sent date,status\nAcme,Panel repair,4200,2026-08-01,2026-08-02,sent";
    const firstPreview = preview(firstCsv);
    const first = commitImport(firstPreview, [], acceptedRows(firstPreview));
    expect(preview(firstCsv, first.quotes).rows[0].action).toBe("skip_duplicate");

    const uncertain = "customer,description,amount,created date,sent date,status\nAcme,Generator service,4200,2026-08-01,2026-08-02,sent";
    expect(preview(uncertain, first.quotes).rows[0].action).toBe("needs_review");

    const sameCustomerSeparate = "customer,description,amount,created date,sent date,status\nAcme,Generator service,5100,2026-08-03,2026-08-04,sent";
    expect(preview(sameCustomerSeparate, first.quotes).rows[0].action).toBe("create");
    const sameAmountSeparate = "customer,description,amount,created date,sent date,status\nBeta,Panel repair,4200,2026-08-01,2026-08-02,sent";
    expect(preview(sameAmountSeparate, first.quotes).rows[0].action).toBe("create");
  });

  it("keeps bad and ambiguous rows out of the commit set", () => {
    const bad = readFileSync(resolve(process.cwd(), "public/samples/C-bad-data.csv"), "utf8");
    const ambiguous = readFileSync(resolve(process.cwd(), "public/samples/E-ambiguous-columns.csv"), "utf8");
    const badPreview = preview(bad);
    expect(badPreview.summary.rejected).toBeGreaterThan(0);
    expect(badPreview.summary.needsReview).toBeGreaterThan(0);
    const ambiguousPreview = preview(ambiguous);
    expect(ambiguousPreview.detection.ambiguities.length).toBeGreaterThan(0);
    expect(ambiguousPreview.summary).toEqual(expect.objectContaining({ needsReview: 2, rejected: 0 }));
    expect(acceptedRows(ambiguousPreview).size).toBe(0);
  });
});
