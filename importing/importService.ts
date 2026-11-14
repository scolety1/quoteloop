import { isPendingQuote, type Quote } from "../domain/types";
import { parseCsv } from "./csvParser";
import { detectHeaderMapping, withMappingOverrides } from "./headerMapping";
import { normalizeImportRow, parseMoney, stableHash } from "./normalize";
import type { HeaderMapping, ImportCommitResult, ImportFinding, ImportPreview, ImportPreviewRow } from "./types";

const sourceControlledFields = [
  "customerName", "customerEmail", "customerPhone", "serviceDescription", "trade", "amount", "createdAt",
  "sentAt", "expiresAt", "status", "nextFollowUpAt", "wonAt", "lostAt", "notes",
] as const satisfies readonly (keyof Quote)[];

type SourceControlledField = (typeof sourceControlledFields)[number];

function comparable(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function sourceIdentity(quote: Quote): string | undefined {
  const provenance = quote.provenance;
  if (!provenance?.externalId) return undefined;
  return `${provenance.sourceName.trim().toLowerCase()}|${provenance.externalId.trim().toLowerCase()}`;
}

function possibleDuplicateSignature(quote: Quote): string {
  return [quote.customerName, Math.round(quote.amount * 100), quote.createdAt.slice(0, 10)]
    .map((value) => String(value).trim().toLowerCase()).join("|");
}

function findLocalConflicts(existing: Quote, incoming: Quote): SourceControlledField[] {
  const previous = existing.provenance?.sourceSnapshot;
  const next = incoming.provenance?.sourceSnapshot;
  if (!previous || !next) return [];
  return sourceControlledFields.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(previous, field) || !Object.prototype.hasOwnProperty.call(next, field)) return false;
    const currentValue = comparable(existing[field]);
    const priorSourceValue = comparable(previous[field]);
    const incomingValue = comparable(next[field]);
    return currentValue !== priorSourceValue && incomingValue !== currentValue;
  });
}

function sourceDataUnchanged(existing: Quote, incoming: Quote): boolean {
  const previous = existing.provenance?.sourceSnapshot;
  const next = incoming.provenance?.sourceSnapshot;
  if (!previous || !next) return false;
  return sourceControlledFields
    .filter((field) => Object.prototype.hasOwnProperty.call(next, field))
    .every((field) => comparable(previous[field]) === comparable(next[field]));
}

