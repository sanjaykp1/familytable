# Oda + Home Stock MVP delivery plan

Updated: 9 August 2026

This is the executable delivery plan for the architecture and research in
[ODA_INTEGRATION_PLAN.md](./ODA_INTEGRATION_PLAN.md).

The main product roadmap now delivers persistent local Home Stock and basic stock-aware shopping
before Oda. Releases 5 and 6 in this document therefore describe Oda enrichment and advanced stock
allocation; they must not be used to defer the personal-use stock and household-needs workflow.

## Outcome

The next MVP is complete when a household can:

1. replace starter recipes with household recipes through paste, review and save;
2. connect Family Table to Oda through a local companion;
3. turn an approved weekly shopping list into matched Oda products;
4. review product variants, package counts, shortages and overbuying;
5. merge approved products into the existing Oda cart;
6. select a completed Oda order and propose its delivered products as additions to existing **Home Stock**;
7. review everything held in cupboard, fridge and freezer; and
8. see confirmed home stock deducted transparently from the next shopping list.

Checkout, payment, delivery-slot selection and final order placement stay in Oda.

## Delivery strategy: one foundation tranche, then vertical slices

A single big-bang build is not recommended because Oda MCP availability and schemas are the largest
unknown. Fully building matching, orders and home stock before validating the live tools could waste
substantial work.

Purely incremental implementation is also inefficient because every slice would otherwise recreate
security, storage and provider-boundary decisions. Use a hybrid:

- **Foundation tranche:** build the local companion shell, provider contracts, fake provider,
  validated DTOs, integration repository and feature flags together.
- **Vertical slices:** enable live read-only search, reviewed cart sync, order import, Home Stock and
  stock-aware shopping one at a time.
- **Release after every slice:** the app remains usable, tests stay green and unfinished integration
  paths remain hidden.

This is an extension of v2. The planner, recipes, shopping domain, visual system and core local
repository remain in place.

## MVP product rules

- “Pantry” is named **Home Stock** in the UI and includes food and household items across cupboard,
  fridge, freezer, bathroom, cleaning storage and other locations.
- A persistent Home Stock item remains in the catalogue when its quantity reaches zero.
- Recipes imported from text or JSON always pass through ingredient and quantity review before they
  can contribute to a real Oda cart.
- Oda order import is user-triggered. Do not poll or import orders silently.
- A purchase is a proposed stock addition, not proof of the current amount.
- Stock deductions are visible, reversible and never change the underlying recipe requirement.
- Known Oda mappings may be pre-approved; new or uncertain variants require review.
- A package within 5% of the requirement may be recommended, but the shortfall remains visible.
- Never silently substitute allergens, dietary constraints, cuts, fresh/frozen state or materially
  different product forms.
- Cart sync merges approved lines into the existing Oda cart. It never clears or replaces it.
- Oda failure never blocks local recipes, plans or shopping lists.

## A. Tech stack recommendation

Keep the current React 19, TypeScript 6, Vite 8, Vitest and design-token stack. Add a TypeScript/Node
local companion using the MCP TypeScript SDK, Zod for external schema validation and a small
loopback HTTP server. Add a separate IndexedDB-backed `IntegrationRepository`; do not move the core
planner out of its existing repository during this MVP.

Do not introduce a production LLM. Matching and package calculations are deterministic, with
household-confirmed mappings carrying the workflow over time.

## B. Architecture foundation for delivery

### Core entities and relationships

**Plain English:** Recipe ingredients become shopping requirements. Family Table subtracts
confirmed Home Stock, matches the remainder to Oda products and produces a cart draft for review.
Completed Oda orders propose additions to Home Stock, while later cooking or manual actions create
reversible deductions.

**Technical specification:**

- `ShoppingItem`: unchanged gross weekly requirement from planned recipes.
- `ProductMapping`: household-confirmed mapping from canonical ingredient + qualifiers to Oda ID.
- `CartDraft`: versioned review artifact derived from a shopping-list fingerprint.
- `ImportedOrder`: compact, idempotent Oda order record keyed by provider order ID.
- `HomeStockItem`: current product/ingredient balance, storage location and accuracy.
- `StockMovement`: reversible addition, consumption or adjustment with source and timestamp.

### Data layer

**Plain English:** Core meal-planner and Home Stock data remain together so stock works offline and
is included in normal backup and restore. Oda mappings, drafts and order records get their own local
store so a large order history or broken MCP cannot corrupt the personal household data.

