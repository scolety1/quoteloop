import { ArrowUpRight } from "lucide-react";
import { daysBetween } from "../../domain/dates";
import type { AttentionResult, Quote } from "../../domain/types";
import { formatCurrency, quoteInitials, statusLabels } from "../format";

type Props = { quote: Quote; attention: AttentionResult; now: string; onOpen: (id: string) => void };

export function QuoteCard({ quote, attention, now, onOpen }: Props) {
  const daysOpen = quote.sentAt ? Math.floor(daysBetween(quote.sentAt, now)) : 0;
  return (
    <button className="quote-card" type="button" onClick={() => onOpen(quote.id)} aria-label={`Open quote for ${quote.customerName}`}>
      <div className="quote-card__topline">
        <div className="quote-avatar" aria-hidden="true">{quoteInitials(quote.customerName)}</div>
        <div className="quote-card__identity"><strong>{quote.customerName}</strong><span>{quote.trade} / {statusLabels[quote.status]}</span></div>
        <span className="quote-score" aria-label={`Priority score ${attention.score}`}>{attention.score}</span>
      </div>
      <div className="quote-card__amount-row"><strong>{formatCurrency(quote.amount)}</strong><span>{quote.sentAt ? `${daysOpen}d since sent` : "Not sent"}</span></div>
      <p className="quote-card__service">{quote.serviceDescription}</p>
      <div className="quote-card__reason"><span className="reason-dot" aria-hidden="true" /><span>{attention.reasons[0]}</span></div>
      <div className="quote-card__action"><span>{attention.recommendedAction}</span><ArrowUpRight size={15} strokeWidth={2.2} aria-hidden="true" /></div>
    </button>
  );
}