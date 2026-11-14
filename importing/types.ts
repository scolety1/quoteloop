import type { Quote } from "../domain/types";

export const canonicalFields = [
  "quoteId", "customerName", "serviceDescription", "amount", "createdDate", "sentDate",
  "expirationDate", "status", "customerEmail", "customerPhone", "lastCustomerResponseDate",
  "lastFollowUpDate", "nextFollowUpDate", "notes", "source", "sourceId", "trade", "closedDate",
] as const;

export type CanonicalImportField = (typeof canonicalFields)[number];
export type HeaderMapping = Record<CanonicalImportField, string | undefined>;
export type FindingSeverity = "warning" | "review" | "error";
export type ImportDisposition = "ready" | "ready_with_warning" | "needs_review" | "rejected";
export type ImportAction = "create" | "update" | "skip_duplicate" | "needs_review" | "rejected";

export interface RawQuoteRecord {
  rowNumber: number;
  rawValues: Record<string, string>;
}

export interface ImportFinding {
  code: string;
  severity: FindingSeverity;
  message: string;
  rowNumber: number;
  field?: CanonicalImportField;
}

export interface HeaderAmbiguity {
  field: CanonicalImportField;
  sourceHeaders: string[];
}

export interface HeaderDetection {
  mapping: HeaderMapping;
  ambiguities: HeaderAmbiguity[];
  unmappedHeaders: string[];
  missingRequired: CanonicalImportField[];
}

export interface ParsedCsv {
  headers: string[];
  rows: RawQuoteRecord[];
  findings: ImportFinding[];
}

export interface NormalizedImportRow {
  sourceRow: number;
  rawValues: Record<string, string>;
  values: Record<CanonicalImportField, string>;
  findings: ImportFinding[];
  disposition: ImportDisposition;
  quote?: Quote;
}

export interface ImportPreviewRow extends NormalizedImportRow {
  action: ImportAction;
  existingQuoteId?: string;
  includedByDefault: boolean;
}

export interface ImportPreviewSummary {
  rowsDetected: number;
  readyToCreate: number;
  updates: number;
  duplicatesSkipped: number;
  needsReview: number;
  rejected: number;
  warningRows: number;
  fileQuotedTotal: number;
  newPendingRevenue: number;
}

export interface ImportPreview {
  importId: string;
  filename: string;
  createdAt: string;
  headers: string[];
  mapping: HeaderMapping;
  detection: HeaderDetection;
  fileFindings: ImportFinding[];
  rows: ImportPreviewRow[];
  summary: ImportPreviewSummary;
}

export interface ImportLedgerEntry {
  id: string;
  filename: string;
  importedAt: string;
  rowCount: number;
  createdCount: number;
  updatedCount: number;
  skippedDuplicateCount: number;
  reviewCount: number;
  rejectedCount: number;
}

export interface ImportCommitResult {
  quotes: Quote[];
  ledgerEntry: ImportLedgerEntry;
}
