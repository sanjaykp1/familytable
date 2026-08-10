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

Persistent Home Stock and stock-aware shopping are next. Common food and household items remain in the catalogue at quantity zero, can be added to the shopping list directly, and reduce recipe shopping quantities only when the match is confirmed and units are compatible. The following planning enhancement will suggest saved recipes that need no new ingredients and prioritise stock explicitly marked `Use soon`.

See [`docs/BACKLOG.md`](docs/BACKLOG.md) for the maintained feature backlog and phased roadmap.