**Technical specification:** Keep `homeStockItems` in versioned core `AppState` behind
`MealPlannerRepository`. Create `IntegrationRepository` backed by IndexedDB with stores for
`productMappings`, `cartDrafts`, `importedOrders` and `integrationPreferences`. Oda imports remain
proposals until an explicit core command confirms additions. Do not store credentials, cookies,
delivery addresses, payment data or product images. Importing the same Oda order twice must be a
no-op.

### Authentication and identity

**Plain English:** Oda authentication happens in the upstream local setup, never inside a Family
Table form. The app only learns whether the companion is connected and which capabilities work.

**Technical specification:** Companion binds to `127.0.0.1`, validates the app origin, requires a
per-install token, redacts sensitive logs and returns only connection/capability status. No generic
MCP proxy route. Real-account setup and smoke tests are manual and opt-in.

### API and service pattern

**Plain English:** The UI requests safe business outcomes such as “preview products” and “apply this
confirmed draft”, rather than calling arbitrary Oda tools.

**Technical specification:** Use the route and `{data,error,meta}` response contracts from
`ODA_INTEGRATION_PLAN.md`. Add `GET /v1/oda/orders`, `POST /v1/orders/:id/import`,
`GET /v1/home-stock`, `POST /v1/home-stock/movements` and
`POST /v1/shopping/:week/stock-adjustment-preview`. Writes require an idempotency key. Cart writes
are never automatically retried.

### External integrations

**Plain English:** The Oda implementation is replaceable. The rest of Family Table works whether
the available MCP is first-party, community-maintained or temporarily unavailable.

**Technical specification:** Implement `GroceryProvider` with live `OdaMcpProvider` and deterministic
`FakeGroceryProvider`. Inspect live MCP tools at startup and expose only validated capabilities.
Pin the upstream revision and keep anonymised contract fixtures. Order import is hidden if
`listOrders/getOrder` is unavailable.

### Error handling

**Plain English:** Failed reads show a retryable integration state; failed writes preserve the draft
and compare against Oda before another attempt. Users never lose their local shopping list.

**Technical specification:** Use typed errors `not_connected`, `unsupported`, `upstream_changed`,
`unavailable`, `stale_preview`, `product_unavailable`, `rate_limited` and
`write_outcome_unknown`. An unknown cart-write outcome triggers read/reconcile, not retry.

### Design system and components

**Plain English:** Oda and Home Stock use the existing Family Table visual language. The review
screen prioritises confidence and quantity consequences rather than retailer imagery.

**Technical specification:** Reuse existing tokens and primitives. Add `ConnectionStatus`,
`ProductMatchRow`, `PackCoverage`, `CartDraftSummary`, `OrderImportReview`, `HomeStockRow`,
`StorageLocationTabs`, `StockAccuracyBadge`, `StockDeductionSummary` and `IntegrationErrorState`.

### Folder structure

```text
meal-planner-v2/
  src/
    domain/integrations/              # canonical keys, matching, units, pack coverage
    domain/homeStock/                 # balances, movements, allocation
    features/oda/                     # connection, matching and cart review
    features/homeStock/               # order import and stock UI
    integrations/oda/                 # validated browser client DTOs
    repositories/integrationRepository.ts
    repositories/indexedDbIntegrationRepository.ts
    app/IntegrationProvider.tsx       # separate from the existing AppProvider
  companion/
    src/providers/groceryProvider.ts
    src/providers/fakeGroceryProvider.ts
    src/providers/oda/odaMcpProvider.ts
    src/security/
    src/routes/
    tests/contracts/
```

Do not put integration state or MCP calls into `AppProvider.tsx`. Use a separate
`IntegrationProvider` and pure domain functions, avoiding a broad refactor of working v2 code.

### Testing approach

**Plain English:** Every release is first tested with fake Oda data, then with live read-only data.
Only the cart release performs one deliberate live write after explicit approval.

**Technical specification:** Vitest covers pure matching, unit conversion, package coverage, stock
allocation and migrations. Companion contract tests validate anonymised MCP fixtures. UI/integration
tests use `FakeGroceryProvider`. Run `npm run check` after each slice. Real Oda tests never run in CI.

### Deployment

