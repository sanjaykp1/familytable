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

Home Stock, replenishment suggestions and stock-only planning are implemented. The current release work is to unify ingredient matching, add safe metric conversions, reserve stock for locked meals, harden browser backup/recovery, and then deploy one stable build for a two-cycle household trial.

See [`docs/BACKLOG.md`](docs/BACKLOG.md) for the maintained feature backlog and phased roadmap.
