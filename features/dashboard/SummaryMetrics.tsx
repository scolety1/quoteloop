import { Banknote, Clock3, CircleX, Trophy, TrendingUp, UserRoundX } from "lucide-react";
import type { QuoteMetrics } from "../../domain/types";
import { formatCurrency } from "../format";

export function SummaryMetrics({ metrics }: { metrics: QuoteMetrics }) {
  const cards = [
    { label: "Pending revenue", value: formatCurrency(metrics.pendingRevenue, true), detail: "Sent + engaged quotes", icon: Banknote, tone: "ink" },
    { label: "Won this month", value: formatCurrency(metrics.wonThisMonth), detail: `${metrics.wonCount} won total`, icon: Trophy, tone: "positive" },
    { label: "Lost this month", value: formatCurrency(metrics.lostThisMonth), detail: `${metrics.lostCount} lost total`, icon: CircleX, tone: "negative" },
    { label: "Conversion rate", value: `${Math.round(metrics.conversionRate * 100)}%`, detail: "Won / all closed quotes", icon: TrendingUp, tone: "violet" },
    { label: "Never followed up", value: String(metrics.noFollowUpCount), detail: "Open quotes with no outbound touch", icon: UserRoundX, tone: "warning" },
    { label: "Avg. first follow-up", value: metrics.averageFirstFollowUpHours === null ? "N/A" : `${Math.round(metrics.averageFirstFollowUpHours)}h`, detail: "From sent to first outbound touch", icon: Clock3, tone: "sky" },
  ];

  return (
    <section className="metric-grid" aria-label="Quote performance summary">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article className="metric-card" key={card.label}>
            <div className={`metric-icon metric-icon--${card.tone}`}><Icon size={17} strokeWidth={2} /></div>
            <div className="metric-copy"><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></div>
          </article>
        );
      })}
    </section>
  );
}