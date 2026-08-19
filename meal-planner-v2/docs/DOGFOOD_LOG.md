# Family Table — two-cycle dogfood log

Status: Guided P1 released; Cycle 1 remains incomplete

Stable production URL: https://family-table-1gb.pages.dev

Deployed commit: `1cff9d1b1091b8cf7d3109d5a8a2c6c65465abe3`

Immutable deployment URL: https://954c5ce5.family-table-1gb.pages.dev

Trial start: 2026-08-16

Trial end: _after Cycle 2_

## Gate 0 release record

- Product-owner override (2026-08-16): Gate 0 is declared complete. The remaining two-cycle
  dogfood and deployed manual-recovery evidence requirements are waived, not passed. The incomplete
  entries below are retained and must not be cited as successful evidence.

- Production branch: `main`
- Project root: `meal-planner-v2`
- Node.js: `24`
- Build command: `npm run build`
- Output directory: `dist`
- Deployment status: successful at 2026-08-16T11:01:03Z
- Deployed version verification: Cloudflare production metadata reports commit
  `29f8b3a3b5bfc563c0fa9c151c299316d26cca36`, `main`, and a successful deploy stage.
- Normal production load: passed at the stable URL with no browser-console errors.
- Offline readiness: failed. At 2026-08-16 13:29 CEST, an actual offline reload was confirmed not
  to work. The service worker pre-caches the HTML shell, manifest and icon but not the built
  JavaScript/CSS assets, and its runtime cache write is not tied to the fetch event lifetime. This
  is a planned P0 stop-ship fix; successful `sw.js` and manifest responses did not prove offline
  operation.
- JSON export: passed; the Settings view recorded `Last successful backup` on the deployed origin.
  Import and the full deployed recovery journey were not completed. Their remaining manual
  evidence requirement is waived by the product owner, not passed.
- Previous successful production deployment: none — this is the first production deployment for `family-table`.
- Rollback target: none. Do not issue a Pages rollback while no earlier successful production deployment exists. After the next verified production deployment, use that prior deployment's ID as the target; confirm its SHA, then `POST /accounts/71c88e3824ed61fa2f19d4911075478f/pages/projects/family-table/deployments/<previous-deployment-id>/rollback`.

## Guided production candidate — 18 August 2026

- Reviewed change commit: `56e2059e5995bb0076e6dde31b1bd65daf1f4995`.
- Released merge commit: `4b65c8a880863ff8b5fb40868123da2987d03a84` via PR #1 after CI passed.
- Deployment: `e7280bfc-0d16-45c5-a1b8-c27e5773946e`, successful at
  2026-08-18T07:56:47.612Z.
- Immutable URL: https://e7280bfc.family-table-1gb.pages.dev
- Stable URL: https://family-table-1gb.pages.dev
- Production backup: export started from the pre-migration stable origin at
  2026-08-18 08:41:19 CEST. The JSON was kept local and its household contents were not inspected
  or recorded here.
- Rollback target: deployment `a2f02fd2-dbf7-4b39-966c-49c16d54f4b2`, commit
  `350f9ebaefa6c736e32f547023e1cbf15bcb3db6`, immutable URL
  https://a2f02fd2.family-table-1gb.pages.dev.
- Local gate: `git diff --check` passed; `npm run check` passed with 132 app tests, 10 companion
  tests, both builds and 9 Playwright cases. PR CI passed its single required check.
- Live normal load: both production URLs loaded the Guided picker with no captured console errors.
  The stable origin needed the service worker update cycle and a subsequent reload before the new
  shell replaced its already-cached older shell.
- Live offline/recovery: both production URLs installed and controlled a service worker, retained
  synthetic persisted data through an actual network-disabled reload, remained interactive, and
  passed UI JSON export/reset/import recovery using real browser storage.
- Live Guided flow: Monday's selected salmon recipe and Wednesday Leftovers were preserved by Plan
  my week; Tuesday's Indian intention received an Indian saved recipe; reopening Tuesday showed
  Indian alternatives and visible reasons. Before generation, the unresolved intention created no
  shopping list. Keyboard opening, Escape/focus return, 44 px controls and 320 px no-overflow checks
  passed on both URLs.
- Release blocker: a missing `.js` asset returned HTTP 200 with `text/html` on both production URLs,
  meaning the HTML shell was served for an asset request. Guided P1 is not fully released.
- Rollback: not performed. The confirmed rollback target returns the same missing-asset response,
  so rollback would not remediate the blocker.

## Guided missing-asset release unblocker — 19 August 2026

