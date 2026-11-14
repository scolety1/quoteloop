import { Eye, Flame, RefreshCw, Snowflake } from "lucide-react";
import type { AttentionLane, AttentionResult, Quote, QuoteMetrics } from "../../domain/types";
import { formatCurrency, laneLabels } from "../format";
import { QuoteCard } from "./QuoteCard";
import { SummaryMetrics } from "./SummaryMetrics";

type PrioritizedQuote = { quote: Quote; attention: AttentionResult };

const laneMeta = {
  CALL_NOW: { icon: Flame, eyebrow: "High intent", description: "Customer activity or a promise needs action today." },
  FOLLOW_UP: { icon: RefreshCw, eyebrow: "Due now", description: "The normal follow-up window has arrived." },
  GOING_COLD: { icon: Snowflake, eyebrow: "At risk", description: "Silence is putting quoted revenue in danger." },
  WATCH: { icon: Eye, eyebrow: "No rush", description: "Fresh or recently touched quotes to keep visible." },
} satisfies Record<AttentionLane, { icon: typeof Flame; eyebrow: string; description: string }>;

const laneOrder: AttentionLane[] = ["CALL_NOW", "FOLLOW_UP", "GOING_COLD", "WATCH"];

export function Dashboard({ prioritized, metrics, now, onOpen, onViewAll }: { prioritized: PrioritizedQuote[]; metrics: QuoteMetrics; now: string; onOpen: (id: string) => void; onViewAll: () => void }) {
  return (
    <>
      <SummaryMetrics metrics={metrics} />
      <section className="attention-section">
        <div className="section-heading">
          <div><span className="eyebrow">Today&apos;s worklist</span><h2>Revenue that needs attention</h2></div>
          <p>Every placement is based on visible, deterministic evidence.</p>
        </div>
        <div className="lane-grid">
          {laneOrder.map((lane) => {
            const items = prioritized.filter((item) => item.attention.lane === lane);
            const laneValue = items.reduce((sum, item) => sum + item.quote.amount, 0);
            const MetaIcon = laneMeta[lane].icon;
            return (
              <section className={`lane lane--${lane.toLowerCase()}`} key={lane} aria-labelledby={`lane-${lane}`}>
                <header className="lane__header">
                  <div className="lane__title-row">
                    <div className="lane__icon"><MetaIcon size={17} strokeWidth={2.2} /></div>
                    <div><span>{laneMeta[lane].eyebrow}</span><h3 id={`lane-${lane}`}>{laneLabels[lane]}</h3></div>
                    <b>{items.length}</b>
                  </div>
                  <p>{laneMeta[lane].description}</p>
                  <div className="lane__value"><span>Quoted value</span><strong>{formatCurrency(laneValue)}</strong></div>
                </header>
                <div className="lane__cards">
                  {items.slice(0, 5).map((item) => <QuoteCard key={item.quote.id} {...item} now={now} onOpen={onOpen} />)}
                  {items.length === 0 && <div className="lane-empty">Nothing in this lane right now.</div>}
                </div>
                {items.length > 5 && <button className="lane__more" type="button" onClick={onViewAll}>View all {items.length} quotes</button>}
              </section>
            );
          })}
        </div>
      </section>
    </>
  );
}