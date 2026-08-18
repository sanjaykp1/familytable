# Guided meal inspiration — UX and delivery plan

Updated: 18 August 2026

Implementation is coordinated through
[MULTI_AGENT_COORDINATION_PLAN.md](./MULTI_AGENT_COORDINATION_PLAN.md). One integration coordinator
owns contracts and merges; bounded agents may work in parallel only after the relevant contract is
merged and file ownership is exclusive.

**Recommended coordinator:** `gpt-5.6-sol` with high reasoning. Guided contract and domain work use
Sol/high, bounded recipe and picker UI work uses `gpt-5.6-terra`/high, and independent final QA uses
Sol/xhigh.

## Delivery status — 18 August 2026

The product owner selected Guided meal inspiration as the first P1 workstream and kept Spice
cabinet serialized behind it. Gate A and all three delivery slices are complete locally:

- schema 9 defines controlled recipe cuisines and unresolved day intentions;
- bundled IDs have an explicit cuisine map and legacy household recipes migrate to
  `Uncategorised`;
- new recipes require an explicit cuisine, while the library supports accessible cuisine chips
  and grouped browsing;
- day rows use the guided picker for exact meals, persisted cuisine intentions, inspiration and
  special dinner plans;
- deterministic ranking returns stable reason codes, cycles deliberately, preserves every chosen
  meal and leaves unsatisfied intentions visibly unresolved;
- the mixed-certainty acceptance flow passes at 320 px in Chromium, Firefox and WebKit, including
  keyboard opening, Escape and focus return.

Independent fresh-session integrated QA passed. The reviewed change commit
`56e2059e5995bb0076e6dde31b1bd65daf1f4995` was merged through PR #1 after CI passed, producing
production commit `4b65c8a880863ff8b5fb40868123da2987d03a84`. Cloudflare deployment
`e7280bfc-0d16-45c5-a1b8-c27e5773946e` completed successfully at
https://e7280bfc.family-table-1gb.pages.dev.

The immutable and stable URLs both passed normal load with no captured console errors, service
worker installation/control, a real network-disabled reload with persisted interactive data,
JSON export/reset/import recovery, and the Guided mixed-certainty flow at 320 px with keyboard,
Escape/focus return and 44 px controls. Monday and Wednesday remained unchanged; Tuesday received
an Indian recipe, reopened with Indian alternatives and visible reasons; the unresolved intention
created no shopping list.

Guided P1 is still release-blocked because a deliberately missing JavaScript asset returns HTTP
200 with `text/html` on both production URLs. This violates the offline prerequisite's
missing-asset criterion. The confirmed rollback target has the same response behavior, so no
rollback was performed. Do not start Spice cabinet or the Oda gate as a concurrent writable schema
branch while this release remains blocked.

Gate 0 is complete by explicit product-owner override. The remaining two-cycle dogfood and
deployed manual-recovery evidence requirements are waived, not passed. A separate confirmed P0
offline-reload defect was fixed on `main`; its production-build acceptance scenario passes in
Chromium, Firefox and WebKit. Live offline verification now passes against both production URLs,
but production missing-asset routing remains a separate release blocker.

Gate A froze these additional invariants:

- `Uncategorised` is a migration/library value, never a day-level cuisine intention or a shortcut
  when creating a recipe;
- an intention is valid only on an unlocked, unresolved recipe slot;
- current-schema imports reject unknown intentions and normalize intentions away from chosen or
  special meals;
- exact meal choices, special plans and automatic allocation clear stale intention state;
- constrained ordinary generation satisfies an intention or leaves it unresolved; stock-only
  generation leaves it untouched rather than silently substituting another cuisine.

## Product outcome

Weekly planning should support the different levels of certainty a person actually has:

1. **I know the meal:** choose a specific saved recipe.
2. **I know the feeling:** choose a cuisine, then browse a short list.
3. **I have no idea:** ask for inspiration and receive explainable suggestions.
4. **I have decided some days:** keep those days and fill only the remaining ones.

The feature works entirely from saved recipes. It does not invent recipes, require an LLM or
silently ignore a preference that cannot be satisfied.

## Core interaction

Selecting an empty day opens a meal picker instead of a long alphabetical select.

### Meal picker states

The picker starts with three clear paths:

