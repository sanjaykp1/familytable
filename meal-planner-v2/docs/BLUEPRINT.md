# The Family Table v2 — architecture blueprint

Updated: 10 August 2026

This document describes the architecture that exists and the next three implementation prompts. Completed setup and Home Stock prompts are preserved in [archive/MVP_FOUNDATION_COMPLETED.md](./archive/MVP_FOUNDATION_COMPLETED.md); active product priority and release gates live in [BACKLOG.md](./BACKLOG.md).

## A. Tech stack

- **React, TypeScript and Vite:** a small mainstream client stack with type-safe domain logic and a static production build.
- **Local storage behind `MealPlannerRepository`:** keeps the one-household MVP fast and offline while preserving a replacement boundary for IndexedDB or synchronized storage.
- **Plain CSS with central tokens:** preserves the Nordic visual identity without coupling feature code to a component framework.
- **Vitest plus Playwright:** pure logic remains fast to test; the small recovery-critical workflow gains real-browser coverage.
- **Cloudflare Pages:** hosts the static app at one stable HTTPS origin with Git-connected deployments and production rollback.

## B. Architecture foundation

### Core entities and relationships

**Plain English:** Recipes describe meals and their ingredients. Weekly plans reference recipes, Home Stock records confirmed household inventory, and shopping lines preserve both what recipes require and what remains to buy after confirmed stock is applied.

**Technical specification:** `Recipe` has structured `Ingredient` values. `MealPlan` is keyed by a Monday `weekStart` and contains seven `MealSlot` values. `HomeStockItem` stores a persistent food or household item, quantity, unit, location, planning priority and optional replenishment rule. `ShoppingItem` combines explicit recipe, manual and accepted top-up sources. All ingredient-to-stock decisions must pass through the shared pure ingredient-matching service introduced by active Prompt 1.

### Data layer

**Plain English:** Household data stays in the browser and works offline. Versioned migration plus JSON export/import protects continuity without adding an account or backend.

**Technical specification:** `LocalStorageMealPlannerRepository` stores a schema-versioned `AppState` document under `family-table:v2`; schema version 7 already includes Home Stock and replenishment state. Every load and import passes through normalization and validation. Feature components depend on `MealPlannerRepository`, never `localStorage` directly. The persistence-hardening phase may add backup metadata through the next `AppState` schema migration, but must not bypass the repository.

### Authentication and identity

**Plain English:** No account is required for the local MVP. The browser profile and origin are the current identity and storage boundary.

**Technical specification:** Do not add authentication packages or user records. A future authenticated sync adapter may introduce a `householdId` without changing domain calculations or feature components.

### API and service patterns

**Plain English:** There is no application backend. Business rules remain outside screens so persistence or hosting can change without rewriting the UI.

**Technical specification:** Feature components call application-context commands. Commands invoke pure functions in `src/domain` and persist through `MealPlannerRepository`. The shared ingredient matcher owns canonical naming, aliases, compatible unit conversion, allocations and review reasons; shopping and stock planning consume its typed results.

### External integrations

**Plain English:** Oda, AI and household sync remain deferred. Cloudflare Pages hosts only static assets and does not receive household data.

**Technical specification:** Future external contracts live under `src/integrations` and integration state remains separate from core `AppState`. Credentials never enter Vite client code or browser storage. Oda-specific work continues to follow [ODA_MVP_DELIVERY_PLAN.md](./ODA_MVP_DELIVERY_PLAN.md).

### Error handling

**Plain English:** Expected mistakes receive a clear message; unexpected rendering failures have a recovery screen; storage failures never pretend data was saved.

**Technical specification:** Domain validation throws `DomainError`. Repository failures become persistent storage warnings while retaining in-memory state. Provider commands emit shared toasts. `AppErrorBoundary` catches render failures. Storage-persistence denial is an expected browser decision, not an exception.

### Design system and reusable components

**Plain English:** One token system keeps the application visually consistent. Shared controls prevent each feature from inventing its own interaction patterns.

**Technical specification:** `src/styles/tokens.css` defines colour, typography, spacing, radius, shadow and motion values. Components reference those variables only. Continue using the existing `Button`, `Card`, `Modal`, `EmptyState`, `PageHeader`, `ToastViewport`, `SegmentedControl`, `QuantityStepper` and `AppShell`; extend them only when the new state is reusable.

### Folder structure

```text
src/
  app/                    application provider, shell and composition
  components/ui/          reusable visual primitives
  domain/                 pure entities and business logic
  features/<feature>/     screens and feature-specific components
  integrations/           future external-system boundaries
  repositories/           persistence contracts and adapters
  styles/                 tokens and shared component styles
e2e/                      Playwright user-journey tests
docs/archive/             superseded plans and completion records
```

### Testing approach

Vitest remains the first line of defence for domain allocation, migrations and feature interactions. Every domain change needs a happy path, an edge case and an error or regression case. Playwright covers only high-value browser journeys: persistence through reload, export/reset/import recovery, offline shell and the deployed production smoke path. `npm run check` remains the complete local quality gate.

### Deployment

Build the static app from repository subdirectory `meal-planner-v2` with `npm run build` and publish `dist` from `main` to Cloudflare Pages using Node.js 24. The production URL must be documented after the first successful deployment. No backend variables or paid service are required.

## C. Active phased implementation prompts

Run these prompts one at a time and in order.

### Prompt 1 — shared ingredient matching and locked-meal reservation

**Recommended model:** `gpt-5.6-sol` with high reasoning.

