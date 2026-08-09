# Family Table v2 engineering conventions

## Product boundary

The MVP is a local-only, offline-capable family dinner planner. It has no backend, accounts, analytics, or external writes. Persistence must remain behind `MealPlannerRepository` so a future household-sync adapter can replace local storage without changing feature code.

## Stack

- React + TypeScript + Vite
- CSS modules are not used; shared tokens and component classes live in `src/styles`
- Vitest for domain and repository tests
- Lucide React for icons; do not use emoji as interface icons
- Fontsource packages for offline fonts

## Folder rules

- `src/domain`: pure types and business logic, with no browser or React imports
- `src/repositories`: persistence adapters only
- `src/app`: provider, shell, navigation, and application composition
- `src/features/<feature>`: feature pages and feature-specific components
- `src/components/ui`: reusable visual primitives
- `src/integrations`: boundaries for future external systems
- `src/styles`: tokens and global component styling

## Data rules

- All persisted data conforms to `AppState` and includes `schemaVersion`.
- Dates are local `YYYY-MM-DD` strings unless an audit timestamp explicitly needs ISO datetime.
- Mutations create new objects; do not mutate context state in place.
- UI components never access `localStorage` directly.
- Import validates data before replacing the current state.
- Weather stores only a user-selected location. Forecast failures must never block local planning.

## UI rules

- Use design tokens from `tokens.css`; do not hardcode colour, spacing, radius, or shadow values in components.
- Body and controls use Manrope. Product headings and card display text use Geist at distinct weights; do not introduce italic or thin display faces.
- Interactive targets must be at least 44×44px.
- Every icon-only button requires an accessible label and tooltip/title.
- Mobile navigation has four primary destinations: Plan, Recipes, Shop, Settings.
- Destructive actions require an in-product confirmation, not `window.confirm()`.

## Error pattern

- Domain functions throw `DomainError` for expected invalid input.
- Repository errors become a persistent storage warning and retain in-memory state.
- User actions report success or failure through the shared toast system.
- Unexpected errors are caught by the application error boundary.

## Testing

- Every domain feature needs a happy path, edge case, and error/regression test.
- Run `npm run check` before handing off changes.
- Prefer pure domain tests over brittle DOM snapshots.

## Future integrations

- Use `docs/ODA_MVP_DELIVERY_PLAN.md` as the Oda/Home Stock release order. Do not start a later release before the preceding test gate passes.
- Keep integration state in a separate `IntegrationProvider` and `IntegrationRepository`; do not add it to `AppProvider` or the whole-state localStorage document.
- Every external capability is feature-detected and schema-validated.
- Real Oda tests are manual, opt-in, and read-only unless the user explicitly approves a named cart mutation test.
- Product matching is deterministic and reviewable. Do not require a production LLM.
- No imported or ambiguous recipe ingredient contributes to a real cart until it has passed review.
- Home Stock includes cupboard, fridge, and freezer. Imported purchases are proposed additions, and all movements are reversible.
- Original recipe requirements remain visible even when Home Stock reduces the buy quantity.
- Oda access belongs behind the local companion. Credentials and cookies must never enter React, browser storage, browser responses, or logs.
- The companion binds only to loopback and exposes allowlisted business operations, never a generic MCP passthrough.
- A cart write requires a fresh preview, explicit confirmation, and an idempotency key. It never checks out, chooses delivery, replaces the cart, or automatically retries an ambiguous outcome.
- AI features must degrade gracefully and cannot be required for planning, recipes, or shopping.
- Weather integrations are read-only and must retain visible provider attribution.
