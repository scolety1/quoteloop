import { describe, expect, it } from "vitest";
import { calculateMetrics } from "./metrics";
import { DEMO_NOW, type Quote } from "./types";
import { daysAgo } from "../fixtures/demoQuotes";
import { markQuoteWon } from "./lifecycle";

function quote(id: string, amount: number, status: Quote["status"], closedAt?: string, followedUp = false): Quote {
  return {
    id,
    customerName: id,
    serviceDescription: "Controlled fixture",
    trade: "Test",
    amount,
    createdAt: daysAgo(12),
    sentAt: daysAgo(10),
    status,
    wonAt: status === "won" ? closedAt : undefined,
    lostAt: status === "lost" ? closedAt : undefined,
    notes: "",
    originalId: id,
    sourceProvider: "Manual",
    activities: followedUp ? [{ id: `${id}-out`, occurredAt: daysAgo(8), direction: "outbound", channel: "call", note: "Followed up" }] : [],
    lastOutboundFollowUpAt: followedUp ? daysAgo(8) : undefined,
  };
}

describe("quote metrics", () => {
  it("calculates pending, won/lost month amounts, conversion, and no-follow-up count", () => {
    const quotes = [
      quote("open-a", 1000, "sent"),
      quote("open-b", 2500, "engaged", undefined, true),
      quote("draft", 9000, "draft"),
      quote("won-a", 4000, "won", daysAgo(2), true),
      quote("won-old", 500, "won", "2026-07-20T12:00:00.000Z", true),
      quote("lost-a", 3000, "lost", daysAgo(4), true),
    ];
    const metrics = calculateMetrics(quotes, DEMO_NOW);
    expect(metrics.pendingRevenue).toBe(3500);
    expect(metrics.wonThisMonth).toBe(4000);
    expect(metrics.lostThisMonth).toBe(3000);
    expect(metrics.wonCount).toBe(2);
    expect(metrics.lostCount).toBe(1);
    expect(metrics.conversionRate).toBeCloseTo(2 / 3);
    expect(metrics.noFollowUpCount).toBe(1);
    expect(metrics.averageFirstFollowUpHours).toBe(48);
  });

  it("updates pending and won metrics after a lifecycle transition", () => {
    const open = quote("open", 7200, "sent");
    const before = calculateMetrics([open], DEMO_NOW);
    const after = calculateMetrics([markQuoteWon(open, DEMO_NOW)], DEMO_NOW);
    expect(before.pendingRevenue).toBe(7200);
    expect(after.pendingRevenue).toBe(0);
    expect(after.wonThisMonth).toBe(7200);
    expect(after.wonCount).toBe(1);
  });
});
