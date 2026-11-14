import type { Quote, QuoteStatus } from "./types";

export interface ManualQuoteInput {
  customerName: string;
  serviceDescription: string;
  amount: number;
  createdAt: string;
  sentAt?: string;
  status: QuoteStatus;
  trade?: string;
  notes?: string;
}

export function createManualQuote(input: ManualQuoteInput, now: string, id: string): Quote {
  const customerName = input.customerName.trim();
  const serviceDescription = input.serviceDescription.trim();
  if (!customerName || !serviceDescription) throw new Error("Customer and description are required.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Amount must be greater than zero.");
  if (!input.createdAt || Number.isNaN(new Date(input.createdAt).getTime())) throw new Error("A valid created date is required.");
  if ((input.status === "sent" || input.status === "engaged") && !input.sentAt) throw new Error("Sent and engaged quotes require a sent date.");
  return {
    id,
    customerName,
    serviceDescription,
    trade: input.trade?.trim() || "General",
    amount: input.amount,
    createdAt: input.createdAt,
    sentAt: input.sentAt,
    status: input.status,
    wonAt: input.status === "won" ? now : undefined,
    lostAt: input.status === "lost" ? now : undefined,
    notes: input.notes?.trim() ?? "",
    originalId: id.toUpperCase(),
    sourceProvider: "Manual",
    activities: [],
  };
}
