export const DEMO_NOW = "2026-08-12T15:00:00.000Z";

export type QuoteStatus = "draft" | "sent" | "engaged" | "won" | "lost" | "expired";
export type AttentionLane = "CALL_NOW" | "FOLLOW_UP" | "GOING_COLD" | "WATCH";
export type FollowUpChannel = "call" | "text" | "email" | "other";
export type ActivityDirection = "outbound" | "inbound" | "system";
export type ActivityKind = "follow_up_attempt" | "customer_engagement" | "lifecycle" | "deferral" | "schedule_change" | "source_event" | "note";
export type ActivityProvenance = "local" | "csv" | "demo" | "migration";
export type FollowUpOutcomeCode =
  | "no_answer" | "voicemail_left" | "message_sent" | "still_considering" | "needs_more_time"
  | "callback_requested" | "revision_requested" | "project_postponed" | "customer_interested"
  | "verbally_accepted" | "declined" | "wrong_contact" | "other";
export type QuoteSourceProvider = "Jobber" | "ServiceTitan" | "Housecall Pro" | "QuickBooks" | "Manual" | "CSV";
export type CadenceState = "not_due" | "due_soon" | "due" | "overdue" | "deferred" | "suppressed";

export interface QuoteActivity {
  id: string;
  quoteId?: string;
  occurredAt: string;
  direction: ActivityDirection;
  channel: FollowUpChannel | "status";
  kind?: ActivityKind;
  provenance?: ActivityProvenance;
  note: string;
  outcome?: string;
  outcomeCode?: FollowUpOutcomeCode;
  directContact?: boolean;
  nextFollowUpAt?: string;
}

export interface QuoteDeferral {
  until: string;
  reason: string;
  kind: "scheduled_callback" | "postponed" | "snooze";
  createdAt: string;
}

export interface SellerAction {
  type: "revision_required" | "fix_contact";
  createdAt: string;
  note?: string;
}

export interface QuoteProvenance {
  kind: "csv";
  importId: string;
  filename: string;
  sourceRow: number;
  importedAt: string;
  sourceName: string;
  externalId?: string;
  rawStatus?: string;
  rawValues: Record<string, string>;
  fingerprint: string;
  sourceSnapshot: Record<string, string | number | undefined>;
}

export interface Quote {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceDescription: string;
  trade: string;
  amount: number;
  createdAt: string;
  sentAt?: string;
  expiresAt?: string;
  status: QuoteStatus;
  lastCustomerEngagementAt?: string;
  lastOutboundFollowUpAt?: string;
  lastInboundResponseAt?: string;
  nextFollowUpAt?: string;
  deferral?: QuoteDeferral;
  sellerAction?: SellerAction;
  wonAt?: string;
  lostAt?: string;
  lossReason?: string;
  notes: string;
  originalId: string;
  sourceProvider: QuoteSourceProvider;
  provenance?: QuoteProvenance;
  activities: QuoteActivity[];
}

export interface CadenceResult {
  state: CadenceState;
  dueAt?: string;
  becameDueAt?: string;
  reason: string;
  recommendedAction: string;
  suggestedNextFollowUpAt?: string;
  attemptCount: number;
  lastOutcome?: FollowUpOutcomeCode;
  suppressed: boolean;
}

export interface AttentionResult {
  lane: AttentionLane | null;
  score: number;
  reasons: string[];
  recommendedAction: string;
}

export interface QuoteMetrics {
  pendingRevenue: number;
  wonThisMonth: number;
  lostThisMonth: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
  noFollowUpCount: number;
  averageFirstFollowUpHours: number | null;
}

export const ACTIVE_STATUSES: QuoteStatus[] = ["draft", "sent", "engaged"];
export function isActiveQuote(quote: Quote): boolean { return ACTIVE_STATUSES.includes(quote.status); }
export function isPendingQuote(quote: Quote): boolean { return quote.status === "sent" || quote.status === "engaged"; }
export function isStructuredAttempt(activity: QuoteActivity): boolean { return activity.kind === "follow_up_attempt" && Boolean(activity.outcomeCode); }