# The Family Table v2 — architecture blueprint

## A. Tech stack recommendation

- **React, TypeScript, and Vite:** the smallest mainstream stack that gives this project component structure, type safety, rapid local development, and a straightforward production build.
- **Local storage behind a repository adapter:** fastest reliable persistence for a one-household MVP, while keeping a clean replacement point for IndexedDB or a sync API.
- **Plain CSS with central tokens:** preserves the custom Nordic identity without coupling the product to a component framework.
- **Vitest:** keeps meal generation, shopping aggregation, migrations, and imports testable as pure logic.
- **A small hand-written service worker:** supports installation and offline shell loading without adding PWA framework complexity.

## B. Architecture foundation

### Core entities and relationships

**Plain English:** Recipes describe meals and their ingredients, while Home Stock describes food and household essentials currently kept at home. A weekly plan creates recipe requirements; the shopping list reconciles those requirements and recurring household needs with current stock. Stock items remain in the household catalogue even when their quantity is zero.

**Technical specification:**

- `Recipe` has many `Ingredient` values.
- `MealPlan` is keyed by Monday `weekStart` and has seven `MealSlot` values.
- Each `MealSlot` references zero or one `Recipe` by ID.
- `HomeStockItem` stores a persistent food or household item, current quantity, unit, location, planning priority and optional replenishment rule. Quantity `0` is valid and never deletes the item.
- `ShoppingItem` combines one or more explicit sources: recipe requirement, manual household need or accepted top-up suggestion.
- Shopping reconciliation preserves gross recipe need, applies only compatible confirmed stock and exposes the remaining buy quantity.
- `Preferences` controls household name, default servings, theme, and planning defaults.

### Data layer

**Plain English:** Data stays in the browser and continues working without an internet connection. Backup and restore protect against accidental browser-data loss.

**Technical specification:** `LocalStorageMealPlannerRepository` stores a versioned `AppState` document under `family-table:v2`. The next schema migration adds `homeStockItems` to core `AppState`, because stock must work without Oda and be included in JSON backup/restore. Every load passes through a migration and validation boundary. Features depend on `MealPlannerRepository`, not browser storage.

### Authentication and identity

**Plain English:** No account is required for the local MVP. The device is the identity boundary.

**Technical specification:** No authentication packages or user records. A future `householdId` and authenticated sync repository can be added without changing domain entities.

### API and service patterns

**Plain English:** There is no network API yet, but business rules are kept outside the screens so a future API does not require rewriting the interface.

**Technical specification:** Feature components call application-context commands. Commands invoke pure functions in `src/domain` and persist via `MealPlannerRepository`. Future HTTP endpoints use `/api/v1/<resource>` and `{data,error,meta}` responses.

### External integrations

**Plain English:** Oda and AI are deferred, but their code already has a designated home and cannot leak into the recipe or planning screens.

**Technical specification:** Contracts live in `src/integrations`. Oda product matching maps `Ingredient` to `ProductMapping`; write operations require a preview and explicit confirmation. Credentials are server-only in a hosted edition.

### Error handling

**Plain English:** Expected mistakes get a clear inline message; unexpected failures show a recoverable application error; storage problems never silently claim that data was saved.

**Technical specification:** Domain validation throws `DomainError`. Provider commands catch repository failures, retain current memory state, and emit a toast. `AppErrorBoundary` catches render failures.

### Design system

**Plain English:** The design has one source of truth, so changing the primary colour or spacing updates the whole product.

**Technical specification:** `src/styles/tokens.css` defines warm neutral surfaces, lingonberry actions, sage success, seasonal accents, typography, an eight-point spacing scale, radii, shadows, and motion durations. Components reference variables only.

### Reusable components

`Button`, `Card`, `Modal`, `EmptyState`, `PageHeader`, `ToastViewport`, `SegmentedControl`, `QuantityStepper`, and `AppShell`.

### Folder structure

See `AGENTS.md`. Domain logic, repositories, application composition, feature screens, integrations, UI primitives, and tests are separated explicitly.

### Testing approach

Vitest tests the happy path, an edge case, and a regression/error path for planning, shopping aggregation, stock allocation, zero-quantity persistence and persistence migrations. Browser QA covers desktop, 390px mobile, light mode, dark mode, offline reload and backup/restore.

