# The Family Table v2

A local-first family meal and household-supply planner designed as a fast MVP with a clean path to shared household sync and Oda integration later.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Quality checks

```bash
npm run check
```

## Production release

- Stable HTTPS URL: [https://family-table-1gb.pages.dev](https://family-table-1gb.pages.dev)
- Immutable deployment URL: [https://e7280bfc.family-table-1gb.pages.dev](https://e7280bfc.family-table-1gb.pages.dev)
- Deployed commit: `4b65c8a880863ff8b5fb40868123da2987d03a84`
- Production branch: `main`; project root: `meal-planner-v2`; Node.js: `24`; build: `npm run build`; output: `dist`
- Release gate: blocked because both production URLs currently return `index.html` with HTTP 200
  for a missing JavaScript asset. Offline reload, recovery and Guided interaction checks passed.

Release verification, rollback status, and the two-cycle trial are recorded in [`docs/DOGFOOD_LOG.md`](docs/DOGFOOD_LOG.md).

## MVP scope

- Plan any week and move between weeks
- Generate, lock, replace, and mark dinners as cooked
- Create and edit structured recipes with servings and ingredient quantities
- Compare prep time, cook time, cooking attention and make-ahead options
- Aggregate a weekly shopping list and use it as a checklist
- Optionally view a location-based forecast alongside the weekly plan
- Persist everything locally and work offline after the first load
- Export, import, and reset local data

## Deliberately deferred

- Accounts and household synchronization
- Automatic stock depletion
- Recipe URL import
- Oda order and cart integration
- AI recommendations

The deferred capabilities have explicit architecture boundaries so they can be added without rewriting the MVP.

## Next MVP priority

Home Stock, replenishment suggestions, stock-only planning and Guided meal inspiration are deployed.
The active release blocker is production missing-asset handling; do not treat Guided P1 as fully
released until a missing asset returns a non-HTML error response and both production URLs are
reverified.

See [`docs/BACKLOG.md`](docs/BACKLOG.md) for the maintained feature backlog and phased roadmap.
