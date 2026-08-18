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
- Immutable deployment URL: [https://e7280bfc.family-table-1gb.pages.dev](https://e7280bfc.family-table-1gb.pages.dev)
- Deployed commit: `4b65c8a880863ff8b5fb40868123da2987d03a84`
- Production branch: `main`; project root: `meal-planner-v2`; Node.js: `24`; build: `npm run build`; output: `dist`
- Release gate: blocked because missing JavaScript assets currently receive the HTML shell from
  both production URLs. Offline reload, JSON recovery and Guided interaction checks passed.

See [`meal-planner-v2/docs/DOGFOOD_LOG.md`](meal-planner-v2/docs/DOGFOOD_LOG.md) for release verification, rollback status, and the two-cycle trial.

## Current scope

See the [product backlog](meal-planner-v2/docs/BACKLOG.md) and [architecture blueprint](meal-planner-v2/docs/BLUEPRINT.md).
