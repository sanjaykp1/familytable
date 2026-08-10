# The Family Table — product backlog and roadmap

Updated: 9 August 2026

## Product direction

The product should reduce the mental load of deciding what a household will eat and keeping common food and household essentials in stock. The core loop is plan, check what is already at home, and buy only what is still needed. It must remain fast and reliable without an account; integrations are optional enhancements, never prerequisites.

The researched Oda architecture, prerequisites and phased delivery gates are documented in
[ODA_INTEGRATION_PLAN.md](./ODA_INTEGRATION_PLAN.md). The incremental implementation sequence and
per-release test gates are in [ODA_MVP_DELIVERY_PLAN.md](./ODA_MVP_DELIVERY_PLAN.md).

## Shipped foundation

- Local-first recipes, weekly plans, shopping lists, backups, themes and offline production shell
- Structured ingredient quantities and serving-based shopping calculations
- Meal generation with locking, replacement and recently-cooked deprioritisation
- Leftovers, eating out/takeaway and skipped-dinner planning outcomes
- Separate prep and cook time, cooking-attention level and make-ahead capability
- Recipe filters for make-ahead and low-attention meals
- Optional 16-day planning forecast with a manually selected location

## Roadmap

### Phase 0 — repository and delivery hygiene

Goal: make all product work recoverable and automatically checked before expanding the MVP.

1. Connect the local project to the canonical GitHub repository
2. Commit source, tests, documentation and lockfiles while excluding secrets and generated output
3. Pin the Node.js major version and document the local setup workflow
4. Run lint, client tests, companion tests and both builds in GitHub Actions
5. Require the CI check before merging once the first workflow run is green
6. Deploy the static app to Cloudflare Pages from `main` for a stable free production URL and deployment rollback

### Phase 1 — personal household loop

Goal: make the app useful every week by reconciling meal requirements and recurring household needs with what is already at home.

1. **Persistent Home Stock**
   - Track food and basic household items in cupboard, fridge, freezer, bathroom, cleaning storage or another location
   - Keep common items in the catalogue when their quantity reaches zero; zero is a valid stock state, not deletion
   - Support exact quantities where useful and an unknown/estimated state where counting would add friction
   - Add, adjust, mark used up, archive and restore items without requiring Oda
2. **Stock-aware shopping v1**
   - Show `Recipe need − confirmed stock = Buy` while preserving the original recipe requirement
   - Subtract only exact matches with compatible units; uncertain matches remain visible for review
   - Allow any zero-stock or household item to be added to the shopping list in one action
   - Support manual shopping needs that do not come from recipes
   - Never deduct stock automatically when planning, shopping or marking a meal cooked
   - Acceptance: after planning a week, the user can reconcile the list with Home Stock in under two minutes
3. **Recipe onboarding and import**
   - First-run choice to keep or remove starter recipes
   - Paste structured recipe text with an editable review step
   - Duplicate detection before saving
   - Acceptance: a family can add ten real recipes in under fifteen minutes

### Phase 2 — use-what-we-have planning and Shopping v2

Goal: turn confirmed Home Stock into useful meal choices and reduce repetitive stock checking without silently deciding what the household should buy.

1. **Cook from Home Stock**
   - Suggest saved recipes that can be made entirely from confirmed quantities already at home
   - Strict mode excludes any recipe with a missing ingredient, insufficient quantity or unresolved unit mismatch
   - Show why a recipe qualifies and how much of each item it would use
   - Do not invent a new recipe or quietly assume untracked ingredients in the first version
2. **Use-soon planning priority**
   - Let the user mark a Home Stock item as `Use soon`, optionally because it is approaching spoilage
   - Offer `Use in next plan` as a stronger planning constraint when the user wants a specific item included
   - Boost or require saved recipes containing those items and explain the resulting meal choice
   - Keep the marker until the user clears it or confirms a stock adjustment; planning alone never clears it
3. **Replenishment suggestions**
   - Optional reorder point and target quantity per persistent item
   - Example: bananas at `0`, reorder point `2`, target `6` produces a suggestion to buy `6`
   - Suggestions require accept or dismiss; they do not silently enter the active shopping list
   - When recipe demand and a top-up rule overlap, buy the larger requirement rather than adding them together
