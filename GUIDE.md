# QuoteLoop

QuoteLoop is a focused quote/estimate follow-up and revenue-recovery workspace for trades and field-service businesses. It answers: who needs attention, why, what happened previously, and how much quoted revenue is still exposed.

It deliberately is **not** a general CRM. QuoteLoop does not send outreach, dispatch work, invoice customers, manage employees, or contact production systems.

## Architecture

- `domain/` — canonical quote model, pure lifecycle transitions, deterministic attention rules, metrics, dates, and manual-quote creation
- `importing/` — CSV parsing, header detection, normalization/validation, preview classification, duplicate reconciliation, and commit logic
- `repositories/` — `QuoteRepository` plus the browser-local quote store and import ledger
- `fixtures/` — 42 deterministic Mission 1 quote histories anchored to August 12, 2026
- `public/samples/` — downloadable deterministic CSV fixtures for valid, messy, bad, duplicate, ambiguous, and malformed inputs
- `features/` — dashboard, quote register/detail, import workspace, provenance, history, and local action workflows

The import boundary is deliberately separate from the canonical model:

`CSV source row → RawQuoteRecord → deterministic normalization + findings → canonical Quote → QuoteRepository`

CSV-specific evidence stays in the optional `Quote.provenance` object. Prioritization and metrics only consume canonical quotes, so a later Jobber or other source adapter can reuse the normalization/reconciliation contract without changing revenue rules.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The local URL is printed by the development server.

## CSV import workflow

The Import view accepts choose/drop locally and performs parsing before any repository mutation. It shows detected mapping, file and row findings, new/update/duplicate/review/rejected decisions, the total parseable value in the file, and the narrower amount of **new pending revenue** that will be added. Only checked `create` and `update` rows are committed after **Confirm import**. Review and rejected rows cannot be selected in V1.

The mapping panel recognizes common deterministic aliases such as customer/client, quote/estimate ID, amount/total, created/sent dates, and quote/estimate status. When multiple headers match one field, the mapping remains unset until the user chooses it; no column is silently preferred.

### QuoteLoop standard fields

Core fields are `customer_name`, `job_description`, `quoted_amount`, `created_date`, and `status`. Supported optional fields are:

- `quote_id`, `sent_date`, `expiration_date`, `closed_date`
- `customer_email`, `customer_phone`
- `last_customer_response_date`, `last_follow_up_date`, `next_follow_up_date`
- `notes`, `source`, `source_id`, and `trade`

Download the canonical example at [`public/samples/A-clean-standard.csv`](public/samples/A-clean-standard.csv).

### Normalization and validation

Money accepts plain dollars with up to two decimals and optional `$`/thousands separators, for example `8400`, `8400.00`, `$8,400`, and `$8,400.00`. Malformed or non-positive amounts are rejected rather than converted to zero.

Dates accept only `YYYY-MM-DD`, US `M/D/YYYY` or `M-D-YYYY`, and ISO timestamps with an explicit timezone. Calendar dates are checked strictly; optional blanks stay blank. Chronology rejects sent-before-created, expiration-before-sent/created, and closed-before-created.

Status mapping is:

- `draft` → draft
- `sent`, `open`, `pending` → sent
- `engaged`, `responded` → engaged
- `accepted`, `approved`, `won` → won
- `declined`, `rejected`, `lost` → lost
- `expired` → expired

The raw status and every raw cell remain in provenance. Unknown statuses require review. Missing required values, invalid money/dates, and impossible chronology are rejected. Incomplete but usable evidence—such as no stable source ID or no closed timestamp—produces a warning. A sent/engaged row without a sent date requires review because follow-up age would be untrustworthy.

Every finding records a code, severity (`warning`, `review`, or `error`), message, source row, and field when applicable. Row dispositions are `ready`, `ready_with_warning`, `needs_review`, and `rejected`.

## Duplicate and merge policy

1. Match by normalized source/provider plus stable external ID when both exist.
2. Without an ID, use a conservative fingerprint of source, customer, description, amount, and created date.
3. When customer + amount + created date match but identity/fingerprint does not, require review as a possible duplicate.
4. Customer name alone or amount alone never creates a duplicate decision.

An unchanged identity is skipped. Changed source-controlled values become an update. Columns omitted by a partial re-import do not clear earlier values. If a canonical field has changed locally since the prior source snapshot and the new source disagrees, the row requires review instead of overwriting it.

Updates preserve all local activities. Latest inbound/outbound evidence is retained, and a locally changed promised follow-up date survives partial re-import. Source snapshots are merged so future conflicts remain detectable. This makes identical re-imports financially idempotent.

## Provenance and import history

Each imported quote records CSV filename, source row, import timestamp/ID, source name, external ID when present, raw status, all raw cell values, stable fingerprint, and the last canonical source snapshot. Basic provenance and the full preserved raw row are inspectable in the normal quote detail drawer.

The local import ledger records filename/time, total rows, created/updated/skipped/review/rejected counts, and import ID. **Reset data** clears both imported/manual quotes and the ledger, restoring the canonical 42-quote fixture.

## Manual quote creation

