import type { Quote, QuoteActivity, QuoteStatus } from "../domain/types";
import { canonicalFields, type CanonicalImportField, type HeaderMapping, type ImportDisposition, type ImportFinding, type NormalizedImportRow, type RawQuoteRecord } from "./types";

export interface NormalizationContext {
  filename: string;
  importId: string;
  importedAt: string;
  mapping: HeaderMapping;
  ambiguousFields?: ReadonlySet<CanonicalImportField>;
}

export function parseMoney(raw: string): { value?: number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "A quoted amount is required." };
  const normalized = trimmed.replace(/^\$\s*/, "").replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return { error: `"${trimmed}" is not a supported dollar amount.` };
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return { error: "Quoted amount must be greater than zero." };
  return { value };
}

function isRealUtcDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day, 15));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseImportDate(raw: string): { value?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
  } else {
    match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
    if (match) {
      month = Number(match[1]); day = Number(match[2]); year = Number(match[3]);
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
      const timestamp = new Date(trimmed);
      if (!Number.isNaN(timestamp.getTime())) return { value: timestamp.toISOString() };
      return { error: `"${trimmed}" is not a valid date.` };
    } else {
      return { error: `"${trimmed}" is not a supported date format.` };
    }
  }
  if (!isRealUtcDate(year, month, day)) return { error: `"${trimmed}" is not a real calendar date.` };
  return { value: new Date(Date.UTC(year, month - 1, day, 15)).toISOString() };
}

const statusAliases: Record<string, QuoteStatus> = {
  draft: "draft",
  sent: "sent",
  open: "sent",
  pending: "sent",
  engaged: "engaged",
  responded: "engaged",
  accepted: "won",
  approved: "won",
  won: "won",
  declined: "lost",
  rejected: "lost",
  lost: "lost",
  expired: "expired",
};

export function mapImportStatus(raw: string): QuoteStatus | undefined {
  return statusAliases[raw.trim().toLowerCase()];
}

export function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function dispositionFor(findings: ImportFinding[]): ImportDisposition {
  if (findings.some((finding) => finding.severity === "error")) return "rejected";
  if (findings.some((finding) => finding.severity === "review")) return "needs_review";
  if (findings.some((finding) => finding.severity === "warning")) return "ready_with_warning";
  return "ready";
}