4. **Per-night planning details**
   - Override servings for an individual night
   - Optional note such as “grandparents visiting”
   - Freezer/pantry meal as a non-shopping plan outcome
5. **Planning quality controls**
   - Choose busy nights and favour low-attention recipes there
   - Balance vegetarian, fish and family favourites across a week
   - Explain why each generated meal was selected

### Phase 3 — Oda feasibility and read-only pilot

Goal: prove the external integration safely before allowing any cart writes.

1. Read-only Oda MCP compatibility spike and capability report
2. Local companion security design and contract fixtures
3. Conditional product search and connection-health UI
4. Order-history pilot when the upstream capability is available

### Phase 4 — reviewed Oda cart pilot

Goal: reduce the work between an approved plan and a cart without automating purchasing decisions.

1. Ingredient-to-product matching with remembered household preferences
2. Explicit pack-count, availability and substitution review
3. Confirmed, idempotent merge into the existing Oda cart
4. Checkout, payment and delivery-slot selection remain in Oda

### Phase 5 — preparation and adaptive planning

Goal: turn a meal plan into a practical household workflow.

1. **Preparation view**
   - Sunday or previous-evening make-ahead checklist
   - Group prep tasks across recipes
   - Reminders remain opt-in and local where possible
2. **Weather-aware suggestions**
   - Explicit household rules, not hidden automatic behavior
   - Examples: barbecue on dry evenings, soup below a chosen temperature, low-effort meals during severe weather
   - Show the reason when weather changes a suggestion

### Phase 6 — shared household product

Goal: support two or more people without losing the simplicity of the local MVP.

1. Optional household accounts and invitations
2. Near-real-time plan and shopping-list synchronization
3. Conflict-safe edits and visible change history
4. Hosted database, monitoring and recovery

## Prioritised backlog

| Priority | Feature                                      | Status   | Why it matters                                                                |
| -------- | -------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| P0       | Versioned data migrations and JSON backup    | Shipped  | Protects local household data                                                 |
| P0       | Persistent Home Stock catalogue              | Next     | Common items must remain useful even when their quantity is zero               |
| P0       | Stock-aware shopping reconciliation          | Next     | Answers what still needs to be bought after checking the home                  |
| P1       | Manual household needs                       | Next     | Shopping includes toiletries and cleaning supplies, not only recipe items      |
| P1       | Recipe onboarding/import                     | Planned  | Starter recipes are not the household's real library                          |
| P1       | Cook entirely from Home Stock                | Planned  | Produces a useful meal without creating a new shopping requirement             |
| P1       | Use-soon meal-plan priority                  | Planned  | Helps consume food before it spoils                                            |
| P1       | Replenishment suggestions                    | Planned  | Reduces repeated checking while keeping additions reviewable                   |
| P1       | Per-night servings, notes and stock meal      | Planned  | Real weeks include guests and meals that should not generate shopping          |
| P1       | Make-ahead preparation view                  | Planned  | Converts recipe metadata into saved time                                      |
| P2       | Oda compatibility and security spike         | No-go    | Pinned community MCP fails product tests; fake-provider foundation is safe     |
| P2       | Oda product matching and cart review         | Planned  | Useful once recipe ingredients have passed structured review                   |
| P2       | Weather-aware planning rules                 | Planned  | Useful only after the forecast display earns trust                            |
| P2       | Recipe URL import                            | Research | Browser CORS and inconsistent recipe markup require a careful import boundary |
| P3       | Household synchronization                    | Later    | Requires accounts, backend and conflict handling                              |

## Product rules

- Do not hide automation. Show why a recipe or product was suggested.
- Wrongly removing an ingredient is worse than leaving an extra item for review.
- A Home Stock item at zero remains a household item until the user explicitly archives or deletes it.
- Replenishment rules create suggestions, not silent shopping-list additions.
- “Cook from Home Stock” means every required ingredient is confirmed available; it does not hide shortages or assume untracked staples.
- A `Use soon` marker affects ranking or an explicit planning constraint, but never consumes stock by itself.
- Weather and integrations must fail gracefully without blocking planning.
- Prefer structured fields for behavior-driving data; use free-text tags for discovery only.
- Add complexity only when it removes more household effort than it creates.
