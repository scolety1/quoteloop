# Mission 4 adversarial evaluation

## Verdict

GREEN for the current local V1 scope. This is synthetic and black-box product evidence, not field evidence and not evidence that follow-up causes conversion.

## Frozen benchmark design

Mission 3 was frozen at `67e9d2f40282023fd250ae7c5ae13bf88aff7c2c` before production behavior changed. The deterministic corpus contains 203 labeled cases across 29 families, with seven amount/trade perturbations per family and 29 holdouts. Expectations describe actionability, suppression, acceptable lanes/cadence, required or forbidden evidence, and critical invariants without calling production prioritization to generate labels.

Families cover drafts/new/sent/overdue work, repeated attempts, voicemail, inbound engagement, callbacks, 30/60/90-day postponement, due deferrals, reopening, revisions/contact repair, expiration, closed histories, value-versus-timing attacks, sparse timestamps, and month/year/date-only boundaries. Four queue fixtures compare inbound intent, promised callbacks, seller actions, routine cadence, cold work, and high-value fresh estimates.

Run `npm run eval:recovery`. Machine-readable evidence is stored in `evaluation/results/mission-3-baseline.json` and `evaluation/results/mission-4-candidate.json`.

## Baseline and candidate

| Measure | Mission 3 baseline | Mission 4 candidate |
| --- | ---: | ---: |
| Cases / families / holdouts | 203 / 29 / 29 | 203 / 29 / 29 |
| Actionable recall | 93.8% | 100.0% |
| Non-actionable precision | 92.3% | 100.0% |
| Lane correctness | 96.5% | 100.0% |
| Cadence correctness | 100.0% | 100.0% |
| Evidence correctness | 100.0% | 100.0% |
| False urgent / missed action | 7 / 7 | 0 / 0 |
| Critical distinct affected cases | 7 | 0 |
| Ranking | 4/4 | 4/4 |

The initial calibration run used an overly exact expectation for a tomorrow expiry; it was corrected from `due` to the behaviorally valid set including `due_soon` before the official baseline was frozen. Production was untouched during calibration.

## Stateful simulation

A deterministic six-quote book advances for 90 days (540 quote-day observations). It covers routine no-answer cadence, a 30-day deferral, a future callback, inbound re-engagement, win, and loss. Candidate result: zero zombies, zero daily thrashing, zero early callbacks, and zero closed quotes in active work.

## Confirmed defects and fixes

1. A past expiration with stale source status `sent` entered active work. Cadence now conservatively suppresses it and asks for lifecycle review.
2. An expiration inside the existing three-day window could be explained as urgent but omitted from Today’s Work. Expiration now becomes an actionable deadline using the existing threshold; no timing constants changed.
3. Aging buckets overlapped at 3/7/14/30 days. Whole-day inclusive boundaries are now mutually exclusive.
4. Impossible pre-send outbound history silently produced a precise zero-hour first-follow-up metric. Invalid chronology is now excluded from timing aggregates.
5. Corrupt/unsupported V3 storage silently fell back. Raw bytes are now quarantined and an integrity error is emitted before fallback; they are never interpreted as business truth.
6. Owner analytics lacked an obvious evidence-to-work path. Overdue analytics now links directly to the quote register.

No cadence thresholds, money weights, or priority score constants changed. The fixes align existing policy layers and strengthen integrity.

## Integrity attacks

Controlled tests verify exact pending/won/lost revenue, conversion denominator, coverage, outcomes, loss reasons, aging boundaries, daily handled/remaining value, closed suppression, impossible chronology, stable-ID reconciliation, legitimate same-customer separate quotes, local activity preservation, duplicate avoidance, partial legacy migration, and corrupt-storage quarantine. Existing Mission 2 source-update/conflict and exact re-import tests remain green.

## Black-box audit

Desktop and 390×844 were exercised as a solo contractor, office manager, and owner. The queue is scannable, evidence is visible, fast logging takes one expansion plus save, callback/deferral movement is consistent, the layout has no page overflow, focus-visible styling is present, controls and forms expose labels, and state is not color-only. The audit added analytics drill-down. Won/lost work left the queue, mutations reached analytics, refresh preserved handling, reset restored 42 canonical quotes, and no current-console errors remained after a clean server restart.

## Remaining weaknesses

- Results are synthetic and deterministic; they do not validate real provider export variance or conversion impact.
- Storage remains single-device localStorage; quarantine prevents reinterpretation but is not a shared recovery console.
- UTC date-only policy is explicit, but local-business timezone configuration is not yet supported.
- Analytics drill-down opens the register rather than a pre-filtered overdue slice.
- The corpus is policy-focused, not a substitute for anonymized field-history review.

QuoteLoop is ready for the next phase of read-only real-source and shared-storage validation, provided those boundaries are validated before production use.