- Candidate: `ab6b03a0766d9e7fd057a683b3238acf6fa8c582`; the prior local evidence commit
  `dd7a831b4da30bfcf967316dc36f4353fc425150` was included in the same release PR as patch-equivalent
  commit `29864bc9062175b96404f9e6ebb8838c6e452027`.
- Release: PR #2 passed its required CI check and merged as
  `1cff9d1b1091b8cf7d3109d5a8a2c6c65465abe3`.
- Deployment: `954c5ce5-1e25-4dda-a86f-8a4923a28b71`, successful at
  2026-08-18T21:02:51.130958Z with `main`, the exact merge commit, `commit_dirty: false` and Pages
  Functions enabled.
- Immutable URL: https://954c5ce5.family-table-1gb.pages.dev
- Stable URL: https://family-table-1gb.pages.dev
- Pre-release production backup: the stable-origin UI export completed at
  2026-08-18 14:46:48 CEST. The retained local file is 41,857 bytes with SHA-256
  `9d8f3d81a93183a4e58cc3ee62cae5c05dbefaf8f4894647433b30fe48fa246a`; its household contents
  were not inspected or recorded here.
- Pre-release production record: deployment `e7280bfc-0d16-45c5-a1b8-c27e5773946e`, commit
  `4b65c8a880863ff8b5fb40868123da2987d03a84`, was the current successful deployment. The recorded
  rollback target was `a2f02fd2-dbf7-4b39-966c-49c16d54f4b2`; it was not used because it shared
  the routing defect. After this successful release, `e7280bfc-0d16-45c5-a1b8-c27e5773946e` is the
  immediately previous successful deployment for unrelated rollback needs.
- Local gate: `git diff --check` passed; `npm run check` passed with 132 app tests, 10 companion
  tests, both builds and 12 Playwright cases. Independent fresh-session QA reran the exact
  candidate and reported no stop-ship findings. PR #2 CI passed its single required check.
- Live normal load: the immutable and stable URLs loaded without captured console or page errors,
  installed and controlled their service workers, and remained on the app shell during valid hash
  navigation.
- Live offline/recovery: both URLs retained synthetic persisted data through an actual
  network-disabled reload, remained interactive, and passed UI JSON export/reset/import recovery
  using real browser storage.
- Live Guided flow: both URLs passed the mixed-certainty acceptance flow at 320 px, including
  keyboard opening, Escape/focus return, 44 px controls and no horizontal overflow. Monday and
  Wednesday were preserved, Tuesday satisfied its Indian intention, and the unresolved intention
  contributed no shopping items.
- Missing assets: `/assets/definitely-missing-guided-release.js` returned HTTP 404 with
  `text/plain` and `Not Found` rather than `index.html` on both URLs.
- Release decision: the missing-asset gate is cleared and Guided P1 is released. No rollback and no
  second Pages deployment were performed. Spice cabinet and Oda were not started.

Use the deployed production URL as the only planning copy during the trial. Record a short factual entry when something happens more than once. If a category has no observations during a cycle, write `None observed` so absence is explicit.

Do not record general feature ideas here. Correctness or data-loss defects should be raised immediately and treated as release blockers.

The original evidence-gated P1 selection rule is superseded by the product-owner override above.
The incomplete trial remains useful observation history, but it is not a prerequisite and must not
be represented as completed evidence.

## Cycle 1

Week starting: 2026-08-16

### Repeated manual corrections

- _None recorded yet._

### Ingredient matches that failed

- _None recorded yet._

### Stock quantities that were too tedious to maintain

- _None recorded yet._

### Meal suggestions rejected and why

- _None recorded yet._

### Planning intent and inspiration friction

- _For repeated cases, note whether you knew the exact meal, knew only the cuisine, or had no idea._

### Household items repeatedly added manually

- _None recorded yet._

## Cycle 2

Week starting: _YYYY-MM-DD_

### Repeated manual corrections

- _None recorded yet._

### Ingredient matches that failed

- _None recorded yet._

### Stock quantities that were too tedious to maintain

- _None recorded yet._

### Meal suggestions rejected and why

- _None recorded yet._

### Planning intent and inspiration friction

- _For repeated cases, note whether you knew the exact meal, knew only the cuisine, or had no idea._

### Household items repeatedly added manually

- _None recorded yet._

## End-of-trial evidence review

Complete only after both cycles.

| Observation cluster | Count | Household effort caused | Smallest useful response |
| ------------------- | ----: | ----------------------- | ------------------------ |
| _Pending_           |       |                         |                          |

### Decision

- Next feature or fix: _Pending_
- Evidence supporting it: _Pending_
- Guided meal-inspiration direction confirmed? _Yes / no / not enough evidence_
- Items explicitly kept deferred: _Pending_
