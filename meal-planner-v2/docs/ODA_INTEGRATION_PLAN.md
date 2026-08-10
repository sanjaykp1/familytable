# Oda integration architecture and delivery plan

Updated: 9 August 2026

## Decision summary

Build Oda as an optional local companion integration, not as code running directly in the browser.
The first useful release should turn a confirmed Family Table shopping list into a reviewed set of
Oda products and then add only the approved lines to the user's Oda cart. Checkout, payment and
delivery-slot selection remain in Oda.

Core local Home Stock is now a Phase 1 product priority and must be built independently of Oda. Within
the Oda integration sequence, first complete recipe onboarding and ingredient review, run a short
MCP compatibility spike, then ship read-only Oda product/order data before enabling cart writes or
order-driven stock imports. Order history may later suggest preferred products and Home Stock
additions, but a purchase is not proof that an item is still in the home.

## What the current Oda integrations appear to support

### Evidence and confidence

- A directory snapshot attributes an `oda-mcp` project to `kolonialno` and documents product
  search/details, related products, a personalised feed, cart read/write, and paginated order
  history with full order details. Its setup stores Oda credentials in a local configuration file.
- The referenced `kolonialno/oda-mcp` GitHub repository currently returns 404. The directory marks
  the entry as unclaimed and not tested, so its first-party status, support policy and current
  installability cannot be relied on yet.
- A separate public community project, `gbbirkisson/mcp-oda`, currently supports product search,
  Oda recipes and cart management. Its own technical notes show that it relies on Oda's web pages,
  session cookies, CSRF tokens and private REST endpoints rather than a published partner API.
- Oda's ordering guide says availability and prices are updated after a delivery slot is chosen.
  Neither inspected MCP exposes delivery-slot selection, so a cart preview cannot promise the final
  checkout price or availability.

### Capability matrix

| Capability | `kolonialno/oda-mcp` directory snapshot | Public community MCP | Product decision |
| --- | --- | --- | --- |
| Search products | Documented | Available | Build behind an adapter |
| Product details | Documented | Search data available | Use only fields needed for review |
| Alternatives/related products | Documented | Not clearly exposed | Optional enhancement |
| Read cart | Documented | Available | Include in the spike |
| Add/remove/clear cart | Documented | Available | Require explicit confirmation |
| Order history and line items | Documented | Not exposed | Conditional on upstream availability |
| Oda recipe search/import | Not documented | Available | Optional; not needed for cart MVP |
| Delivery slots | Listed as future work | Not exposed | Keep in Oda |
| Checkout/payment/place order | No evidence | No evidence | Never claim or automate |
| Delivery tracking/cancellations | No evidence | No evidence | Out of scope |

## Which prerequisites are actually needed?

| Feature | Before MCP spike? | Before cart sync? | Before order-history import? | Recommendation |
| --- | --- | --- | --- | --- |
| Keep/remove starter recipes | No | Yes | No | Do early so demo recipes never create a real cart |
| Paste/structured recipe import | No | Yes for a useful household flow | No | Build before cart UI |
| Ingredient and quantity review | No | **Yes** | No | Hard gate; ordering cannot guess silently |
| Duplicate detection | No | Strongly recommended | No | Deterministic name + ingredient fingerprint first |
| Tag suggestions | No | No | No | Bundle with onboarding, but keep rules editable |
| Local Home Stock and reconciliation | No | No | No | Build earlier in product Phase 1 without Oda |
| Oda-driven stock additions | No | No | Yes | Add only after reviewed order import is available |

The shortest responsible sequence is therefore:

1. Run the Oda compatibility and security spike now.
2. Complete starter-recipe choice plus paste → review → save onboarding.
3. Add read-only product search, connection health and (if available) order history.
4. Add product matching and a mandatory cart review.
5. Enable confirmed, idempotent cart writes.
6. Enrich existing Home Stock with reviewed order additions and confirmed product mappings.

## A. Tech stack recommendation

Keep React, TypeScript, Vite, Vitest and the current repository pattern for the app. Add a small
TypeScript/Node local companion service that binds only to `127.0.0.1`, talks to an allowlisted Oda
MCP process over stdio, and exposes narrow JSON endpoints to the browser. Use an MCP client SDK,
Zod validation and a lightweight HTTP server; do not expose a generic “call any MCP tool” route.

Keep core planner data in the existing local repository. Store Oda product mappings, compact order
records and cart drafts in a separate IndexedDB-backed `IntegrationRepository`, because order data
can grow beyond the safe size for whole-state `localStorage` writes. No production LLM is required
for product matching: use deterministic normalization, confirmed mappings and user review.

## B. Architecture foundation

### Core entities and relationships