- **Choose a meal** — search or browse saved recipes, grouped by cuisine.
- **I feel like...** — select a cuisine such as Indian or Italian and see matching ideas.
- **Inspire me** — see a small, varied set based on day, season, recent meals, favourites and
  cooking effort.

The existing `Leftovers`, `Eat out / takeaway` and `Skip dinner` choices remain available as
secondary plans.

Each suggestion card shows the information needed to decide without opening another screen:

- recipe name and short description;
- cuisine;
- total time and cooking attention;
- useful reasons such as `Favourite`, `Good for a weeknight`, `In season`, `Use soon` or
  `Not cooked recently`;
- one primary action: `Choose for Tuesday`.

### Day-level intention

A person may choose `Indian` without choosing a recipe yet. The day then displays
`Indian · meal not chosen` as a visible intention. It is not treated as a completed day.

From that state the person can:

- choose one of the matching recipes;
- ask for another matching suggestion;
- change or clear the cuisine;
- leave the intention in place and use `Plan my week` to fill it later.

`Plan my week` preserves selected or locked meals, respects cuisine intentions on undecided days,
and fills other open days from the wider library. If a cuisine has no eligible saved recipe, the
day remains open with a plain explanation and an action to browse or add a recipe.

## Cuisine structure

Primary cuisine is a first-class recipe field, separate from free-form tags. One primary value is
enough for the MVP and gives every recipe one predictable browse location. For fusion meals, the
person chooses where they would expect to find it and may use tags for secondary influences. Tags
continue to describe things such as `quick`, `kid-friendly`, `one-pot` and `vegetarian`.

The initial controlled list should be useful without becoming encyclopaedic:

- Indian
- Chinese
- Japanese
- Korean
- Thai
- Vietnamese
- Italian
- Mexican
- Latin American
- Mediterranean
- Middle Eastern
- Nordic
- British & Irish
- American
- Other
- Uncategorised

The interface may visually group Chinese, Japanese, Korean, Thai and Vietnamese under an
`East & Southeast Asian` heading while keeping their primary values distinct. It should not use
`Asian` as a data value because that overlaps with Indian and is too broad to produce useful
suggestions. Empty cuisine groups are not rendered.

Existing household recipes migrate to `Uncategorised`; the app must not guess cultural identity
from a recipe name. Bundled catalogue recipes receive an explicit cuisine as part of the schema
migration. Uncategorised recipes remain fully usable and appear in browse and inspiration results.

## Components

### 1. `MealPicker`

A responsive modal on desktop and sheet-like full-width surface on mobile. It owns search,
cuisine selection, suggestion display and secondary dinner choices, but not persistence.

### 2. `CuisineChips`

A reusable single-select chip group with `All` or `Any cuisine` where appropriate. It uses the
controlled cuisine labels and exposes an accessible pressed state.

### 3. `MealSuggestionCard`

A compact decision card shared by cuisine browse and inspiration. It shows at most three reasons
and never claims a reason the domain result did not provide.

### 4. `DayMealIntent`

The empty-day state showing a saved cuisine intention, including change and clear actions. It is
visually different from a chosen recipe and does not increment the `Decided` count.

### 5. `RecipeCuisineField`

A required controlled select in the recipe editor. `Uncategorised` is a valid migration value,
but newly created recipes should ask the person to make an explicit choice.

### 6. `CuisineRecipeGroup`

Used in the recipe library and the meal picker. Groups are ordered by the household's available
recipes, not by a large fixed list of empty headings. Search results stay flat when that is easier
to scan.

## Domain behavior

Add `cuisine` to `Recipe` and an optional `cuisine` intention to each recipe meal slot. The
intention belongs to the weekly plan because it is a choice for a particular day, not a permanent
recipe preference. A non-recipe slot cannot carry cuisine intent; choosing Leftovers, Eat out or
Skip clears it during the same mutation and repository normalization enforces that invariant.

Suggestion ranking remains deterministic and explainable. It should consider:

1. an explicit cuisine intention as a required filter;
2. recipes already used elsewhere in the week as exclusions for automatic suggestions;
3. recipes cooked in the last seven days as exclusions while alternatives exist;
4. season, favourite, weeknight/weekend suitability and `Use soon` as positive ranking signals;
5. a stable week-and-day tie-break so the same plan does not reshuffle on reload.

`Show me another` cycles through the ranked candidates instead of choosing randomly. If the only
cuisine match is already planned elsewhere, automatic generation leaves the day unresolved and
offers that duplicate as an explicit user choice.