function latest(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

export function mergeImportedQuote(existing: Quote, incoming: Quote): Quote {
  const previous = existing.provenance?.sourceSnapshot ?? {};
  const next = incoming.provenance?.sourceSnapshot ?? {};
  const mergedSource = { ...existing };
  for (const field of sourceControlledFields) {
    if (Object.prototype.hasOwnProperty.call(next, field)) Object.assign(mergedSource, { [field]: incoming[field] });
  }
  const activities = new Map(existing.activities.map((activity) => [activity.id, activity]));
  for (const activity of incoming.activities) activities.set(activity.id, activity);
  return {
    ...mergedSource,
    id: existing.id,
    provenance: incoming.provenance ? { ...incoming.provenance, sourceSnapshot: { ...previous, ...next } } : existing.provenance,
    activities: [...activities.values()],
    lastCustomerEngagementAt: latest(existing.lastCustomerEngagementAt, incoming.lastCustomerEngagementAt),
    lastInboundResponseAt: latest(existing.lastInboundResponseAt, incoming.lastInboundResponseAt),
    lastOutboundFollowUpAt: latest(existing.lastOutboundFollowUpAt, incoming.lastOutboundFollowUpAt),
  };
}

function classifyRow(row: ReturnType<typeof normalizeImportRow>, existingQuotes: Quote[]): ImportPreviewRow {
  if (!row.quote) {
    return { ...row, action: row.disposition === "rejected" ? "rejected" : "needs_review", includedByDefault: false };
  }
  const incoming = row.quote;
  const identity = sourceIdentity(incoming);
  const identityMatch = identity ? existingQuotes.find((quote) => sourceIdentity(quote) === identity) : undefined;
  const fingerprintMatch = !identity
    ? existingQuotes.find((quote) => quote.provenance?.fingerprint === incoming.provenance?.fingerprint)
    : undefined;
  const exactMatch = identityMatch ?? fingerprintMatch;

  if (exactMatch) {
    if (sourceDataUnchanged(exactMatch, incoming)) {
      const finding: ImportFinding = {
        code: "EXACT_DUPLICATE", severity: "warning", message: "This source quote is already imported with the same canonical values.",
        rowNumber: row.sourceRow,
      };
      return { ...row, findings: [...row.findings, finding], disposition: "ready_with_warning", action: "skip_duplicate", existingQuoteId: exactMatch.id, includedByDefault: false };
    }
    const conflicts = findLocalConflicts(exactMatch, incoming);
    if (conflicts.length > 0) {
      const finding: ImportFinding = {
        code: "LOCAL_SOURCE_CONFLICT", severity: "review",
        message: `Incoming source data conflicts with locally changed field(s): ${conflicts.join(", ")}. The row was not selected.`,
        rowNumber: row.sourceRow,
      };
      return { ...row, findings: [...row.findings, finding], disposition: "needs_review", action: "needs_review", existingQuoteId: exactMatch.id, includedByDefault: false };
    }
    const finding: ImportFinding = {
      code: "SOURCE_UPDATE", severity: "warning", message: "The stable source ID matches an existing quote with changed source values; local activity will be preserved.",
      rowNumber: row.sourceRow,
    };
    return { ...row, findings: [...row.findings, finding], disposition: "ready_with_warning", action: "update", existingQuoteId: exactMatch.id, includedByDefault: true };
  }

  const possible = existingQuotes.find((quote) => possibleDuplicateSignature(quote) === possibleDuplicateSignature(incoming));
  if (possible) {
    const finding: ImportFinding = {
      code: "POSSIBLE_DUPLICATE", severity: "review",
      message: `Possible duplicate of ${possible.originalId}: customer, amount, and created date match, but no stable source identity does.`,
      rowNumber: row.sourceRow,
    };
    return { ...row, findings: [...row.findings, finding], disposition: "needs_review", action: "needs_review", existingQuoteId: possible.id, includedByDefault: false };
  }

  return { ...row, action: "create", includedByDefault: true };
}

export function buildImportPreview(input: {
  csvText: string;
  filename: string;
  existingQuotes: Quote[];
  importedAt: string;
  mappingOverrides?: Partial<HeaderMapping>;
}): ImportPreview {
  const parsed = parseCsv(input.csvText);
  const detected = detectHeaderMapping(parsed.headers);
  const detection = withMappingOverrides(detected, input.mappingOverrides);
  const importId = `import-${input.importedAt.replace(/[^0-9]/g, "").slice(0, 14)}-${stableHash(`${input.filename}|${input.csvText}`)}`;
  const fileFindings = [...parsed.findings];

  for (const ambiguity of detection.ambiguities) {
    fileFindings.push({
      code: "AMBIGUOUS_HEADER", severity: "review",
      message: `${ambiguity.sourceHeaders.join(", ")} all match the same field. Choose the intended ${ambiguity.field} column.`,
      rowNumber: 1, field: ambiguity.field,
    });
  }
  const assigned = Object.entries(detection.mapping).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const reuse = assigned.filter(([, header], index) => assigned.findIndex(([, other]) => other === header) !== index);
  if (reuse.length > 0) {
    fileFindings.push({ code: "MAPPING_SOURCE_REUSED", severity: "review", message: "One source column is mapped to multiple QuoteLoop fields.", rowNumber: 1 });
  }

  const fatalFileError = fileFindings.some((finding) => finding.severity === "error" && finding.rowNumber === 1);
  const normalizedRows = parsed.rows.map((rawRow) => {
    const normalized = normalizeImportRow(rawRow, {
      filename: input.filename, importId, importedAt: input.importedAt, mapping: detection.mapping,
      ambiguousFields: new Set(detection.ambiguities.map((item) => item.field)),
    });
    const parseFindings = fileFindings.filter((finding) => finding.rowNumber === rawRow.rowNumber && finding.severity === "error");
    if (fatalFileError || parseFindings.length > 0) {
      return {
        ...normalized,
        quote: undefined,
        disposition: "rejected" as const,
        findings: [...normalized.findings, ...parseFindings, ...(fatalFileError ? [{ code: "FILE_PARSE_FAILED", severity: "error" as const, message: "The file has a fatal CSV parsing error.", rowNumber: rawRow.rowNumber }] : [])],
      };
    }
    return normalized;
  });
  const rows = normalizedRows.map((row) => classifyRow(row, input.existingQuotes));
  const totalFor = (predicate: (row: ImportPreviewRow) => boolean) => rows.filter(predicate).reduce((sum, row) => sum + (parseMoney(row.values.amount).value ?? 0), 0);
  const summary = {
    rowsDetected: rows.length,
    readyToCreate: rows.filter((row) => row.action === "create").length,
    updates: rows.filter((row) => row.action === "update").length,
    duplicatesSkipped: rows.filter((row) => row.action === "skip_duplicate").length,
    needsReview: rows.filter((row) => row.action === "needs_review").length,
    rejected: rows.filter((row) => row.action === "rejected").length,
    warningRows: rows.filter((row) => row.disposition === "ready_with_warning").length,
    fileQuotedTotal: totalFor(() => true),
    newPendingRevenue: rows.filter((row) => row.action === "create" && row.quote && isPendingQuote(row.quote)).reduce((sum, row) => sum + (row.quote?.amount ?? 0), 0),
  };

  return { importId, filename: input.filename, createdAt: input.importedAt, headers: parsed.headers, mapping: detection.mapping, detection, fileFindings, rows, summary };
}

export function commitImport(preview: ImportPreview, existingQuotes: Quote[], includedRows: ReadonlySet<number>): ImportCommitResult {
  const byId = new Map(existingQuotes.map((quote) => [quote.id, quote]));
  let createdCount = 0;
  let updatedCount = 0;
  for (const row of preview.rows) {
    if (!includedRows.has(row.sourceRow) || !row.quote) continue;
    if (row.action === "create") {
      byId.set(row.quote.id, row.quote);
      createdCount += 1;
    } else if (row.action === "update" && row.existingQuoteId) {
      const existing = byId.get(row.existingQuoteId);
      if (existing) {
        byId.set(existing.id, mergeImportedQuote(existing, row.quote));
        updatedCount += 1;
      }
    }
  }
  return {
    quotes: [...byId.values()],
    ledgerEntry: {
      id: preview.importId,
      filename: preview.filename,
      importedAt: preview.createdAt,
      rowCount: preview.summary.rowsDetected,
      createdCount,
      updatedCount,
      skippedDuplicateCount: preview.summary.duplicatesSkipped,
      reviewCount: preview.summary.needsReview,
      rejectedCount: preview.summary.rejected,
    },
  };
}