**Plain English:** A shopping item expresses what the household needs; a product mapping records
which Oda product the household prefers for that ingredient. A cart draft combines those two and
must be reviewed before anything is written to Oda. Imported orders improve future suggestions but
never silently change the pantry.

**Technical spec:**

- `ShoppingItem` remains the source requirement from an approved week.
- `ExternalProduct` is a short-lived Oda catalogue result.
- `ProductMapping` links a normalized ingredient key to a confirmed Oda product ID.
- `CartDraft` contains immutable preview lines, source shopping-list revision and status.
- `ExternalOrder` contains an Oda order ID, dates, totals and minimal normalized line items.
- `HomeStockItem` belongs to the core planner and records user-confirmed on-hand quantity separately from Oda purchases.

### Data layer

**Plain English:** Meal plans continue to work exactly as they do now, even if Oda is disconnected.
Integration records live in a separate local store so an Oda outage or a large order history cannot
damage the core planner.

**Technical spec:**

```ts
interface ProductMapping {
  provider: 'oda';
  ingredientKey: string;
  productId: string;
  productName: string;
  packQuantity: number | null;
  packUnit: string;
  confirmedAt: string;
}

interface CartDraftLine {
  shoppingItemId: string;
  requestedQuantity: number | null;
  requestedUnit: string;
  productId: string | null;
  productName: string;
  packCount: number;
  confidence: 'confirmed' | 'likely' | 'review-required';
  reason: string;
  availability: 'available' | 'unavailable' | 'unknown';
  priceNok: number | null;
}

interface CartDraft {
  id: string;
  weekStart: string;
  sourceFingerprint: string;
  status: 'draft' | 'confirmed' | 'applied' | 'stale';
  lines: CartDraftLine[];
  createdAt: string;
  appliedAt: string | null;
}
```

Use a new `IntegrationRepository` contract with IndexedDB as its local implementation. Store only
transactionally useful order fields; do not cache product images, recipe images, addresses, payment
details or account credentials. Cap imported order history by an explicit user-selected period.

### Authentication and identity

**Plain English:** The browser never sees or stores an Oda password. Oda authentication belongs to
the local MCP/companion process, and “connected” means the companion can successfully identify the
current account without returning personal details to the UI.

**Technical spec:** Bind the companion to loopback only; allow only the app origin; protect every
route with a per-install random token; redact headers, cookies, emails and payloads from logs. Reuse
the upstream MCP's protected configuration/session store. Provide `GET /v1/oda/status` returning
only `{connected, capabilities, providerVersion}`. Never accept credentials through a React form.

### API and service pattern

**Plain English:** The app asks for specific outcomes—search, preview, confirm—not arbitrary Oda
commands. This keeps the integration testable and limits the damage from an upstream change.

**Technical spec:**

- `GET /v1/oda/status`
- `GET /v1/oda/products?q=...`
- `GET /v1/oda/cart`
- `POST /v1/oda/cart-drafts` with `{weekStart, shoppingFingerprint}`
- `PATCH /v1/oda/cart-drafts/:id/lines/:lineId`
- `POST /v1/oda/cart-drafts/:id/apply` with `{confirmationToken, mode:'merge'}`
- `GET /v1/oda/orders?cursor=...` only when the capability is advertised
- `POST /v1/oda/orders/:id/import` for a compact local record

Every response uses `{data, error, meta}`. Every write carries an idempotency key. `apply` refuses
stale drafts when the Family Table shopping-list fingerprint has changed. Do not implement a clear
or replace-cart action in the first release; merge approved lines into the existing Oda cart.

### External integration boundary

**Plain English:** Family Table owns the workflow; Oda MCP is replaceable plumbing. If the MCP
disappears, planning and shopping lists still work and only the “Send to Oda” action is unavailable.

**Technical spec:** Keep provider-specific code under `companion/src/providers/oda/`. Implement a
provider-neutral `GroceryProvider` interface for `capabilities`, `searchProducts`, `getCart`,
`applyCartLines`, `listOrders` and `getOrder`. At startup, inspect MCP tools and advertise only
capabilities that pass schema validation. Pin the upstream revision and maintain fixture-based
contract tests. No direct Oda REST calls from the React app.

### Error handling

**Plain English:** Oda failures should explain what happened without losing the user's work. A cart
draft stays local until the user can retry, and ambiguous writes trigger a fresh cart comparison.

**Technical spec:** Map errors to `not_connected`, `upstream_changed`, `rate_limited`,
`unavailable`, `product_unavailable`, `stale_preview` and `write_outcome_unknown`. Never retry cart
writes automatically. For an unknown write outcome, read the cart, reconcile by product ID and ask
the user before trying again. Network or MCP failure never alters `AppState`.

### Design system and reusable components

**Plain English:** Oda should feel like part of Family Table, not a second application embedded
inside it. Product decisions use the current typography, tokens and review-first visual language.