### Deployment

The MVP runs with `npm run dev`, builds to static files with `npm run build`, and is deployed from `main` to Cloudflare Pages. Use `meal-planner-v2` as the project root and `dist` as the output directory; no backend environment variables or paid services are required.

## C. Phased implementation prompts

### Phase 0 — repository and delivery hygiene

**Goal:** make every later implementation phase recoverable, reviewable, and automatically checked before adding more product scope.

**Recommended model:** `gpt-5.6-terra` with medium reasoning. This is a bounded setup task with clear acceptance criteria; reserve `gpt-5.6-sol` with high reasoning for data migrations, synchronization, security, and unfamiliar integrations.

**Implementation prompt:**

> Work from the Git repository root. Do not build or change product features. Inspect the current Git status, existing remote, ignore rules, package scripts, lockfile, and documentation before editing. Add a root `.gitignore` that excludes credentials, local environment files, dependencies, build output, coverage, TypeScript build metadata, operating-system files, and local planning artifacts without deleting them. Add a concise root `README.md` with the project purpose, exact setup commands, full quality command, repository layout, local-data warning, and contribution workflow. Pin the supported Node.js major version in `meal-planner-v2/.nvmrc` and `package.json`. Add `.github/workflows/ci.yml` so pushes to `main` and pull requests run `npm ci` and `npm run check` from `meal-planner-v2`, with read-only repository permissions and npm caching. Use only current official GitHub Actions major versions. Confirm that no generated files or secrets would be committed, run the full quality check, and inspect the staged diff. If the supplied GitHub repository is empty, connect it as `origin`, create one initial commit, and push `main`. Stop rather than overwriting or force-pushing any remote history.

**Acceptance criteria:**

- `origin` points to the intended GitHub repository and `main` tracks `origin/main`.
- The initial commit contains source, tests, documentation, lockfiles, and CI, but no credentials, dependency folders, build output, or local-only artifacts.
- `npm run check` passes locally and the GitHub `CI` workflow passes on the first push.
- Repository rules can require the `check` status before merging after the first successful workflow run.

### Prompt 1 — project setup

Create the Vite React TypeScript project in `meal-planner-v2`, install the dependencies declared in `package.json`, create the folder structure in `AGENTS.md`, configure ESLint, Prettier, Vitest, design tokens, the manifest, and service worker. Do not build features or screens yet.

### Prompt 2 — foundation

Implement the entities in `src/domain/types.ts`, pure date/planning/shopping modules, the `MealPlannerRepository` contract, the versioned local-storage adapter, application provider, shared UI primitives, error boundary, toast pattern, and application shell. Add repository and domain tests. Do not build user-facing feature screens yet.

### Prompt 3 — first MVP feature

Build the weekly planner in `src/features/plan/PlanPage.tsx`. It must navigate weeks, assign recipes, generate unlocked days, preserve locked days, mark a plan ready to shop, and mark meals cooked. Use only shared components and provider commands. Add happy-path, locked-day, and empty-library tests, then wire the screen into navigation.

### Next prompt 4A — Home Stock domain and migration

**Recommended model:** `gpt-5.6-sol` with high reasoning because this changes persisted data and shopping calculations.

> Implement the local Home Stock domain without building its screens. Read `AGENTS.md`, `docs/BACKLOG.md` and the existing repository, types, shopping logic and migration tests first. Add a `HomeStockItem` entity to `src/domain/types.ts` with a stable ID, name, kind (`food` or `household`), category, location, quantity (`number | null`, where zero is valid and null means unknown), unit, planning priority (`normal` or `use-soon`), optional reorder point, optional target quantity, active/archive state and updated timestamp. Add `homeStockItems` to `AppState` through the next schema version and migrate existing version 4 data to an empty array without losing recipes, plans, shopping lists or preferences. Extend shopping-domain output so every line can retain gross recipe need, confirmed stock applied, remaining buy quantity and explicit sources (`recipe`, `manual`, or `stock-top-up`). In v1, allocate stock only when normalized names and units are compatible; otherwise mark the line for review and do not subtract. Never delete a Home Stock item when quantity reaches zero and never create a stock deduction merely because a meal is planned or marked cooked. Add tests for migration, backup round-trip, zero-quantity persistence, partial stock, multiple recipes sharing one item, incompatible units and preservation of shopping ticks. Do not build user-facing screens yet. Run `npm run check`.