The Import view also has a compact manual form for customer, job description, amount, created/sent dates, lifecycle, trade, and notes. Manual quotes enter the same canonical repository, register, metrics, and deterministic priority engine as CSV and demo quotes.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run lint
```

`npm run verify` runs tests, type checking, and the production build in sequence. Import coverage includes RFC-style quoted fields/newlines, malformed CSV, aliases/ambiguity, normalization, all important validation classes, exact and changed re-imports, source-less fingerprints, possible duplicates, local activity preservation, repository persistence, dashboard prioritization, UI preview-before-mutation, provenance, manual entry, and financial idempotency.

## Sample fixtures

- `A-clean-standard.csv` — 12 valid standard rows
- `B-messy-recoverable.csv` — aliases, quoted commas, blanks, money variants, dates, and recognized statuses
- `C-bad-data.csv` — malformed money, impossible/missing values, unknown status, and inconsistent dates
- `D-duplicate-reimport.csv` — unchanged, updated, and new stable source IDs
- `E-ambiguous-columns.csv` — multiple plausible headers that must be mapped explicitly
- `F-malformed.csv` — syntactically malformed quoted CSV

## Known limitations

This remains a local, single-device demo whose browser session uses SystemClock; tests can inject FixedClock. V1 does not repair values inline, auto-resolve review rows, infer locale-specific dates/currencies, reconcile concurrent edits, import attachments, or connect to live Jobber, ServiceTitan, Housecall Pro, or QuickBooks accounts. Import history is a lightweight browser ledger, not an immutable compliance log. Closed rows without a supplied closed date remain canonical closed quotes but are intentionally excluded from month-specific won/lost revenue.

## Daily recovery architecture

Mission 3 separates four concepts that are intentionally related but not interchangeable:

1. **Lifecycle** — draft, sent, engaged, won, lost, or expired.
2. **Cadence** — not due, due soon, due, overdue, deferred, or suppressed.
3. **Attention** — CALL NOW, FOLLOW UP, GOING COLD, or WATCH.
4. **Today’s Work** — only actionable CALL NOW, OVERDUE, DUE TODAY, and GOING COLD records, ordered by practical urgency.

The deterministic flow is `source adapter → canonical quote/history → lifecycle → cadence policy → attention → recovery queue → local action → canonical history → recompute → analytics`. Neither the cadence nor attention layer sends outreach.

### Clock and date model

`domain/clock.ts` provides `SystemClock` for the browser runtime and `FixedClock` for deterministic tests. Manual records, imports, lifecycle events, and recovery actions receive the injected runtime instant. Demo fixtures are generated by shifting their canonical August 12, 2026 histories to the repository clock’s anchor, so their relative timing remains useful without making tests rot.

Date-only promises are normalized to 15:00 UTC. “Today,” month boundaries, callback due dates, and date comparisons use explicit UTC calendar-day helpers; timestamps retain full ISO precision. Cadence thresholds live in `domain/cadence.ts` under `CADENCE_RULES`.

### Structured follow-up attempts

A local attempt records quote ID, timestamp, channel, structured outcome, optional note, direct-contact flag, optional next-follow-up timestamp, activity kind, and local provenance. Supported outcome codes are:

- `no_answer`, `voicemail_left`, `message_sent`
- `still_considering`, `needs_more_time`, `callback_requested`
- `revision_requested`, `project_postponed`, `customer_interested`
- `verbally_accepted`, `declined`, `wrong_contact`, `other`

Terminal-sounding outcomes do not silently close a quote. Won/lost transitions require an explicit `closeAs` decision or the existing lifecycle controls.

### Cadence and next-step policy

New sent quotes receive a three-day breathing period. No-answer sequences schedule attempts after 3, 4, then 7 days. Active conversations default to five days; customer interest defaults to two. Explicit callback/postponement dates override generic cadence. Future deferrals are suppressed until their chosen date, become due on that UTC day, and overdue afterward. Revision requests and unreachable contacts create visible seller-action blockers. Recent unanswered inbound activity is due immediately. Won, lost, expired, and unsent drafts are suppressed.

A deferral requires a future date and reason. It creates an auditable local event and never deletes activity. There is no indefinite generic snooze.

### Daily progress

A quote is handled today only when today’s canonical history contains a structured follow-up attempt, a legitimate deferral, or a lifecycle event. The progress surface reports the union of handled and currently actionable records as the working set, plus handled count, remaining count, and remaining quoted value. It never labels a call as recovered revenue.

### Recovery analytics

`domain/recoveryAnalytics.ts` calculates:

- pending, won, and lost quoted value; open counts; conversion rate
- structured follow-up coverage among pending quotes
- average and median elapsed time from sent timestamp to first structured attempt
- overdue cadence count and quoted value
- pending value/count in 0–3, 4–7, 8–14, 15–30, and 30+ day buckets
- structured outcome counts and recorded loss-reason counts
- median attempt count and quote age at close for won versus lost records

Leakage insights are computed from current records: never-followed-up value, overdue callbacks, old pending-revenue share, stale one-attempt quotes, median first-follow-up time, and missing loss reasons. Wording is explicitly descriptive and non-causal; synthetic demo records are labeled.

### Persistence migration

Browser state now uses a versioned `quoteloop-state-v3` envelope containing quotes and the import ledger. On first load, `LocalQuoteRepository` migrates the Mission 2 quote array and import-history key, retaining IDs, provenance, and activities. Legacy outbound activities receive deterministic structured outcome codes plus `migration` provenance. Re-import reconciliation continues to merge source data while preserving every local operational event.
## Mission 4 adversarial evaluation

Run `npm run eval:recovery` for the frozen 203-case recovery benchmark, four ranking fixtures, and 90-day simulation. See [docs/mission-4-evaluation.md](docs/mission-4-evaluation.md) for baseline-versus-candidate evidence and limitations.