**Plain English:** Continue local development with Vite plus the loopback companion. Package as a
desktop app only after the workflow proves valuable.

**Technical specification:** Provide one development command that starts app + companion. Do not
bind to the LAN or deploy the companion. Evaluate Tauri 2 after Release 5; packaging earlier would
add code-signing and update complexity without validating product value.

## Incremental releases

### Release 0 — Oda feasibility gate

**User value:** none yet; removes the largest technical risk.

**Status on 7 August 2026:** the pinned community MCP installs and builds, but its live read-only
product tests fail and it has no order-history tools. The decision is **NO-GO for a live provider**;
the safe fake-provider foundation may continue. See
[ODA_CAPABILITY_REPORT.md](./ODA_CAPABILITY_REPORT.md) and
[ODA_THREAT_MODEL.md](./ODA_THREAT_MODEL.md).

Subtasks:

1. Verify which Oda MCP is installable and pin its exact revision.
2. Have the user complete local Oda authentication without exposing credentials to the app.
3. Capture tool names, input schemas and anonymised outputs for status, product search, cart and
   order history.
4. Confirm whether completed/delivered state is available on orders.
5. Write capability report, threat model and go/no-go decision.

Test gate: product search and cart reading succeed; no mutation tool is called. If order history is
missing, cart work continues and Releases 4–6 are adjusted rather than blocking the whole MVP.

### Release 1 — integration foundation with fake Oda

**User value:** a completely safe demonstration of the future workflow.

Subtasks:

1. Add companion workspace, loopback security and health endpoint.
2. Add `GroceryProvider`, `FakeGroceryProvider` and validated shared DTOs.
3. Add IndexedDB `IntegrationRepository` and feature flags.
4. Build a minimal connection panel and fixture-driven product-match preview.
5. Keep every live Oda capability disabled.

Test gate: a developer can switch to fake provider, preview a full weekly list and restart without
losing confirmed mappings. Core v2 checks remain green.

### Release 2 — live read-only product matching

**User value:** see which real Oda products Family Table would select, without changing the cart.

Subtasks:

1. Implement live connection status and product search.
2. Derive canonical ingredient keys and meaningful qualifiers without changing existing recipes.
3. Support deterministic units `g/kg`, `ml/l` and `each/pack`; flag other conversions.
4. Rank known mappings first, then exact candidates, then review-required candidates.
5. Show package coverage, shortfall, surplus, price and availability when provided.
6. Let users search/replace a match and remember that choice.

Test gate: preview one real weekly list; every line explains its match. No Oda write is possible.

### Release 2A — household recipe onboarding and ingredient quality

**User value:** replace demo recipes quickly and make the shopping data trustworthy enough for a
real cart.

This release can be developed alongside Release 2 after the foundation is stable, but its test gate
must pass before Release 3 enables cart writes.

Subtasks:

1. Add a first-run choice to keep or remove starter recipes without affecting existing households.
2. Parse pasted plain text and supported JSON into a recipe draft.
3. Normalize obvious g/kg, ml/l and count units while preserving the original text for review.
4. Require an editable ingredient and quantity review before saving.
5. Warn on deterministic name/ingredient fingerprints; allow intentional duplicates.
6. Suggest editable tags using local rules, not a required runtime model.
7. Flag ingredients with missing quantity or ambiguous form before they can be sent to Oda.

Test gate: import ten representative household recipes, including malformed and partial input, in
under fifteen minutes. Every saved ingredient is editable and every ambiguity remains visible.

### Release 3 — reviewed “Send to Oda” cart pilot

**User value:** approved weekly ingredients are added to the current Oda cart.

Subtasks:

1. Create immutable, fingerprinted cart drafts.
2. Add pack-count controls, omit/replace actions and a final summary.
3. Recommend within a 5% package tolerance while showing any shortfall.
4. Require review for uncertain variants and unknown unit conversions.
5. Add a separate confirmation step and idempotency key.
6. Merge approved lines, read the resulting cart and reconcile by product ID.
7. Provide a link to continue in Oda.

Test gate: first run against fake Oda. Then, with approval, add one low-cost test product to the
real cart, verify the exact delta and remove it. Finally test one genuine weekly cart draft.

**This is the first shippable Oda MVP.** Release 2A is a prerequisite. If order history is
unavailable, stop here and use the cart workflow while the upstream capability is reassessed.

### Release 4 — completed-order import preview