**Technical spec:** Reuse `Button`, `Card`, `Modal`, `EmptyState` and `ToastViewport`. Add
`ConnectionStatus`, `ProductMatchRow`, `ConfidenceBadge`, `PackQuantityControl`, `CartDraftSummary`,
`OrderImportRow` and `IntegrationErrorState`. Product images are not required for v1. All colours,
spacing, radii and type use existing tokens.

### Folder structure

```text
meal-planner-v2/
  src/
    domain/integrations/          # provider-neutral matching and reconciliation logic
    features/onboarding/          # starter choice and recipe import/review
    features/oda/                 # connection, product review, orders UI
    integrations/oda/             # browser client + validated DTOs only
    repositories/integrationRepository.ts
    repositories/indexedDbIntegrationRepository.ts
  companion/
    src/server.ts
    src/security/
    src/providers/groceryProvider.ts
    src/providers/oda/mcpClient.ts
    src/providers/oda/mapper.ts
    src/routes/oda.ts
    tests/contracts/
```

### Testing approach

**Plain English:** Most tests use recorded, anonymised fixtures and never touch the real cart. A
small manual smoke test uses a real account only after read-only checks pass.

**Technical spec:** Add unit tests for normalization, unit conversion, package rounding, duplicate
detection, fingerprinting and reconciliation. Add companion contract tests for every advertised MCP
tool. Add integration tests with a fake `GroceryProvider`. Real-account tests are opt-in, read-only by
default and must never run in CI. One manual cart-write test adds a clearly identified low-cost item,
verifies it, then removes it with the user's approval.

### Deployment

**Plain English:** This remains local-only. During development, the app and companion run together;
later they can be packaged as one desktop app if the integration proves useful.

**Technical spec:** Development uses Vite plus a loopback Node companion. Do not expose the
companion on the LAN or deploy it publicly. After the pilot, evaluate Tauri 2 as a packaging shell
with the companion bundled as a sidecar. Code signing, auto-update and credential-store integration
are a later packaging phase, not prerequisites for the local pilot.

## Recommended delivery plan and implementation models

The models below are for Codex implementation work, not models embedded in the product. Use the
lower-cost `gpt-5.6-terra` for bounded UI and mechanical work; reserve `gpt-5.6-sol` for security,
unreliable external contracts and reconciliation logic.

| Phase | Subtask | Model / reasoning | Done when |
| --- | --- | --- | --- |
| 0 — feasibility gate | Confirm which Oda MCP can currently install; capture tool schemas/version; verify read-only login, search, cart and orders | `gpt-5.6-sol`, xhigh | Reproducible capability report; no cart mutation |
| 0 — feasibility gate | Write threat model and architecture decision record for loopback companion | `gpt-5.6-sol`, high | Credentials, CORS, tokens, logs and write confirmation covered |
| 0 — feasibility gate | Build anonymised MCP response fixtures and contract tests | `gpt-5.6-sol`, high | Upstream schema drift fails clearly |
| 1 — onboarding | Add first-run keep/remove starter choice and schema migration | `gpt-5.6-terra`, medium | Existing users unaffected; new users choose once |
| 1 — onboarding | Parse pasted text/JSON into a recipe draft with unit normalization | `gpt-5.6-sol`, high | Happy, incomplete and malformed inputs tested |
| 1 — onboarding | Build ingredient/quantity review screen before save | `gpt-5.6-terra`, high | Every parsed field is editable; no silent save |
| 1 — onboarding | Add deterministic duplicates and editable tag suggestions | `gpt-5.6-terra`, medium | Warnings do not block intentional duplicates |
| 2 — read-only Oda | Scaffold loopback companion, token/CORS controls and health endpoint | `gpt-5.6-sol`, high | Browser cannot access generic MCP tools or credentials |
| 2 — read-only Oda | Implement product search and validated catalogue mapping | `gpt-5.6-sol`, high | Search failures degrade to the local shopping list |
| 2 — read-only Oda | Implement optional order-history summaries and detail import | `gpt-5.6-sol`, high | Only available when capability exists; paginated and deduplicated |
| 2 — read-only Oda | Build connection and order-history UI | `gpt-5.6-terra`, high | Clear connected/disconnected/unsupported states |
| 3 — cart pilot | Build ingredient normalization, unit conversion, pack rounding and remembered mappings | `gpt-5.6-sol`, xhigh | No line with uncertain quantity is auto-approved |
| 3 — cart pilot | Build product and quantity review UI | `gpt-5.6-terra`, high | User can replace, omit or change every product/pack count |
| 3 — cart pilot | Add idempotent confirmed cart merge and post-write reconciliation | `gpt-5.6-sol`, xhigh | One confirmation causes one explainable cart change |
| 3 — cart pilot | Responsive and accessibility QA | `gpt-5.6-terra`, high | Keyboard, screen-reader labels and mobile review pass |
| 4 — pantry | Model pantry/freezer quantities, locations and confidence | `gpt-5.6-sol`, high | Purchases and on-hand stock remain distinct |
| 4 — pantry | Build quick confirm/use-up/adjust flows | `gpt-5.6-terra`, high | Updating stock is faster than editing a spreadsheet |
| 4 — pantry | Suggest pantry additions from imported orders and subtract confirmed stock from drafts | `gpt-5.6-sol`, high | Every inventory change requires confirmation and is reversible |

