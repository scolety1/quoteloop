import { describe, expect, it } from "vitest";
import { prioritizeQuote } from "./attention";
import { DEMO_NOW, type Quote } from "./types";
import { daysAgo, daysFromNow, hoursAgo } from "../fixtures/demoQuotes";

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "test-quote",
    customerName: "Test Customer",
    serviceDescription: "Test service",
    trade: "HVAC",
    amount: 2500,
    createdAt: daysAgo(3),
    sentAt: daysAgo(1),
    status: "sent",
    notes: "",
    originalId: "EST-TEST",
    sourceProvider: "Manual",
    activities: [],
    ...overrides,
  };
}

describe("deterministic attention engine", () => {
  it("keeps a brand-new quote in WATCH", () => {
    const result = prioritizeQuote(makeQuote({ sentAt: hoursAgo(8) }), DEMO_NOW);
    expect(result.lane).toBe("WATCH");
    expect(result.reasons.join(" ")).toContain("initial wait window");
  });

  it("moves a no-follow-up quote to FOLLOW UP", () => {
    const result = prioritizeQuote(makeQuote({ sentAt: daysAgo(5) }), DEMO_NOW);
    expect(result.lane).toBe("FOLLOW_UP");
    expect(result.reasons).toContain("No follow-up recorded in 5 days");
  });

  it("moves a sufficiently stale silent quote to GOING COLD", () => {
    const lastOutbound = daysAgo(15);
    const result = prioritizeQuote(makeQuote({
      sentAt: daysAgo(21),
      lastOutboundFollowUpAt: lastOutbound,
      activities: [{ id: "out-1", occurredAt: lastOutbound, direction: "outbound", channel: "call", note: "Left voicemail", outcome: "No response" }],
    }), DEMO_NOW);
    expect(result.lane).toBe("GOING_COLD");
    expect(result.reasons).toContain("Quote is at risk of going stale");
  });

  it("makes an unanswered recent customer response CALL NOW", () => {
    const result = prioritizeQuote(makeQuote({
      sentAt: daysAgo(6),
      lastInboundResponseAt: hoursAgo(9),
      activities: [{ id: "in-1", occurredAt: hoursAgo(9), direction: "inbound", channel: "text", note: "Can you start next week?" }],
    }), DEMO_NOW);
    expect(result.lane).toBe("CALL_NOW");
    expect(result.reasons).toContain("Customer replied 9 hours ago");
    expect(result.reasons).toContain("No follow-up since customer response");
    expect(result.recommendedAction).toBe("Call customer today");
  });

  it("makes an overdue promised callback CALL NOW", () => {
    const result = prioritizeQuote(makeQuote({ sentAt: daysAgo(8), nextFollowUpAt: daysAgo(2) }), DEMO_NOW);
    expect(result.lane).toBe("CALL_NOW");
    expect(result.reasons.join(" ")).toMatch(/2 days overdue/);
  });

  it("gives closed quotes no active lane", () => {
    expect(prioritizeQuote(makeQuote({ status: "won", wonAt: DEMO_NOW }), DEMO_NOW).lane).toBeNull();
    expect(prioritizeQuote(makeQuote({ status: "lost", lostAt: DEMO_NOW }), DEMO_NOW).lane).toBeNull();
  });

  it("lets hot engagement outrank value alone", () => {
    const highValueWatch = prioritizeQuote(makeQuote({ amount: 25_000, sentAt: daysAgo(1) }), DEMO_NOW);
    const hotSmallQuote = prioritizeQuote(makeQuote({ amount: 2_000, sentAt: daysAgo(2), lastInboundResponseAt: hoursAgo(3) }), DEMO_NOW);
    expect(highValueWatch.lane).toBe("WATCH");
    expect(hotSmallQuote.lane).toBe("CALL_NOW");
    expect(hotSmallQuote.score).toBeGreaterThan(highValueWatch.score);
  });

  it("explains an expiration rule in plain language", () => {
    const result = prioritizeQuote(makeQuote({ sentAt: daysAgo(2), expiresAt: daysFromNow(2) }), DEMO_NOW);
    expect(result.lane).toBe("FOLLOW_UP");
    expect(result.reasons).toContain("Quote expires in 2 days");
  });
});