**User value:** select an Oda delivery and preview everything that could enter Home Stock.

Subtasks:

1. List completed/delivered orders with pagination; do not background-poll.
2. Retrieve and validate selected order lines.
3. Deduplicate by provider order ID.
4. Propose cupboard/fridge/freezer locations using editable deterministic rules.
5. Normalize package quantities but retain original Oda descriptions.
6. Present a complete import review with include/exclude controls.

Test gate: importing the same fixture twice produces one local order. Live testing reads one order
but does not save it until the user confirms the preview.

### Release 5 — Oda-enriched Home Stock

**User value:** imported groceries become a manageable view of everything at home.

Subtasks:

1. Extend the existing local `HomeStockItem` domain with reversible Oda-sourced movement metadata.
2. Confirm reviewed order proposals as stock additions.
3. Build All, Cupboard, Fridge and Freezer views.
4. Add `Used up`, `Adjust quantity`, `Move location` and `Still have this` actions.
5. Mark amounts `exact` or `estimated` and show the last confirmed date.
6. Preserve manual food and household items that have no Oda product mapping.

Test gate: order additions, manual adjustments and reversals reproduce the expected balance after
reload. This release does not alter shopping calculations yet.

### Release 6 — advanced stock-aware shopping for Oda

**User value:** the next shopping list accounts for confirmed food already at home.

Subtasks:

1. Aggregate all weekly ingredient requirements before allocating Home Stock.
2. Convert compatible units and leave incompatible variants untouched.
3. Show `Recipe need − Home Stock = Buy` on each affected line.
4. Require confirmation before using estimated stock.
5. Offer a confirmed reversible consumption movement when a meal is marked cooked; never deduct automatically.
6. Never replace the original recipe requirement or hide a deduction explanation.

Test gate: cover multiple recipes sharing one ingredient, partial stock, variant mismatch, estimated
stock, insufficient stock and stock added after a cart draft. Old drafts become stale automatically.

**This is the complete Oda + Home Stock MVP.**

## Recommended models by subtask

These models are for Codex implementation, not runtime features inside Family Table.

| Work item | Recommended model | Reasoning | Why |
| --- | --- | --- | --- |
| MCP capability spike and schema analysis | `gpt-5.6-sol` | xhigh | Unstable external contract and high consequence assumptions |
| Threat model, loopback security and write semantics | `gpt-5.6-sol` | xhigh | Credentials and irreversible external mutations |
| Companion/provider foundation | `gpt-5.6-sol` | high | Cross-process lifecycle and validation |
| IndexedDB repository and migrations | `gpt-5.6-sol` | high | Persistence correctness and rollback |
| Connection and review UI | `gpt-5.6-terra` | high | Bounded product UX using existing design system |
| Recipe text/JSON parsing and unit normalization | `gpt-5.6-sol` | high | Unstructured inputs and quantity correctness |
| Recipe import/review UI and starter choice | `gpt-5.6-terra` | high | Bounded onboarding flow using existing recipe forms |
| Duplicate warnings and editable tag rules | `gpt-5.6-terra` | medium | Deterministic local heuristics |
| Ingredient canonicalization and qualifier rules | `gpt-5.6-sol` | high | Long-tail matching and regression risk |
| Unit conversion and package coverage | `gpt-5.6-sol` | xhigh | Small errors create wrong quantities |
| Cart confirmation/idempotency/reconciliation | `gpt-5.6-sol` | xhigh | External write correctness |
| Order list/import UI | `gpt-5.6-terra` | high | Standard reviewed import flow |
| Order normalization and idempotent import | `gpt-5.6-sol` | high | External schemas and duplicate prevention |
| Home Stock domain and stock allocation | `gpt-5.6-sol` | xhigh | Shared quantities, variants and reversibility |
| Home Stock screens and quick actions | `gpt-5.6-terra` | high | Bounded UI and responsive interaction work |
| Visual/accessibility regression pass | `gpt-5.6-terra` | high | Broad but routine UI verification |
| Docs, fixture maintenance and mechanical cleanup | `gpt-5.6-terra` | medium | Lower-risk implementation support |

## Effort and batching recommendation

These are relative implementation ranges, not calendar commitments; live MCP behavior dominates the
uncertainty.

