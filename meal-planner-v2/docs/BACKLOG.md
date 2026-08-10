# The Family Table — active MVP roadmap

Updated: 10 August 2026

## Product direction

Family Table should reduce the mental load of deciding what a household will eat and buying only what is still needed. The MVP remains local-first, offline-capable and usable without an account. Integrations are optional enhancements, never prerequisites.

The Home Stock, replenishment and stock-only planning foundations are implemented. Their superseded implementation plan is preserved in [archive/MVP_FOUNDATION_COMPLETED.md](./archive/MVP_FOUNDATION_COMPLETED.md). The researched Oda architecture remains separate in [ODA_INTEGRATION_PLAN.md](./ODA_INTEGRATION_PLAN.md) and is not active MVP scope.

## Current release goal

Ship a dependable local MVP, use it for two real weekly planning cycles, and let observed household friction determine the next feature.

The active sequence is deliberately narrow:

1. Harden pantry matching and stock allocation.
2. Make browser persistence and recovery trustworthy.
3. Deploy one stable build and dogfood it for two weeks.
4. Choose the next product feature from recorded evidence.

## 1. Harden pantry matching and stock allocation

**Priority:** P0

**Recommended model:** `gpt-5.6-sol` with high reasoning

**Why now:** shopping reconciliation and stock-only planning currently implement separate exact-name, exact-unit matching. This creates inconsistent or incorrect results for plurals, safe metric conversions, duplicate stock rows and stock already committed to locked meals.

### Scope

- Introduce one pure ingredient-matching service used by both `shopping.ts` and `stockPlanning.ts`.
- Resolve names to a canonical ingredient name through an explicit alias registry. Initial regression cases include `tomato` and `tomatoes`; avoid generic stemming rules that turn unrelated words into matches.
- Normalize case and whitespace without changing meaning.
- Convert only within the safe metric families `g ↔ kg` and `ml ↔ l`, using a stable base unit for calculations.
- Never infer conversions for cans, bags, bunches, pieces, packs or between mass and volume.
- Aggregate multiple confirmed stock rows that resolve to the same canonical ingredient and compatible unit family.
- Return a structured review result for ambiguous aliases, unknown quantities, unsupported conversions or incompatible units. Uncertain stock is never silently subtracted or used to qualify a stock-only meal.
- Preserve the current rule that planning does not mutate Home Stock.
- Before filling open days with stock-only meals, reserve confirmed compatible quantities required by already locked recipe meals, in plan-day order.

### Required domain contract

The shared service should return a typed result containing:

- canonical ingredient identity and match kind (`exact`, `alias` or `unmatched`);
- requested quantity and normalized unit family;
- per-stock-row allocations and total confirmed quantity;
- remaining requirement;
- review status and a stable reason code;
- the remaining stock ledger for subsequent allocations.

Shopping may use partial confirmed coverage. Strict stock-only eligibility must require full confirmed coverage. Both flows must derive their decisions from this same result rather than reimplementing matching rules.

### Acceptance criteria

- `tomato` and `tomatoes` reconcile through an explicit alias to one canonical ingredient.
- `1 kg` covers `1000 g`, and `1 l` covers `1000 ml`, in either direction without floating-point drift.
- Two compatible rows for the same product are allocated once and summed correctly.
- Cans, bags, bunches, pieces and cross-family units never receive guessed conversions.
- Ambiguous, unknown or incompatible matches remain visible for review and do not reduce the buy quantity.
- Shopping reconciliation and stock-only planning produce the same match classification and compatible allocation for the same inputs.
- Locked recipe meals reserve their confirmed ingredient allocations before open days are filled. A regression test proves that the same stock cannot fund both a locked meal and a newly generated stock-only meal.
- Existing shopping ticks, replenishment reasons and no-automatic-deduction rules remain intact.
- `npm run check` passes.

## 2. Make browser persistence and recovery trustworthy

**Priority:** P0

**Recommended model:** `gpt-5.6-terra` with high reasoning

**Why now:** the app saves locally and supports JSON backup, but it does not show whether browser storage is protected from eviction, when the last backup was made, or prove the whole recovery loop in a real browser.

### Scope

