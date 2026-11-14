# QuoteLoop

A local-only quote follow-up demo for trades and field-service workflows. It explains which quotes need attention and records actions performed elsewhere, without sending messages or claiming that follow-up caused revenue.

## What works today

CSV mapping and preview, stable-source deduplication, a daily recovery queue, callbacks/deferrals, explicit won/lost/reopen transitions, local persistence and descriptive metrics. All bundled people, quotes and contacts are fictional.

## Contribution and attribution

A project by [Spencer Colety](https://github.com/scolety1), developed with AI assistance. The source history records `scolety1`; that does not establish unaided authorship of each line. The source baseline and publication changes are in [PROVENANCE.md](PROVENANCE.md). Third-party dependencies retain their own licenses.

## Run it

Node.js 22.13+ (verified with Node 24.15).

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Use the printed local URL. Try **Today’s Work**, **Analytics**, and **Import** with the included sample CSVs. The build tooling uses a local Cloudflare worker adapter with null bindings; no Cloudflare account or deployment is needed. Dependencies/fonts may require network access during installation/build.

## Start reading here

- [Lifecycle](domain/lifecycle.ts), [cadence](domain/cadence.ts) and [recovery queue](domain/recoveryQueue.ts).
- [CSV normalization](importing/normalize.ts) and [import reconciliation](importing/importService.ts).
- [Repository boundary](repositories/QuoteRepository.ts) and [adversarial evaluation](evaluation/evaluator.ts).

## Verification and limits

Verified November 14, 2026: 101 tests, TypeScript checking and a fresh production build passed. The date-dependent callback regression was reproduced before the clock-injection repair and passed afterward.

No outreach, invoicing, authentication, shared database or production integrations. The preserved SQLite/API experiment and proposed CLC handoff are not included. Browser storage is not a production backup or multi-user system. The Vinext runtime is a beta dependency.

[Technical guide](GUIDE.md)