| Delivery package | Releases | Relative effort | Recommended batching |
| --- | --- | --- | --- |
| A — prove, connect and onboard | 0–2A | Medium–large | Foundation/read-only work plus a separate onboarding release before writes |
| B — save shopping time | 3 | Medium–large | One focused vertical slice; ship independently |
| C — build household stock | 4–6 | Large | Three separate releases with real-use feedback between them |

Do not combine Packages B and C into one build. Cart matching will reveal the product/quantity data
quality needed by Home Stock, and real use should influence the inventory UX.

## C. Three implementation prompts

### Prompt 1 — setup and capability gate

> Work in `meal-planner-v2` and follow `docs/ODA_MVP_DELIVERY_PLAN.md` plus
> `docs/ODA_INTEGRATION_PLAN.md`. Complete Release 0 and scaffold only the non-UI parts of Release 1:
> capability report, ADR/threat model, `companion/` workspace, allowlisted `GroceryProvider`,
> `FakeGroceryProvider`, validated DTOs, feature flags and companion health endpoint. Preserve the v2
> app and existing data. Bind only to loopback and never expose credentials or arbitrary MCP calls.
> Add fixture/contract tests. Do NOT build user-facing features or call any Oda mutation tool.

### Prompt 2 — foundation and read-only product feature

> Complete Releases 1 and 2 from `docs/ODA_MVP_DELIVERY_PLAN.md`. Add the separate IndexedDB
> `IntegrationRepository` and `IntegrationProvider`; do not expand `AppProvider.tsx`. Build connection
> status and a read-only product-match preview for an existing weekly shopping list. Implement
> canonical ingredient keys, meaningful qualifiers, g/kg, ml/l and each/pack conversion, package
> coverage and remembered mappings. Every match explains itself; uncertain conversions require
> review. Test first with `FakeGroceryProvider`, then perform a read-only live smoke test. Do NOT
> implement cart writes or Home Stock screens.

### Prompt 3 — household onboarding and first shippable Oda feature

> Complete Release 2A and pass its test gate before starting Release 3 from
> `docs/ODA_MVP_DELIVERY_PLAN.md`. Add backward-compatible first-run starter choice and paste-to-draft
> recipe import for plain text and supported JSON. Require editable ingredient/quantity review,
> deterministic duplicate warnings and editable tag suggestions. Then convert a saved weekly list
> into an immutable fingerprinted cart draft. Build a responsive review UI with replace, omit and
> pack-count controls, visible shortage/surplus, a 5% recommendation tolerance and final
> confirmation. Merge only approved lines into the existing Oda cart using an idempotency key; never
> clear the cart; reconcile after the write; do not retry ambiguous writes. Add unit, fake-provider,
> error, responsive and accessibility tests. Live mutation testing requires explicit user approval
> and must begin with one low-cost test product. Do NOT build order import or Home Stock yet.

## D. Persistent Codex configuration for this MVP

Before implementation, add the following to `AGENTS.md`:

- Use `ODA_MVP_DELIVERY_PLAN.md` as the release order and do not start a later release before its
  preceding test gate passes.
- Keep integration state in `IntegrationProvider` and `IntegrationRepository`; do not add it to the
  core `AppProvider` or whole-state localStorage document.
- Every external capability is feature-detected and schema-validated.
- Real Oda tests are manual, opt-in and read-only unless the user explicitly approves a named cart
  mutation test.
- Product matching is deterministic and reviewable. No production LLM is required.
- No imported or ambiguous recipe ingredient contributes to a real cart until it has passed review.
- Home Stock represents everything in cupboard, fridge and freezer; imported purchases are proposed
  additions and all movements are reversible.
- Original recipe requirements remain visible even when Home Stock reduces the buy quantity.

## E. Getting unstuck and rollback

- **Oda MCP cannot be installed:** stop Release 0, keep fake-provider work and do not reverse-engineer
  new private endpoints as a workaround.
- **Orders are unavailable:** ship Release 3; hide Releases 4–6 until a supported source exists.
- **Product matches are poor:** collect household-confirmed mappings before adding more matching
  sophistication.
- **A cart write is ambiguous:** read/reconcile the cart and ask the user; never repeat automatically.
- **Home Stock becomes stale:** show estimated/last-confirmed state and improve confirmation flows;
  do not invent quantities.
- **A release regresses the planner:** disable that release's feature flag, retain integration data
  and fix only the failing boundary. No rewrite or destructive migration.