- Add a Settings storage card that checks `navigator.storage.persisted()` and, after an explicit user action, calls `navigator.storage.persist()`.
- Show four honest states: persistent, not granted, unsupported and check/request failed. A denial is not an application error and must continue to recommend backups.
- Treat persistent storage as extra eviction protection, not as a backup. The API is available only in secure contexts and the browser decides whether to grant the request. See [MDN: `StorageManager.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
- Record `lastBackupAt` only after a backup payload has been successfully prepared for download.
- Show the last backup date in Settings and a non-blocking reminder when no backup has been made or the most recent backup is more than seven days old. Dismissing the reminder may hide it for the current session, but must not falsify the recorded date.
- Keep import validation and replacement semantics unchanged.
- Add Playwright configuration and a browser-level recovery smoke test. Playwright supports Chromium, Firefox and WebKit through configured projects; its storage-state APIs can also include IndexedDB if the repository moves there later. See the official [browser](https://playwright.dev/docs/browsers) and [BrowserContext](https://playwright.dev/docs/api/class-browsercontext) documentation.

### Browser smoke scenario

Run the same user-visible flow in Chromium, Firefox and WebKit:

1. Create bananas in Home Stock with quantity `0`.
2. Add bananas to the shopping list.
3. Mark an ingredient `Use soon`.
4. Generate at least one stock-only meal.
5. Reload and verify the stock item, shopping source, priority and generated plan persist.
6. Export a backup through the Settings UI.
7. Clear/reset local app data through the UI and verify the created data is gone.
8. Import the downloaded backup and verify full restoration.

Stub the persistent-storage permission response only for deterministic UI-state tests. The data reload, export, clear and import path must use the real browser storage and real UI.

### Acceptance criteria

- Settings accurately reports persistent-storage support and result without promising that local data is backed up.
- A denied or unsupported request does not block use of the app.
- `lastBackupAt` survives reload and updates only when export is initiated successfully.
- The seven-day reminder is derived from the recorded timestamp and current time.
- The smoke scenario passes in Chromium, Firefox and WebKit locally and in CI.
- The normal unit, companion and production build checks continue to pass.

## 3. Deploy and dogfood for two weeks

**Priority:** P0 release gate

**Recommended model:** `gpt-5.6-terra` with medium reasoning for deployment setup; household use is manual

**Why now:** local correctness is not enough. The same stable origin must survive normal phone and desktop use over two planning cycles.

### Deployment

- Connect the GitHub repository to Cloudflare Pages with `main` as the production branch.
- Configure project root `meal-planner-v2`, build command `npm run build`, output directory `dist` and Node.js 24.
- Record the stable production URL in the root and app READMEs.
- Verify a production build, offline reload, JSON export/import and the browser smoke flow against the deployed URL.
- Keep the last successful production deployment available as a rollback target. Cloudflare Pages automatically deploys connected Git branches and supports rollback to a previous successful production deployment; see its [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) and [rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/) documentation.

### Dogfood protocol

Use the deployed URL as the household's only planning copy for two consecutive weekly planning cycles. Record observations in [DOGFOOD_LOG.md](./DOGFOOD_LOG.md), limited to:

- manual corrections made repeatedly;
- ingredients that fail to match;
- stock quantities that are too tedious to maintain;
- meal suggestions rejected and why;
- household items repeatedly added manually.

Do not turn isolated preferences into features during the trial. At the end of week two, group repeated observations, count their frequency and identify the smallest change that would remove the most household effort.

### Exit criteria

- One documented stable production URL is used for both planning cycles.
- Both cycles have dated observations or an explicit `none observed` entry in each category.
- Any data-loss, incorrect-stock or false stock-only result is treated as a release-blocking defect.
- The next feature decision cites dogfood observations rather than expectation alone.

## 4. Evidence-gated next product feature

**Current hypothesis, not committed scope:** paste/import a recipe with editable review and duplicate detection.

This is the leading candidate because stock-only planning becomes materially more useful when the household can add its actual recipes quickly. It should move into active implementation only if the two-week log confirms recipe onboarding is a repeated source of effort or weak suggestions.

If selected, the first release should:

- accept pasted structured or semi-structured recipe text;
- parse into the existing `Recipe` and `Ingredient` model;
- require an editable review before saving;
- use the shared canonical ingredient matcher during review;
- detect likely duplicates by normalized name and ingredient overlap;
- never require an LLM for successful import.

## Deferred until evidence changes the priority

- Firebase or another backend
- Oda integration
- AI-generated recipes from arbitrary new ingredients
- Multi-user household synchronization
- Large component or architecture refactors

## Prioritised backlog

| Priority | Work item | Status | Release gate |
| --- | --- | --- | --- |
| P0 | Shared ingredient matching and locked-meal reservation | Active | Domain regressions and `npm run check` pass |
| P0 | Persistent-storage status, backup date and reminder | Queued | Settings states and timestamp tests pass |
| P0 | Playwright recovery smoke test | Queued | Chromium, Firefox and WebKit pass |
| P0 | Cloudflare Pages production deployment | Queued | Stable URL and live smoke verified |
| P0 | Two-week dogfood trial | Blocked by deployment | Two complete planning cycles recorded |
| P1 | Recipe paste/import with review and duplicate detection | Hypothesis | Must be supported by dogfood evidence |
| P2 | Oda read-only feasibility work | Deferred / current no-go | Upstream capability and security gates change |
| P3 | Household synchronization and backend | Later | Local MVP proves recurring multi-user need |

## Product rules

- Wrongly removing an ingredient is worse than leaving an extra item for review.
- Do not hide automation. Show why a recipe or product was suggested.
- A Home Stock item at zero remains in the catalogue until explicitly archived or deleted.
- Replenishment rules create suggestions, not silent shopping-list additions.
- “Cook from Home Stock” means every required ingredient is confirmed available after locked-meal reservations.
- Planning, shopping and marking a meal cooked never deduct stock automatically.
- Persistent browser storage reduces eviction risk; only an exported backup is portable recovery.
- Add complexity only when it removes more household effort than it creates.
