# Family Table

Family Table is a local-first family meal planner for building a weekly dinner plan and turning it into an editable shopping list. The current MVP works without an account and keeps household data in the browser, with portable JSON backup and restore.

The application lives in [`meal-planner-v2`](meal-planner-v2). Product and architecture decisions live in [`meal-planner-v2/docs`](meal-planner-v2/docs).

## Local development

Prerequisite: Node.js 24.

```bash
cd meal-planner-v2
npm ci
npm run dev
```

Run the complete quality gate before committing:

```bash
npm run check
```

## Repository workflow

- `main` should always pass the `CI` GitHub Actions check.
- Create short-lived branches with the `codex/` prefix for implementation work.
- Do not commit `.env` files, credentials, dependencies, build output, coverage, or local browser backups.
- Keep `package-lock.json` committed so local and CI installs are reproducible.
- Use pull requests once more than one person or device is contributing regularly.

## Data safety

The MVP is local-first. Browser storage is not a remote backup, so export a JSON backup before clearing site data or changing devices. Accounts and household synchronization are deliberately deferred until the shared-family beta.

## Production release

- Stable HTTPS URL: [https://family-table-1gb.pages.dev](https://family-table-1gb.pages.dev)
- Immutable deployment URL: [https://954c5ce5.family-table-1gb.pages.dev](https://954c5ce5.family-table-1gb.pages.dev)
- Deployed commit: `1cff9d1b1091b8cf7d3109d5a8a2c6c65465abe3`
- Production branch: `main`; project root: `meal-planner-v2`; Node.js: `24`; build: `npm run build`; output: `dist`
- Release gate: passed. Both production URLs return a plain-text HTTP 404 for a missing JavaScript
  asset and passed normal load, offline reload, JSON recovery and Guided interaction checks.

See [`meal-planner-v2/docs/DOGFOOD_LOG.md`](meal-planner-v2/docs/DOGFOOD_LOG.md) for release verification, rollback status, and the two-cycle trial.

## Current scope

See the [product backlog](meal-planner-v2/docs/BACKLOG.md) and [architecture blueprint](meal-planner-v2/docs/BLUEPRINT.md).
