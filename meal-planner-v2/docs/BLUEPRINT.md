# The Family Table v2 — architecture blueprint

## A. Tech stack recommendation

- **React, TypeScript, and Vite:** the smallest mainstream stack that gives this project component structure, type safety, rapid local development, and a straightforward production build.
- **Local storage behind a repository adapter:** fastest reliable persistence for a one-household MVP, while keeping a clean replacement point for IndexedDB or a sync API.
- **Plain CSS with central tokens:** preserves the custom Nordic identity without coupling the product to a component framework.
- **Vitest:** keeps meal generation, shopping aggregation, migrations, and imports testable as pure logic.
- **A small hand-written service worker:** supports installation and offline shell loading without adding PWA framework complexity.

## B. Architecture foundation

### Core entities and relationships

**Plain English:** Recipes describe meals and their ingredients. A weekly plan assigns a recipe and serving count to each day. A shopping list is derived from that plan, while preferences describe how this household normally plans.

**Technical specification:**

- `Recipe` has many `Ingredient` values.
- `MealPlan` is keyed by Monday `weekStart` and has seven `MealSlot` values.
- Each `MealSlot` references zero or one `Recipe` by ID.
- `ShoppingItem` values are derived from a plan and reference contributing recipe IDs.
- `Preferences` controls household name, default servings, theme, and planning defaults.

### Data layer

**Plain English:** Data stays in the browser and continues working without an internet connection. Backup and restore protect against accidental browser-data loss.

**Technical specification:** `LocalStorageMealPlannerRepository` stores a versioned `AppState` document under `family-table:v2`. Every load passes through a migration and validation boundary. Features depend on `MealPlannerRepository`, not browser storage.

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

`Button`, `Card`, `Modal`, `EmptyState`, `PageHeader`, `ToastViewport`, and `AppShell`.

### Folder structure

See `AGENTS.md`. Domain logic, repositories, application composition, feature screens, integrations, UI primitives, and tests are separated explicitly.

### Testing approach

Vitest tests the happy path, an edge case, and a regression/error path for planning, shopping aggregation, and persistence migrations. Browser QA covers desktop, 390px mobile, light mode, dark mode, and offline reload.

### Deployment

The MVP runs with `npm run dev` and builds to static files with `npm run build`. It can later be hosted on any static host; no environment variables or paid services are required.

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

## D. Persistent tool configuration

The persistent project rules are in `AGENTS.md`. They define the stack, folder structure, domain relationships, data boundary, visual tokens, shared components, testing expectations, error pattern, and future integration constraints.

## E. Getting unstuck

- **A change broke something:** run `npm run check`, identify the first failing test, and fix only the affected domain or component.
- **Adding a deferred feature:** first identify which entities it reads or writes and which existing feature pattern it follows.
- **The design is drifting:** audit against `tokens.css` and the primitives in `components/ui`.
- **The project feels messy:** start from `AGENTS.md`; do not reorganize unrelated files while fixing a feature.
- **A new integration needs credentials:** stop and introduce a server boundary; never place credentials in Vite environment variables.