export function normalizeImportRow(row: RawQuoteRecord, context: NormalizationContext): NormalizedImportRow {
  const values = Object.fromEntries(canonicalFields.map((field) => {
    const header = context.mapping[field];
    return [field, header ? (row.rawValues[header] ?? "").trim() : ""];
  })) as Record<CanonicalImportField, string>;
  const findings: ImportFinding[] = [];
  const add = (code: string, severity: ImportFinding["severity"], message: string, field?: CanonicalImportField) => {
    findings.push({ code, severity, message, field, rowNumber: row.rowNumber });
  };

  const ambiguous = (field: CanonicalImportField) => context.ambiguousFields?.has(field) ?? false;
  if (!context.mapping.customerName) add(ambiguous("customerName") ? "AMBIGUOUS_CUSTOMER_COLUMN" : "MISSING_CUSTOMER_COLUMN", ambiguous("customerName") ? "review" : "error", ambiguous("customerName") ? "Choose which source column contains the customer name." : "No customer-name column is mapped.", "customerName");
  else if (!values.customerName) add("MISSING_CUSTOMER", "error", "Customer name is required.", "customerName");

  if (!context.mapping.serviceDescription) add(ambiguous("serviceDescription") ? "AMBIGUOUS_DESCRIPTION_COLUMN" : "MISSING_DESCRIPTION_COLUMN", "review", ambiguous("serviceDescription") ? "Choose which source column contains the service description." : "No service-description column is mapped.", "serviceDescription");
  else if (!values.serviceDescription) add("MISSING_DESCRIPTION", "review", "A service or job description is required before import.", "serviceDescription");

  if (!context.mapping.amount) add(ambiguous("amount") ? "AMBIGUOUS_AMOUNT_COLUMN" : "MISSING_AMOUNT_COLUMN", ambiguous("amount") ? "review" : "error", ambiguous("amount") ? "Choose which source column contains the quoted amount." : "No quoted-amount column is mapped.", "amount");
  const money = parseMoney(values.amount);
  if (context.mapping.amount && money.error) add(values.amount ? "INVALID_AMOUNT" : "MISSING_AMOUNT", "error", money.error, "amount");

  if (!context.mapping.createdDate) add(ambiguous("createdDate") ? "AMBIGUOUS_CREATED_DATE_COLUMN" : "MISSING_CREATED_DATE_COLUMN", ambiguous("createdDate") ? "review" : "error", ambiguous("createdDate") ? "Choose which source column contains the created date." : "No created-date column is mapped.", "createdDate");
  const created = parseImportDate(values.createdDate);
  if (context.mapping.createdDate && created.error) add("INVALID_CREATED_DATE", "error", created.error, "createdDate");
  else if (context.mapping.createdDate && !created.value) add("MISSING_CREATED_DATE", "error", "Created date is required.", "createdDate");

  if (!context.mapping.status) add("MISSING_STATUS_COLUMN", "review", "No lifecycle-status column is mapped.", "status");
  const status = mapImportStatus(values.status);
  if (!values.status) add("MISSING_STATUS", "review", "Lifecycle status is required.", "status");
  else if (!status) add("UNKNOWN_STATUS", "review", `"${values.status}" does not map to a QuoteLoop lifecycle state.`, "status");

  const parsedDates = {
    sentAt: parseImportDate(values.sentDate),
    expiresAt: parseImportDate(values.expirationDate),
    inboundAt: parseImportDate(values.lastCustomerResponseDate),
    outboundAt: parseImportDate(values.lastFollowUpDate),
    nextAt: parseImportDate(values.nextFollowUpDate),
    closedAt: parseImportDate(values.closedDate),
  };
  const dateFields: [keyof typeof parsedDates, CanonicalImportField, string][] = [
    ["sentAt", "sentDate", "sent date"], ["expiresAt", "expirationDate", "expiration date"],
    ["inboundAt", "lastCustomerResponseDate", "last customer response date"],
    ["outboundAt", "lastFollowUpDate", "last follow-up date"],
    ["nextAt", "nextFollowUpDate", "next follow-up date"], ["closedAt", "closedDate", "closed date"],
  ];
  for (const [key, field, label] of dateFields) {
    if (parsedDates[key].error) add("INVALID_DATE", "error", `Invalid ${label}: ${parsedDates[key].error}`, field);
  }

  if ((status === "sent" || status === "engaged") && !parsedDates.sentAt.value) {
    add("MISSING_SENT_DATE", "review", `A ${status} quote needs a sent date for trustworthy follow-up timing.`, "sentDate");
  } else if ((status === "won" || status === "lost") && !parsedDates.sentAt.value) {
    add("MISSING_SENT_DATE", "warning", "The closed quote has no sent date; its follow-up history may be incomplete.", "sentDate");
  }
  if ((status === "won" || status === "lost") && !parsedDates.closedAt.value) {
    add("MISSING_CLOSED_DATE", "warning", "No closed date was supplied, so this row will not be counted as won/lost in a specific month.", "closedDate");
  }
  if (status === "expired" && !parsedDates.expiresAt.value) {
    add("MISSING_EXPIRATION_DATE", "warning", "Expired status has no expiration date.", "expirationDate");
  }

  const time = (value?: string) => value ? new Date(value).getTime() : undefined;
  if (created.value && parsedDates.sentAt.value && time(parsedDates.sentAt.value)! < time(created.value)!) {
    add("SENT_BEFORE_CREATED", "error", "Sent date cannot be before created date.", "sentDate");
  }
  if (parsedDates.expiresAt.value && (parsedDates.sentAt.value || created.value) && time(parsedDates.expiresAt.value)! < time(parsedDates.sentAt.value ?? created.value)!) {
    add("EXPIRATION_BEFORE_SENT", "error", "Expiration date cannot be before the sent or created date.", "expirationDate");
  }
  if (created.value && parsedDates.closedAt.value && time(parsedDates.closedAt.value)! < time(created.value)!) {
    add("CLOSED_BEFORE_CREATED", "error", "Closed date cannot be before created date.", "closedDate");
  }

  const externalId = values.sourceId || values.quoteId || undefined;
  const sourceName = values.source || "CSV";
  if (!externalId) add("MISSING_SOURCE_ID", "warning", "No stable source ID was supplied; conservative fingerprint matching will be used.", "sourceId");
  if (values.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail)) {
    add("SUSPICIOUS_EMAIL", "warning", "Customer email does not look complete; the source value is preserved.", "customerEmail");
  }

  const disposition = dispositionFor(findings);
  if (disposition === "rejected" || disposition === "needs_review" || money.value === undefined || !created.value || !status) {
    return { sourceRow: row.rowNumber, rawValues: row.rawValues, values, findings, disposition };
  }

  const fingerprint = [sourceName, values.customerName, values.serviceDescription, Math.round(money.value * 100), created.value.slice(0, 10)]
    .map((part) => String(part).trim().toLowerCase()).join("|");
  const quoteId = `csv-${stableHash(externalId ? `${sourceName}|${externalId}`.toLowerCase() : fingerprint)}`;
  const activities: QuoteActivity[] = [];
  if (parsedDates.inboundAt.value) activities.push({
    id: `${quoteId}-source-inbound-${stableHash(parsedDates.inboundAt.value)}`,
    occurredAt: parsedDates.inboundAt.value,
    direction: "inbound",
    channel: "other",
    note: "Imported last customer response",
  });
  if (parsedDates.outboundAt.value) activities.push({
    id: `${quoteId}-source-outbound-${stableHash(parsedDates.outboundAt.value)}`,
    occurredAt: parsedDates.outboundAt.value,
    direction: "outbound",
    channel: "other",
    note: "Imported last follow-up",
  });

  const sourceSnapshot: Record<string, string | number | undefined> = {};
  const capture = (mappedField: CanonicalImportField, quoteField: string, value: string | number | undefined) => {
    if (context.mapping[mappedField]) sourceSnapshot[quoteField] = value;
  };
  capture("customerName", "customerName", values.customerName);
  capture("customerEmail", "customerEmail", values.customerEmail || undefined);
  capture("customerPhone", "customerPhone", values.customerPhone || undefined);
  capture("serviceDescription", "serviceDescription", values.serviceDescription);
  capture("trade", "trade", values.trade || "General");
  capture("amount", "amount", money.value);
  capture("createdDate", "createdAt", created.value);
  capture("sentDate", "sentAt", parsedDates.sentAt.value);
  capture("expirationDate", "expiresAt", parsedDates.expiresAt.value);
  capture("status", "status", status);
  capture("nextFollowUpDate", "nextFollowUpAt", parsedDates.nextAt.value);
  capture("closedDate", "wonAt", status === "won" ? parsedDates.closedAt.value : undefined);
  capture("closedDate", "lostAt", status === "lost" ? parsedDates.closedAt.value : undefined);
  capture("notes", "notes", values.notes);

  const quote: Quote = {
    id: quoteId,
    customerName: values.customerName,
    customerEmail: values.customerEmail || undefined,
    customerPhone: values.customerPhone || undefined,
    serviceDescription: values.serviceDescription,
    trade: values.trade || "General",
    amount: money.value,
    createdAt: created.value,
    sentAt: parsedDates.sentAt.value,
    expiresAt: parsedDates.expiresAt.value,
    status,
    lastCustomerEngagementAt: parsedDates.inboundAt.value,
    lastInboundResponseAt: parsedDates.inboundAt.value,
    lastOutboundFollowUpAt: parsedDates.outboundAt.value,
    nextFollowUpAt: parsedDates.nextAt.value,
    wonAt: status === "won" ? parsedDates.closedAt.value : undefined,
    lostAt: status === "lost" ? parsedDates.closedAt.value : undefined,
    notes: values.notes,
    originalId: externalId ?? `CSV row ${row.rowNumber}`,
    sourceProvider: "CSV",
    provenance: {
      kind: "csv",
      importId: context.importId,
      filename: context.filename,
      sourceRow: row.rowNumber,
      importedAt: context.importedAt,
      sourceName,
      externalId,
      rawStatus: values.status || undefined,
      rawValues: row.rawValues,
      fingerprint,
      sourceSnapshot,
    },
    activities,
  };

  return { sourceRow: row.rowNumber, rawValues: row.rawValues, values, findings, disposition, quote };
}
