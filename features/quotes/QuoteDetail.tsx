import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, CalendarClock, CheckCircle2, CircleX, Clock3, Database, FileText, History, Mail,
  MessageSquareText, MoreHorizontal, PhoneCall, RotateCcw, Send, UserRoundCheck, X,
} from "lucide-react";
import { atBusinessHour, formatRelativeTime, formatShortDate, toDateInput } from "../../domain/dates";
import { cadenceLabel, evaluateCadence, OUTCOME_OPTIONS } from "../../domain/cadence";
import { deferQuote, logFollowUpAttempt, markQuoteLost, markQuoteWon, recordCustomerEngagement, reopenQuote, setNextFollowUp } from "../../domain/lifecycle";
import { isActiveQuote, type AttentionResult, type FollowUpChannel, type FollowUpOutcomeCode, type Quote } from "../../domain/types";
import { formatCurrency, laneLabels, statusLabels } from "../format";

const channelOptions: { value: FollowUpChannel; label: string; icon: typeof PhoneCall }[] = [
  { value: "call", label: "Call", icon: PhoneCall },
  { value: "text", label: "Text", icon: MessageSquareText },
  { value: "email", label: "Email", icon: Mail },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

function ActivityIcon({ direction, channel }: { direction: string; channel: string }) {
  if (direction === "inbound") return <ArrowDownLeft size={15} />;
  if (channel === "call") return <PhoneCall size={15} />;
  if (channel === "email") return <Mail size={15} />;
  if (channel === "text") return <MessageSquareText size={15} />;
  if (direction === "system") return <History size={15} />;
  return <Send size={15} />;
}

export function QuoteDetail({ quote, attention, now, onClose, onChange }: {
  quote: Quote;
  attention: AttentionResult;
  now: string;
  onClose: () => void;
  onChange: (quote: Quote, confirmation: string) => void;
}) {
  const [channel, setChannel] = useState<FollowUpChannel>("call");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<FollowUpOutcomeCode>("no_answer");
  const [deferReason, setDeferReason] = useState("");
  const [showDefer, setShowDefer] = useState(false);
  const cadence = evaluateCadence(quote, now);
  const [nextDate, setNextDate] = useState(toDateInput(quote.nextFollowUpAt));
  const [lossReason, setLossReason] = useState(quote.lossReason ?? "");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const timeline = useMemo(() => {
    const systemEvents = [
      { id: `${quote.id}-created`, occurredAt: quote.createdAt, direction: "system", channel: "status", kind: "lifecycle", note: "Quote created" },
      ...(quote.sentAt ? [{ id: `${quote.id}-sent`, occurredAt: quote.sentAt, direction: "system", channel: "status", kind: "lifecycle", note: "Quote sent to customer" }] : []),
    ];
    return [...quote.activities, ...systemEvents].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [quote]);

  const nextFollowUpIso = nextDate ? atBusinessHour(nextDate) : undefined;

  function handleLogFollowUp() {
    onChange(logFollowUpAttempt(quote, { channel, note, outcomeCode: outcome, occurredAt: now, nextFollowUpAt: nextFollowUpIso }), "Follow-up logged / cadence recalculated");
    setNote("");
  }
  function handleDefer() {
    if (!nextFollowUpIso || !deferReason.trim()) return;
    onChange(deferQuote(quote, { until: nextFollowUpIso, reason: deferReason, occurredAt: now }), "Quote deferred until the scheduled date");
    setShowDefer(false); setDeferReason("");
  }

  function handleEngagement() {
    onChange(recordCustomerEngagement(quote, { channel, note: note || "Customer responded and the conversation is active", occurredAt: now }), "Customer engagement recorded");
    setNote("");
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="quote-drawer" role="dialog" aria-modal="true" aria-labelledby="quote-detail-title">
        <header className="drawer-header">
          <div>
            <span className="drawer-kicker">{quote.originalId} / {quote.sourceProvider}</span>
            <h2 id="quote-detail-title">{quote.customerName}</h2>
            <p>{quote.serviceDescription}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close quote detail"><X size={20} /></button>
        </header>

        <div className="drawer-scroll">
          <section className="quote-overview">
            <div><span>Quote value</span><strong>{formatCurrency(quote.amount)}</strong></div>
            <div><span>Lifecycle</span><strong><span className={`status-pill status-pill--${quote.status}`}>{statusLabels[quote.status]}</span></strong></div>
            <div><span>Trade</span><strong>{quote.trade}</strong></div>
          </section>

          {attention.lane ? (
            <section className={`attention-panel attention-panel--${attention.lane.toLowerCase()}`}>
              <div className="attention-panel__top">
                <div><span>Attention</span><strong>{laneLabels[attention.lane]}</strong></div>
                <div className="priority-badge"><span>Priority</span><b>{attention.score}</b><small>/ 100</small></div>
              </div>
              <ul>{attention.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <div className="recommended-action"><PhoneCall size={16} /><span><small>Recommended next action</small><strong>{attention.recommendedAction}</strong></span></div>
            </section>
          ) : (
            <section className="attention-panel attention-panel--closed">
              <div className="attention-panel__top"><div><span>Attention</span><strong>No active follow-up</strong></div></div>
              <p>This quote is closed and has been removed from the active lanes.</p>
            </section>
          )}

          <section className="detail-section">
            <div className="detail-section__heading"><FileText size={17} /><h3>Quote details</h3></div>
            <div className={`cadence-summary cadence-summary--${cadence.state}`}><strong>{cadenceLabel(cadence.state)}</strong><span>{cadence.reason}</span><small>{cadence.attemptCount} structured attempt{cadence.attemptCount === 1 ? "" : "s"} / {cadence.recommendedAction}</small></div>
            <dl className="detail-grid">
              <div><dt>Created</dt><dd>{formatShortDate(quote.createdAt)}</dd></div>
              <div><dt>Sent</dt><dd>{formatShortDate(quote.sentAt)}</dd></div>
              <div><dt>Expires</dt><dd>{formatShortDate(quote.expiresAt)}</dd></div>
              <div><dt>Last inbound</dt><dd>{quote.lastInboundResponseAt ? formatRelativeTime(quote.lastInboundResponseAt, now) : "None"}</dd></div>
              <div><dt>Last outbound</dt><dd>{quote.lastOutboundFollowUpAt ? formatRelativeTime(quote.lastOutboundFollowUpAt, now) : "Never"}</dd></div>
              <div><dt>Next follow-up</dt><dd>{formatShortDate(quote.nextFollowUpAt)}</dd></div>
            </dl>
            {quote.notes && <div className="quote-note"><strong>Internal note</strong><p>{quote.notes}</p></div>}
            {quote.status === "won" && <div className="closed-note closed-note--won"><CheckCircle2 size={16} /> Won {formatShortDate(quote.wonAt)}</div>}
            {(quote.customerEmail || quote.customerPhone) && <div className="quote-note"><strong>Customer contact from source</strong><p>{[quote.customerEmail, quote.customerPhone].filter(Boolean).join(" / ")}</p></div>}
            {quote.status === "lost" && <div className="closed-note closed-note--lost"><CircleX size={16} /> Lost {formatShortDate(quote.lostAt)}{quote.lossReason ? ` - ${quote.lossReason}` : ""}</div>}
          </section>

          {quote.provenance && (
            <section className="detail-section provenance-section">
              <div className="detail-section__heading"><Database size={17} /><h3>Source provenance</h3><span>CSV evidence</span></div>
              <dl className="detail-grid">
                <div><dt>File</dt><dd>{quote.provenance.filename}</dd></div>
                <div><dt>Source row</dt><dd>{quote.provenance.sourceRow}</dd></div>
                <div><dt>Imported</dt><dd>{new Date(quote.provenance.importedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}</dd></div>
                <div><dt>Source</dt><dd>{quote.provenance.sourceName}</dd></div>
                <div><dt>External ID</dt><dd>{quote.provenance.externalId ?? "Fingerprint only"}</dd></div>
                <div><dt>Raw status</dt><dd>{quote.provenance.rawStatus ?? "Blank"}</dd></div>
              </dl>
              <details className="provenance-raw"><summary>Inspect preserved raw row</summary><div>{Object.entries(quote.provenance.rawValues).map(([key, value]) => <div key={key}><span>{key}</span><code>{value || "(blank)"}</code></div>)}</div></details>
            </section>
          )}

          {isActiveQuote(quote) ? (
            <section className="detail-section action-section">
              <div className="detail-section__heading"><Send size={17} /><h3>Log activity</h3></div>
              <p className="form-help">Record what already happened. QuoteLoop will never contact the customer.</p>
              <div className="channel-picker" aria-label="Follow-up channel">
                {channelOptions.map((option) => {
                  const Icon = option.icon;
                  return <button className={channel === option.value ? "active" : ""} type="button" key={option.value} onClick={() => setChannel(option.value)}><Icon size={15} />{option.label}</button>;
                })}
              </div>
              <label className="field-label">Note or outcome<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What happened? Keep it short and useful." rows={3} /></label>
              <div className="form-row">
                <label className="field-label">Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value as FollowUpOutcomeCode)}>{OUTCOME_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                <label className="field-label">Promised next follow-up<input type="date" min={now.slice(0, 10)} value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label>
              </div>
              <div className="action-buttons">
                <button className="button button--primary" type="button" onClick={handleLogFollowUp}><Send size={16} /> Log follow-up</button>
                <button className="button button--secondary" type="button" onClick={handleEngagement}><UserRoundCheck size={16} /> Customer replied</button>
                <button className="button button--ghost" type="button" onClick={() => onChange(setNextFollowUp(quote, nextFollowUpIso, now), nextFollowUpIso ? "Next follow-up saved" : "Next follow-up cleared")}><CalendarClock size={16} /> Save date</button><button className="button button--ghost" type="button" onClick={() => setShowDefer((value) => !value)}><CalendarClock size={16} /> Defer / snooze</button>
              </div>
              {showDefer && <div className="defer-form"><strong>Legitimate deferral</strong><p>Choose a future date and record why this quote should stay out of today&apos;s work.</p><input aria-label="Deferral reason" value={deferReason} onChange={(event) => setDeferReason(event.target.value)} placeholder="Customer requested Thursday / project postponed..."/><button className="button button--secondary" type="button" disabled={!nextFollowUpIso || !deferReason.trim()} onClick={handleDefer}>Save deferral</button></div>}

              <div className="lifecycle-actions">
                <div><strong>Close this quote</strong><span>Closed quotes leave every attention lane.</span></div>
                <div className="close-buttons">
                  <button className="button button--won" type="button" onClick={() => onChange(markQuoteWon(quote, now), "Quote marked won")}><CheckCircle2 size={16} /> Mark won</button>
                  <select aria-label="Loss reason" value={lossReason} onChange={(event) => setLossReason(event.target.value)}><option value="">Loss reason (optional)</option><option>Price</option><option>Competitor</option><option>Project postponed</option><option>No response</option><option>Scope changed</option><option>Other</option></select>
                  <button className="button button--lost" type="button" onClick={() => onChange(markQuoteLost(quote, now, lossReason), "Quote marked lost")}><CircleX size={16} /> Mark lost</button>
                </div>
              </div>
            </section>
          ) : (
            <section className="reopen-panel">
              <div><RotateCcw size={18} /><span><strong>Closed by mistake?</strong><small>Reopening restores the quote to active follow-up.</small></span></div>
              <button className="button button--secondary" type="button" onClick={() => onChange(reopenQuote(quote, now), "Quote reopened")}><RotateCcw size={16} /> Reopen quote</button>
            </section>
          )}

          <section className="detail-section timeline-section">
            <div className="detail-section__heading"><Clock3 size={17} /><h3>Activity timeline</h3><span>{timeline.length} events</span></div>
            <ol className="timeline">
              {timeline.map((activity) => (
                <li key={activity.id}>
                  <div className={`timeline-icon timeline-icon--${activity.direction}`}><ActivityIcon direction={activity.direction} channel={activity.channel} /></div>
                  <div><div><strong>{activity.note}</strong><time>{formatShortDate(activity.occurredAt)}</time></div><span>{activity.kind ? activity.kind.replaceAll("_", " ") : activity.direction === "inbound" ? "Customer engagement" : activity.direction === "outbound" ? `${activity.channel} follow-up` : "Quote update"}{"outcome" in activity && activity.outcome ? ` - ${activity.outcome}` : ""}</span></div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
