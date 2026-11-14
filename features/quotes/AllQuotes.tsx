import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronRight, Search } from "lucide-react";
import { daysBetween } from "../../domain/dates";
import { prioritizeQuote } from "../../domain/attention";
import { isActiveQuote, type Quote } from "../../domain/types";
import { formatCurrency, laneLabels, statusLabels } from "../format";

type Filter = "all" | "open" | "won" | "lost";
type Sort = "priority" | "value" | "age" | "customer";

export function AllQuotes({ quotes, now, onOpen }: { quotes: Quote[]; now: string; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("priority");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return quotes
      .filter((quote) => {
        if (filter === "open" && !isActiveQuote(quote)) return false;
        if (filter === "won" && quote.status !== "won") return false;
        if (filter === "lost" && quote.status !== "lost") return false;
        return !normalized || `${quote.customerName} ${quote.serviceDescription} ${quote.trade}`.toLowerCase().includes(normalized);
      })
      .map((quote) => ({ quote, attention: prioritizeQuote(quote, now) }))
      .sort((a, b) => {
        if (sort === "value") return b.quote.amount - a.quote.amount;
        if (sort === "age") return daysBetween(b.quote.createdAt, now) - daysBetween(a.quote.createdAt, now);
        if (sort === "customer") return a.quote.customerName.localeCompare(b.quote.customerName);
        return b.attention.score - a.attention.score;
      });
  }, [filter, now, query, quotes, sort]);

  return (
    <section className="quotes-view">
      <div className="section-heading section-heading--quotes">
        <div><span className="eyebrow">Quote register</span><h2>All quotes</h2></div>
        <p>{visible.length} of {quotes.length} quotes shown</p>
      </div>
      <div className="table-controls">
        <label className="search-control">
          <Search size={17} aria-hidden="true" /><span className="sr-only">Search quotes</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or service..." />
        </label>
        <div className="filter-tabs" aria-label="Filter quotes">
          {(["all", "open", "won", "lost"] as Filter[]).map((option) => (
            <button className={filter === option ? "active" : ""} type="button" key={option} onClick={() => setFilter(option)}>{option}</button>
          ))}
        </div>
        <label className="sort-control">
          <ArrowUpDown size={15} aria-hidden="true" /><span className="sr-only">Sort quotes</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="priority">Priority</option><option value="value">Value</option><option value="age">Age</option><option value="customer">Customer</option>
          </select>
        </label>
      </div>
      <div className="quote-table-wrap">
        <table className="quote-table">
          <thead><tr><th>Customer</th><th>Service</th><th>Status</th><th>Attention</th><th>Age</th><th className="numeric">Value</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>
            {visible.map(({ quote, attention }) => (
              <tr key={quote.id} onClick={() => onOpen(quote.id)}>
                <td><button type="button" onClick={() => onOpen(quote.id)}>{quote.customerName}<span>{quote.sourceProvider} / {quote.originalId}</span></button></td>
                <td>{quote.serviceDescription}<span>{quote.trade}</span></td>
                <td><span className={`status-pill status-pill--${quote.status}`}>{statusLabels[quote.status]}</span></td>
                <td>{attention.lane ? <span className={`lane-pill lane-pill--${attention.lane.toLowerCase()}`}>{laneLabels[attention.lane]} / {attention.score}</span> : <span className="muted">Closed</span>}</td>
                <td>{Math.floor(daysBetween(quote.createdAt, now))}d</td>
                <td className="numeric"><strong>{formatCurrency(quote.amount)}</strong></td>
                <td><ChevronRight size={17} aria-hidden="true" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <div className="table-empty">No quotes match those filters.</div>}
      </div>
    </section>
  );
}