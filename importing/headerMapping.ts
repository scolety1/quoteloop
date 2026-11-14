import { canonicalFields, type CanonicalImportField, type HeaderDetection, type HeaderMapping } from "./types";

export const fieldLabels: Record<CanonicalImportField, string> = {
  quoteId: "Quote / estimate ID",
  customerName: "Customer name",
  serviceDescription: "Service / job description",
  amount: "Quoted amount",
  createdDate: "Created date",
  sentDate: "Sent date",
  expirationDate: "Expiration date",
  status: "Status",
  customerEmail: "Customer email",
  customerPhone: "Customer phone",
  lastCustomerResponseDate: "Last customer response",
  lastFollowUpDate: "Last follow-up",
  nextFollowUpDate: "Next follow-up",
  notes: "Notes",
  source: "Source / provider",
  sourceId: "Source ID",
  trade: "Trade",
  closedDate: "Won / lost date",
};

const aliases: Record<CanonicalImportField, string[]> = {
  quoteId: ["quote id", "estimate id", "quote number", "estimate number", "quote", "estimate", "number"],
  customerName: ["customer name", "customer", "client name", "client"],
  serviceDescription: ["service description", "job description", "description", "scope", "work description", "service"],
  amount: ["quoted amount", "quote amount", "estimate amount", "amount", "total", "total amount", "estimate total"],
  createdDate: ["created date", "date created", "created at", "quote date", "estimate date"],
  sentDate: ["sent date", "date sent", "sent at", "issued date", "date issued"],
  expirationDate: ["expiration date", "expires at", "expiry date", "valid until", "expiration"],
  status: ["status", "quote status", "estimate status", "state"],
  customerEmail: ["customer email", "client email", "email", "email address"],
  customerPhone: ["customer phone", "client phone", "phone", "phone number", "telephone"],
  lastCustomerResponseDate: ["last customer response date", "last response", "last response date", "customer replied at", "last inbound"],
  lastFollowUpDate: ["last follow up date", "last followup date", "last follow up", "last contacted", "last outbound"],
  nextFollowUpDate: ["next follow up date", "next followup date", "next follow up", "promised follow up", "callback date"],
  notes: ["notes", "note", "internal notes", "memo"],
  source: ["source", "provider", "source provider", "system"],
  sourceId: ["source id", "external id", "provider id", "external quote id"],
  trade: ["trade", "category", "service type", "department"],
  closedDate: ["closed date", "won date", "lost date", "accepted date", "decision date"],
};

const requiredFields: CanonicalImportField[] = ["customerName", "serviceDescription", "amount", "createdDate", "status"];

export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+\(\d+\)$/, "")
    .replace(/#/g, " number ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aliasLookup = new Map<string, CanonicalImportField>();
for (const field of canonicalFields) {
  for (const alias of aliases[field]) aliasLookup.set(normalizeHeader(alias), field);
}

export function detectHeaderMapping(headers: string[]): HeaderDetection {
  const candidates = new Map<CanonicalImportField, string[]>();
  const unmappedHeaders: string[] = [];

  for (const header of headers) {
    const field = aliasLookup.get(normalizeHeader(header));
    if (!field) {
      unmappedHeaders.push(header);
      continue;
    }
    candidates.set(field, [...(candidates.get(field) ?? []), header]);
  }

  const mapping = Object.fromEntries(canonicalFields.map((field) => [field, undefined])) as HeaderMapping;
  const ambiguities: HeaderDetection["ambiguities"] = [];
  for (const field of canonicalFields) {
    const matches = candidates.get(field) ?? [];
    if (matches.length === 1) mapping[field] = matches[0];
    if (matches.length > 1) ambiguities.push({ field, sourceHeaders: matches });
  }

  return {
    mapping,
    ambiguities,
    unmappedHeaders,
    missingRequired: requiredFields.filter((field) => !mapping[field]),
  };
}

export function withMappingOverrides(detected: HeaderDetection, overrides?: Partial<HeaderMapping>): HeaderDetection {
  if (!overrides) return detected;
  const mapping = { ...detected.mapping, ...overrides };
  const assignedHeaders = new Set(Object.values(mapping).filter(Boolean));
  return {
    mapping,
    ambiguities: detected.ambiguities.filter((item) => !mapping[item.field]),
    unmappedHeaders: detected.unmappedHeaders.filter((header) => !assignedHeaders.has(header)),
    missingRequired: requiredFields.filter((field) => !mapping[field]),
  };
}