> Work in `meal-planner-v2` and read `AGENTS.md`, `docs/BACKLOG.md`, `src/domain/types.ts`, `src/domain/shopping.ts`, `src/domain/stockPlanning.ts` and their tests before editing. Build one pure shared ingredient-matching service under `src/domain`; do not put matching logic in React components. Define a canonical ingredient and explicit alias registry that handles the regression pair `tomato`/`tomatoes` without using unsafe generic stemming. Normalize case and whitespace. Support exact linear conversion only for `g`/`kg` and `ml`/`l`, using stable base-unit arithmetic. Never infer conversions for cans, bags, bunches, pieces, packs, mass-to-volume or unknown units. Aggregate multiple compatible Home Stock rows for one canonical ingredient and return per-row allocations. Return typed exact, alias, unmatched and review results with stable reason codes for ambiguity, unknown quantities and incompatible units.
>
> Refactor `buildShoppingList`, stock-only eligibility and stock-only generation to consume this service so the same input receives the same match classification in both flows. Shopping may apply partial confirmed coverage; strict stock-only eligibility requires complete confirmed coverage. Preserve gross need, stock applied, buy quantity, shopping ticks, top-up reasons and the no-automatic-deduction rule.
>
> Before generating meals for open days, reserve confirmed compatible quantities required by locked recipe slots in deterministic `DAY_KEYS` order. Locked allocations reduce the ledger available to generated meals but do not mutate persisted Home Stock. Add focused tests for plural aliases, both safe unit families in both directions, multiple compatible stock rows, unsupported discrete units, ambiguity/review, parity between shopping and stock planning, and a regression proving stock used by a locked meal cannot also fund a generated stock-only meal. Include insufficient locked-stock behavior without silently claiming availability. Run `npm run check`.

### Prompt 2 — persistent-storage UX and browser recovery test

**Recommended model:** `gpt-5.6-terra` with high reasoning.

> Work in `meal-planner-v2` and read `AGENTS.md`, `docs/BACKLOG.md`, the repository contract and adapter, `AppProvider`, `SettingsPage`, current migration tests and the complete quality scripts before editing. Keep the MVP local-first and do not add a backend, account or sync service.
>
> Add a typed browser-storage capability wrapper rather than reading `navigator.storage` throughout the UI. In Settings, show whether persistence is already granted and provide an explicit action that calls `navigator.storage.persist()` when supported. Represent persistent, not granted, unsupported and failed-to-check states honestly. Denial must not block normal use and the copy must explain that persistent storage reduces eviction risk but is not a backup.
>
> Add versioned `lastBackupAt` metadata through the repository boundary. Set it only after a valid export payload has been prepared for download, display it in Settings and show a non-blocking reminder when there has never been a backup or it is older than seven days. Add time-controlled unit tests for the reminder and migration/round-trip tests for the metadata.
>
> Install and configure Playwright with Chromium, Firefox and WebKit projects. Add one user-visible recovery smoke test under `e2e/` that creates bananas at quantity zero, adds bananas to shopping, marks a stocked ingredient `Use soon`, generates a stock-only meal, reloads and verifies all state, exports a backup, resets through the UI, imports that downloaded backup and verifies full restoration. Use real browser storage and UI for the recovery flow; stub the persistence-permission result only in focused deterministic tests. Add the browser test to CI and the documented quality workflow without weakening existing checks. Run the unit tests, all Playwright projects and `npm run check`.

### Prompt 3 — production deployment and dogfood gate

**Recommended model:** `gpt-5.6-terra` with medium reasoning.

> Read `AGENTS.md`, `docs/BACKLOG.md`, `docs/DOGFOOD_LOG.md`, both READMEs, package scripts and the GitHub Actions workflow. Do not add product features. Confirm the working tree and `npm run check` are clean before deployment. Connect the existing GitHub repository to Cloudflare Pages with `main` as production, `meal-planner-v2` as project root, `npm run build` as build command, `dist` as output and Node.js 24. Do not add household data, credentials or runtime secrets to the client.
>
> After the first production deployment succeeds, record the stable HTTPS URL in both READMEs and verify the deployed version, commit, service-worker/offline reload, JSON export/import and the Playwright recovery smoke against that origin. Document how to identify and roll back to the previous successful production deployment, but do not perform a rollback unless testing requires it and the target is confirmed. Start the dated two-cycle observation log in `docs/DOGFOOD_LOG.md`. During the trial record only repeated manual corrections, failed ingredient matches, tedious stock quantities, rejected meal suggestions with reasons and repeatedly manual household items. Do not implement the hypothesized recipe-import feature until the second cycle is complete and the evidence is summarized.

## D. Persistent project configuration

`AGENTS.md` is the project’s long-term engineering configuration. It defines stack constraints, folder ownership, data rules, visual tokens, error handling, testing expectations and integration boundaries. Update it only when an architectural rule changes, not for temporary roadmap status.

## E. Getting unstuck

- **A change broke something:** run `npm run check`, identify the first failure and fix only the affected domain or component.
- **A browser smoke test is flaky:** reproduce in one Playwright project, replace timing assumptions with user-visible state assertions, then rerun all three projects.
- **Matching behavior diverges:** remove local name/unit logic and route the decision through the shared ingredient-matching service.
- **Local data looks unsafe:** export a JSON backup before clearing or changing browser storage; persistent-storage permission is not recovery.
- **A deferred feature looks tempting:** add its observation to the dogfood log and wait for the two-cycle review unless it is a correctness or data-loss defect.
