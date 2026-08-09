# The Family Table — product backlog and roadmap

Updated: 9 August 2026

## Product direction

The product should reduce the mental load of deciding what a household will eat, preparing for it, and buying the right amount. The core planning loop must remain fast and reliable without an account. Integrations are optional enhancements, never prerequisites.

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

### Phase 1 — real household adoption

Goal: replace starter content with the household's actual routines.

1. **Recipe onboarding and import**
   - First-run choice to keep or remove starter recipes
   - Paste structured recipe text with an editable review step
   - Duplicate detection before saving
   - Acceptance: a family can add ten real recipes in under fifteen minutes
2. **Per-night planning details**
   - Override servings for an individual night
   - Optional note such as “grandparents visiting”
   - Freezer/pantry meal as a non-shopping plan outcome
3. **Planning quality controls**
   - Choose busy nights and favour low-attention recipes there
   - Balance vegetarian, fish and family favourites across a week
   - Explain why each generated meal was selected

### Phase 2 — Oda feasibility and read-only pilot

Goal: prove the external integration safely before allowing any cart writes.

1. Read-only Oda MCP compatibility spike and capability report
2. Local companion security design and contract fixtures
3. Conditional product search and connection-health UI
4. Order-history pilot when the upstream capability is available

### Phase 3 — reviewed Oda cart pilot

Goal: reduce the work between an approved plan and a cart without automating purchasing decisions.

1. Ingredient-to-product matching with remembered household preferences
2. Explicit pack-count, availability and substitution review
3. Confirmed, idempotent merge into the existing Oda cart
4. Checkout, payment and delivery-slot selection remain in Oda

### Phase 4 — preparation and inventory

Goal: turn a meal plan into a practical household workflow.

1. **Preparation view**
   - Sunday or previous-evening make-ahead checklist
   - Group prep tasks across recipes
   - Reminders remain opt-in and local where possible
2. **Pantry and freezer**
   - Simple quantities and “running low” state
   - Never deduct ingredients automatically without confirmation
   - Prefer recipes that use available ingredients
3. **Weather-aware suggestions**
   - Explicit household rules, not hidden automatic behavior
   - Examples: barbecue on dry evenings, soup below a chosen temperature, low-effort meals during severe weather
   - Show the reason when weather changes a suggestion

### Phase 5 — shared household product

Goal: support two or more people without losing the simplicity of the local MVP.

1. Optional household accounts and invitations
2. Near-real-time plan and shopping-list synchronization
3. Conflict-safe edits and visible change history
4. Hosted database, monitoring and recovery

## Prioritised backlog

| Priority | Feature                                   | Status   | Why it matters                                                                |
| -------- | ----------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| P0       | Versioned data migrations and JSON backup | Shipped  | Protects local household data                                                 |
| P0       | Recipe effort and make-ahead model        | Shipped  | Makes time estimates useful rather than misleading                            |
| P1       | Recipe onboarding/import                  | Next     | Starter recipes are not the household's real library                          |
| P1       | Per-night servings and notes              | Planned  | Real weeks include guests and different appetites                             |
| P1       | Freezer/pantry meal outcome               | Planned  | Different from leftovers and should not create shopping items                 |
| P1       | Make-ahead preparation view               | Planned  | Converts recipe metadata into saved time                                      |
| P1       | Oda compatibility and security spike      | No-go    | Pinned community MCP fails product tests; fake-provider foundation is safe     |
| P2       | Oda product matching and cart review      | Planned  | Useful once recipe ingredients have passed structured review                   |
| P2       | Pantry and freezer inventory              | Planned  | Improves shopping and reduces waste                                           |
| P2       | Weather-aware planning rules              | Planned  | Useful only after the forecast display earns trust                            |
| P2       | Recipe URL import                         | Research | Browser CORS and inconsistent recipe markup require a careful import boundary |
| P3       | Household synchronization                 | Later    | Requires accounts, backend and conflict handling                              |

## Product rules

- Do not hide automation. Show why a recipe or product was suggested.
- Wrongly removing an ingredient is worse than leaving an extra item for review.
- Weather and integrations must fail gracefully without blocking planning.
- Prefer structured fields for behavior-driving data; use free-text tags for discovery only.
- Add complexity only when it removes more household effort than it creates.
