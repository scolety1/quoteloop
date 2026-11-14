import { hoursBetween, startOfMonthIso } from "./dates";
import { isPendingQuote, type Quote, type QuoteMetrics } from "./types";

export function calculateMetrics(quotes: Quote[], now: string): QuoteMetrics {
  const monthStart = new Date(startOfMonthIso(now)).getTime();
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const wonQuotes = quotes.filter((quote) => quote.status === "won");
  const lostQuotes = quotes.filter((quote) => quote.status === "lost");
  const closedCount = wonQuotes.length + lostQuotes.length;
  const pendingQuotes = quotes.filter(isPendingQuote);

  const inCurrentMonth = (iso?: string) => {
    if (!iso) return false;
    const timestamp = new Date(iso).getTime();
    return timestamp >= monthStart && timestamp < monthEnd.getTime();
  };

  const firstFollowUpHours = quotes.flatMap((quote) => {
    if (!quote.sentAt) return [];
    const firstOutbound = quote.activities
      .filter((activity) => activity.direction === "outbound" && activity.occurredAt >= quote.sentAt!)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())[0];
    return firstOutbound ? [hoursBetween(quote.sentAt, firstOutbound.occurredAt)] : [];
  });

  return {
    pendingRevenue: pendingQuotes.reduce((total, quote) => total + quote.amount, 0),
    wonThisMonth: wonQuotes.filter((quote) => inCurrentMonth(quote.wonAt)).reduce((total, quote) => total + quote.amount, 0),
    lostThisMonth: lostQuotes.filter((quote) => inCurrentMonth(quote.lostAt)).reduce((total, quote) => total + quote.amount, 0),
    wonCount: wonQuotes.length,
    lostCount: lostQuotes.length,
    conversionRate: closedCount ? wonQuotes.length / closedCount : 0,
    noFollowUpCount: pendingQuotes.filter(
      (quote) => !quote.activities.some((activity) => activity.direction === "outbound"),
    ).length,
    averageFirstFollowUpHours: firstFollowUpHours.length
      ? firstFollowUpHours.reduce((sum, hours) => sum + hours, 0) / firstFollowUpHours.length
      : null,
  };
}
