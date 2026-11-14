import { describe, expect, it } from "vitest";
import { prioritizeQuote } from "./attention";
import {
  logFollowUp,
  markQuoteLost,
  markQuoteWon,
  recordCustomerEngagement,
  reopenQuote,
  setNextFollowUp,
} from "./lifecycle";
import { DEMO_NOW, type Quote } from "./types";
import { daysAgo, daysFromNow } from "../fixtures/demoQuotes";

function openQuote(): Quote {
  return {
    id: "lifecycle-quote",
    customerName: "Jordan Test",
    serviceDescription: "Panel replacement",
    trade: "Electrical",
    amount: 4800,
    createdAt: daysAgo(7),
    sentAt: daysAgo(5),
    status: "sent",
    notes: "",
    originalId: "EST-LIFE",
    sourceProvider: "Manual",
    activities: [],
  };
}

describe("quote lifecycle", () => {
  it("logs a follow-up and its channel, note, and outcome", () => {
    const updated = logFollowUp(openQuote(), { channel: "call", note: "Discussed timing", outcome: "Spoke with customer", occurredAt: DEMO_NOW });
    expect(updated.lastOutboundFollowUpAt).toBe(DEMO_NOW);
    expect(updated.activities.at(-1)).toMatchObject({ direction: "outbound", channel: "call", note: "Discussed timing", outcome: "Spoke with customer" });
  });

  it("sets a promised next follow-up", () => {
    expect(setNextFollowUp(openQuote(), daysFromNow(3)).nextFollowUpAt).toBe(daysFromNow(3));
  });

  it("records customer engagement and changes sent to engaged", () => {
    const updated = recordCustomerEngagement(openQuote(), { channel: "email", note: "Asked about warranty", occurredAt: DEMO_NOW });
    expect(updated.status).toBe("engaged");
    expect(updated.lastInboundResponseAt).toBe(DEMO_NOW);
  });

  it("moves a quote to won and removes it from active lanes", () => {
    const won = markQuoteWon(openQuote(), DEMO_NOW);
    expect(won.status).toBe("won");
    expect(won.wonAt).toBe(DEMO_NOW);
    expect(prioritizeQuote(won, DEMO_NOW).lane).toBeNull();
  });

  it("moves a quote to lost with an optional reason", () => {
    const lost = markQuoteLost(openQuote(), DEMO_NOW, "Price");
    expect(lost.status).toBe("lost");
    expect(lost.lossReason).toBe("Price");
    expect(prioritizeQuote(lost, DEMO_NOW).lane).toBeNull();
  });

  it("reopens an accidentally closed quote", () => {
    const reopened = reopenQuote(markQuoteLost(openQuote(), DEMO_NOW, "Other"), DEMO_NOW);
    expect(reopened.status).toBe("sent");
    expect(reopened.lostAt).toBeUndefined();
    expect(prioritizeQuote(reopened, DEMO_NOW).lane).not.toBeNull();
  });
});
