# MVP foundation — completed and superseded plan

Archived: 10 August 2026

Source plan: `docs/BACKLOG.md` and `docs/BLUEPRINT.md`, updated 9 August 2026

Implementation reference: commit `9fdf7ab` (`feat: add home stock and stock-aware planning`)

This is a completion record, not an assertion that every edge case is finished. The implementation established the intended feature foundation; known correctness and release gaps were carried into the active roadmap rather than hidden by archiving the old prompts.

## Repository and delivery foundation

Completed:

- Git repository connected to `https://github.com/sanjaykp1/familytable.git`
- Node.js 24 pinned in `.nvmrc` and `package.json`
- root setup and data-safety documentation
- GitHub Actions workflow running the full `npm run check` quality gate
- source, tests, documentation and lockfiles committed without generated output or credentials

Carried forward:

- Cloudflare Pages production deployment and stable URL were part of the old Phase 0 but are not evidenced in the repository. They are an active release gate in `docs/BACKLOG.md`.

## Application setup and foundation

The superseded Prompts 1–3 established:

- React, TypeScript and Vite project structure
- ESLint, Prettier, Vitest, design tokens, manifest and service worker
- core domain entities and planning/shopping functions
- versioned local-storage repository, migrations and JSON backup/restore
- application provider, shell, error boundary, toast pattern and shared UI primitives
- weekly planning with navigation, generation, locking, replacement and cooked state

## Home Stock and stock-aware shopping

The superseded Prompts 4A–4B established:

- persistent `HomeStockItem` data in schema-versioned `AppState`
- food and household kinds, locations, zero and unknown quantities, archive state and `Use soon`
- shopping lines that preserve gross recipe need, confirmed stock applied, remaining buy quantity and explicit sources
- Home Stock management under Shop without adding a fifth primary navigation destination
- manual household shopping items and zero-stock `Add to shop`
- conservative review behavior for exact-name matches with unknown or incompatible units

Known hardening gap carried forward:

- shopping and stock planning still contain separate exact-name and exact-unit matching implementations. Canonical aliases, safe metric conversions, multiple-row allocation parity and one shared review contract are active work.

## Replenishment suggestions

The superseded Prompt 4C established:

- optional reorder point and target quantity
- reviewable accept, dismiss and disable actions
- target-minus-current suggestions, including bananas at zero
- overlap behavior that buys the larger of recipe shortfall and top-up rather than summing them
- persistence and backup coverage for replenishment state

## Stock-only and use-soon planning

The superseded Prompt 4D established:

- strict evaluation of saved recipes against confirmed Home Stock
- structured reasons for missing, insufficient, unknown, incompatible and ambiguous stock
- use-soon ranking and must-use planning constraints
- deterministic generation into unlocked recipe nights
- a bounded `Cook from what I have` interface
- no automatic stock mutation from planning

Known regression gap carried forward:

- stock-only generation allocates generated meals against the full confirmed balance but does not first reserve ingredients required by locked recipe meals. The active roadmap requires a regression test and ledger reservation before release.

## Still deliberately deferred

- backend and accounts
- household synchronization
- Oda cart or order integration
- AI-generated recipes
- recipe URL import
- large component refactor

The maintained plan begins at [../BACKLOG.md](../BACKLOG.md).