### Release gates

1. **Go/no-go after Phase 0:** stop if no maintained MCP is installable, authentication contradicts
   Oda's current terms, or schemas cannot be pinned and validated.
2. **Read-only beta after Phase 2:** product search and orders may ship without any cart write.
3. **Cart pilot after Phase 3:** enable for one household behind a local feature flag.
4. **Pantry after observed use:** build only after cart reviews reveal which stock decisions actually
   create friction.

## C. Phased implementation prompts

### Prompt 1 — prerequisite foundation

> In `meal-planner-v2`, implement recipe onboarding without touching Oda. Add a backward-compatible
> schema migration, a first-run keep/remove starter choice, and a paste-to-draft recipe importer for
> plain text and JSON. Every imported recipe must pass through an editable ingredient and quantity
> review before save. Add deterministic duplicate warnings and editable tag suggestions. Follow
> `AGENTS.md`, preserve existing local data, and add happy-path, edge-case and malformed-input tests.
> Do not build Oda screens or make network calls.

### Prompt 2 — local read-only integration

> Add the `companion/` TypeScript service and provider-neutral contracts described in
> `docs/ODA_INTEGRATION_PLAN.md`. Bind only to `127.0.0.1`; enforce an app-origin allowlist and a
> per-install token; never expose credentials or a generic MCP proxy. Connect to a pinned Oda MCP,
> inspect its tools, validate outputs with schemas, and expose only status, product search, cart read
> and order-history read endpoints when supported. Add anonymised fixtures, fake-provider tests and
> clear degraded states in the React app. Do not implement any cart mutation.

### Prompt 3 — reviewed cart pilot

> Build the reviewed Oda cart pilot on the read-only foundation. Convert a saved weekly shopping
> list into a versioned `CartDraft`, normalize ingredients and units, remember user-confirmed product
> mappings, round to explicit package counts and mark uncertain lines `review-required`. Build a UI
> where every line can be replaced, omitted or adjusted. Only a separate confirmation action may
> merge approved lines into the Oda cart. Use idempotency keys, refuse stale drafts, never clear the
> user's existing cart, reconcile after ambiguous failures, and leave checkout/payment/delivery slots
> in Oda. Add unit, integration and responsive accessibility tests.

## D. Persistent Codex rules to apply before implementation

Add these rules to `AGENTS.md` when Phase 0 begins:

- Oda credentials, cookies and session tokens never enter React state, browser storage or logs.
- The companion binds to loopback only and exposes allowlisted business operations, never arbitrary
  MCP tool execution.
- External reads are schema-validated. Unsupported capabilities are hidden, not simulated.
- Cart writes require a fresh preview, explicit confirmation and an idempotency key.
- Never automate checkout, payment, delivery-slot selection or order placement without a new product
  decision and verified upstream support.
- Imported orders are purchase history, not pantry truth. Pantry changes are explicit and reversible.
- Planning, recipes and local shopping lists must continue to work when Oda is unavailable.

## E. Getting unstuck

- **The MCP repository disappears or changes:** keep the provider disabled, retain fixture tests and
  update only the adapter; do not bypass it with browser scraping in React.
- **A cart write times out:** read and reconcile the Oda cart; never automatically repeat the write.
- **Product matching is weak:** improve normalized ingredient keys and remembered mappings before
  adding AI. Keep low-confidence results in review.
- **Order history is unavailable:** ship product search and reviewed cart independently.
- **The companion feels cumbersome:** prove the workflow first, then package it with Tauri; do not
  introduce desktop packaging before the integration is useful.

## Research links

- [Cached `kolonialno/oda-mcp` capability and setup page](https://glama.ai/mcp/servers/kolonialno/oda-mcp)
- [Public community Oda MCP](https://github.com/gbbirkisson/mcp-oda)
- [Community MCP notes on Oda web and private REST data](https://github.com/gbbirkisson/mcp-oda/blob/main/ODA_API.md)
- [Oda ordering guide](https://oda.com/no/about/bestilling/)
- [Oda user and sales terms](https://oda.com/no/legal/betingelser/)