`Plan my week` fills empty recipe slots; it does not replace a recipe the person has already chosen.
This is an intentional change from the current unlocked-slot regeneration behavior and needs a
regression test. `Try another meal` remains the explicit way to replace one chosen recipe. Locked
recipes retain their existing protection.

Choosing a recipe clears the unresolved intention from that slot. Clearing a recipe may retain the
cuisine intention only when the person explicitly chooses `Keep Indian preference`; ordinary
reset clears both.

The related low-maintenance staple behavior is specified separately in
[SPICE_CABINET_PLAN.md](./SPICE_CABINET_PLAN.md) because it changes Home Stock and shopping rules,
not cuisine selection.

## Delivery slices

### Slice 1 — cuisine-aware recipe library

- Add the schema migration and controlled cuisine type.
- Assign cuisines to bundled recipes and preserve household recipes as `Uncategorised`.
- Add cuisine to the recipe form.
- Add cuisine chips and grouped browsing to Recipes.
- Add migration, form and filtering tests.

This slice is independently useful and prepares clean data for planning.

### Slice 2 — day meal picker and cuisine intention

- Replace the day-row recipe select with a button that opens `MealPicker`.
- Support exact meal choice, cuisine browse and secondary dinner choices.
- Persist an unresolved cuisine intention on a day.
- Preserve current serving, lock, cooked and shopping-list behavior.
- Add mobile keyboard, focus-return and screen-reader coverage.

### Slice 3 — inspiration and constrained week generation

- Add the pure suggestion/ranking service with reason codes.
- Add `Inspire me` suggestions and `Show me another` for one day.
- Make `Plan my week` satisfy day-level cuisine intentions before filling unconstrained days.
- Leave unsatisfied intentions visible with a useful empty state.
- Add tests for mixed-certainty weeks, duplicates, recent meals, locked meals and no-match results.

### Migration and validation tests across all slices

- Existing household recipes become Uncategorised; only known bundled recipe IDs receive mapped
  cuisines.
- A new recipe cannot be saved until the user chooses a cuisine or explicitly chooses Other.
- Uncategorised recipes appear in general browse and inspiration, but never satisfy a specific
  cuisine intention.
- Imported backups reject invalid cuisine values and normalize impossible special-slot intents.
- Selecting or clearing only a cuisine intent does not add recipe ingredients to shopping.
- Selecting, replacing or clearing a recipe invalidates generated recipe shopping items while
  retaining manual and accepted stock-top-up items under the existing rules.

### Stress cases

- With no recipes, the picker leads to Add recipe and never presents a dead Inspire me action.
- With only one matching recipe across two same-cuisine intentions, automatic generation fills one
  day and leaves the other unresolved; the duplicate remains available as a manual override.
- A manually chosen, unlocked Monday meal survives Plan my week while empty days are filled.
- A special dinner choice clears stale cuisine intent and never contributes ingredients.
- Suggestions keep the same order after reload and week navigation; Show me another advances the
  list deliberately.
- A recently cooked recipe remains available when it is the only cuisine match, with that reason
  visible rather than the day silently changing cuisine.
- Deleting a recipe already used in a draft leaves a recoverable empty day and never leaves orphaned
  shopping ingredients.
- Long translated recipe names, large text, keyboard-only use and a 320 px viewport do not hide the
  choose, change or clear actions.

## Acceptance scenario

1. Monday is set directly to a known recipe and locked.
2. Tuesday is marked `Indian`, but no recipe is selected yet.
3. Wednesday is set to leftovers.
4. The remaining days are left open.
5. `Plan my week` keeps Monday and Wednesday, selects an Indian saved recipe for Tuesday and fills
   only the other open days.
6. Reopening Tuesday shows other Indian choices with reasons.
7. If all Indian recipes are already used or unavailable, Tuesday stays visibly unresolved rather
   than receiving a different cuisine; an already-used Indian recipe may be offered as a manual
   override.
8. Preparing the shopping list continues to use only chosen recipes, never an unresolved cuisine
   intention.

## Explicitly outside this release

- generating a new recipe from a cuisine prompt;
- web recipe search or import;
- nutritional or dietary inference from cuisine;
- household taste profiles or per-person recommendations;
- remote analytics, accounts or synchronization;
- images that become necessary to identify a meal.
