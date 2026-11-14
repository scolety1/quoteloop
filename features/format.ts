import type { AttentionLane, QuoteStatus } from "../domain/types";

export const formatCurrency = (value: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact && value >= 100_000 ? "compact" : "standard",
  }).format(value);

export const laneLabels: Record<AttentionLane, string> = {
  CALL_NOW: "Call now",
  FOLLOW_UP: "Follow up",
  GOING_COLD: "Going cold",
  WATCH: "Watch",
};

export const statusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  engaged: "Engaged",
  won: "Won",
  lost: "Lost",
  expired: "Expired",
};

export function quoteInitials(customerName: string): string {
  return customerName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