### Next prompt 4B — Home Stock and reconciliation UI

**Recommended model:** `gpt-5.6-terra` with high reasoning because the domain rules are established and this is bounded interaction work.

> Build the Home Stock interface using the domain and repository contracts already present. Keep the four-item mobile navigation; inside the existing Shop screen add a shared segmented control with `To buy` and `At home`. `At home` must support search, food/household filtering, location filtering, add, adjust quantity, mark used up, toggle `Use soon`, archive and restore. A quantity of zero must remain visible and show a one-action `Add to shop` control. `To buy` must show `Recipe need − At home = Buy` for reconciled lines, preserve explanations and show review controls for uncertain matches. Allow manual shopping items such as toilet paper or dishwasher tablets without attaching them to recipes. Do not implement automatic replenishment suggestions, automatic consumption, Oda import or a fifth navigation destination. Add happy-path, zero-stock, use-soon, manual-household-item, uncertain-match and offline-reload tests. Run `npm run check`.

### Next prompt 4C — Shopping v2 replenishment suggestions

**Recommended model:** `gpt-5.6-sol` with high reasoning because overlapping recipe demand and replenishment targets require careful quantity rules.

> Add opt-in replenishment suggestions to the existing Home Stock and shopping workflow. An active item may have a reorder point and target quantity. When current quantity is at or below the reorder point, create a reviewable suggestion for `target − current`; never add it silently to the shopping list. Provide accept, dismiss and disable-rule actions. When recipe demand and a top-up suggestion refer to the same compatible item and unit, the buy quantity is the larger of the recipe shortfall and target shortfall, not their sum; keep both reasons visible. Unknown quantities, incompatible units and uncertain matches require review. Add tests using bananas at zero with reorder point two and target six, overlapping recipe demand, dismissed suggestions, disabled rules and backup round-trip. Run `npm run check`.

### Next prompt 4D — cook-from-stock and use-soon planning

**Recommended model:** `gpt-5.6-sol` with high reasoning because strict ingredient allocation and plan constraints must not create false “no shopping needed” claims.

> Add pure domain functions for strict stock-only recipe eligibility and use-soon planning. Work only from saved recipes; do not call an LLM or invent recipes. A recipe is stock-only eligible only when every required ingredient can be matched to confirmed Home Stock with sufficient quantity and compatible units. Unknown quantities, insufficient amounts, incompatible units and ambiguous matches make the recipe ineligible, with a structured explanation of what failed. Rank eligible recipes higher when they consume items marked `use-soon`. Add an explicit `Use in next plan` action that passes selected Home Stock item IDs as constraints to meal generation; if no valid recipe can satisfy a constraint, explain that and leave the plan unchanged. Show the qualifying ingredient allocation and the reason for each suggestion, but do not reserve, deduct or clear stock until the user separately confirms an adjustment. Add tests for a fully covered recipe, one missing ingredient, insufficient quantity, shared stock allocation, incompatible units, multiple use-soon items, an impossible must-use constraint and deterministic ranking. Then add a bounded UI entry point from Plan or Recipes named `Cook from what I have`, plus `Use soon` and `Use in next plan` controls in the `At home` view. Run `npm run check`.

## D. Persistent tool configuration

The persistent project rules are in `AGENTS.md`. They define the stack, folder structure, domain relationships, data boundary, visual tokens, shared components, testing expectations, error pattern, and future integration constraints.

## E. Getting unstuck

- **A change broke something:** run `npm run check`, identify the first failing test, and fix only the affected domain or component.
- **Adding a deferred feature:** first identify which entities it reads or writes and which existing feature pattern it follows.
- **The design is drifting:** audit against `tokens.css` and the primitives in `components/ui`.
- **The project feels messy:** start from `AGENTS.md`; do not reorganize unrelated files while fixing a feature.
- **A new integration needs credentials:** stop and introduce a server boundary; never place credentials in Vite environment variables.
