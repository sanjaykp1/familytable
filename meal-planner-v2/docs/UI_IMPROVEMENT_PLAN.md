# Family Table UI Improvement Plan

Status: proposed  
Created: 2026-08-10  
Scope: React UI, interaction design, accessibility, and restrained motion  
Implementation state: no work in this plan has been implemented by the author of this document

## Purpose

This document turns the August 2026 source audit into an implementation plan that can be followed across independent model sessions. It is intentionally specific about sequence, ownership, motion values, safeguards, and acceptance criteria so that later sessions do not need to repeat the design audit.

The main outcome is a calmer, more accessible interface with clearer action hierarchy. Motion is secondary: it should confirm actions and explain state changes without slowing down planning, shopping, or navigation.

## Required preflight for every session

1. Read `AGENTS.md` before editing.
2. Run `git status --short` and treat all existing changes as user-owned. Do not revert or overwrite unrelated work.
3. Re-read the files named in the selected task because line numbers and surrounding code may have changed.
4. Implement only one phase or one tightly related task group per session.
5. Use existing tokens from `src/styles/tokens.css`. Do not hardcode colour, spacing, radius, or shadow values in components.
6. Preserve the public provider and component APIs unless the task explicitly calls for a migration.
7. Run the verification appropriate to the task. Before final handoff, run `npm run check` unless a documented environment limitation prevents it.

The repository was already dirty when this plan was written. Several files named below had pre-existing modifications. Future sessions must inspect diffs carefully and preserve concurrent user work.

## Product and design principles

- Core navigation must feel instant. Never animate primary screen changes or keyboard-initiated actions.
- Frequent actions may have only near-imperceptible feedback.
- Occasional surfaces such as dialogs and toasts may use short, purposeful motion.
- Functional data should not move for decoration.
- Prefer CSS transitions over a motion dependency for this plan.
- Animate `transform` and `opacity` where possible. Do not animate layout properties such as `width` when a transform can express the same state.
- Use transitions, not keyframes, for rapidly triggered or interruptible UI.
- Every spatial animation must have a reduced-motion variant. Reduced motion means gentler feedback, not indiscriminately setting every duration to zero.
- Gate hover-only motion behind `@media (hover: hover) and (pointer: fine)`.
- Every interactive target must be at least 44 by 44 CSS pixels.
- Each surface should have one clear primary action. Secondary management actions should not compete with the main task.

## Shared motion vocabulary

Extend the existing duration tokens rather than creating a second timing system.

```css
--motion-fast: 140ms;
--motion-base: 200ms;
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

Use the following recipes unless a task below says otherwise:

| Interaction         | Properties                                 | Duration                | Easing               | Reduced motion                                    |
| ------------------- | ------------------------------------------ | ----------------------- | -------------------- | ------------------------------------------------- |
| Button press        | `transform: scale(0.97)`                   | 140ms                   | `var(--ease-out)`    | Keep colour/background feedback; remove transform |
| Modal panel         | Opacity plus `scale(0.96)` to settled      | 200ms enter, 140ms exit | `var(--ease-out)`    | Opacity only                                      |
| Modal backdrop      | Opacity                                    | 200ms enter, 140ms exit | `var(--ease-out)`    | Opacity only                                      |
| Toast               | Opacity plus `translateY(100%)` to settled | 200ms enter, 140ms exit | `var(--ease-out)`    | Opacity only                                      |
| Progress fill       | Left-origin `scaleX()`                     | 200ms                   | `var(--ease-in-out)` | Instant transform                                 |
| Segmented indicator | Horizontal `transform`                     | 200ms                   | `var(--ease-in-out)` | Instant indicator; colour may fade for 140ms      |

## Model routing

The model labels below are recommendations, not hard dependencies.

- `gpt-5.6-terra`: use for contained, mechanical changes with clear acceptance criteria.
- `gpt-5.6-sol`: use for accessibility semantics, responsive restructuring, shared primitives, and product hierarchy decisions.
- Use medium reasoning for routine CSS or local component work, and high reasoning for cross-cutting or accessibility-sensitive work.

## Prioritized roadmap

| Order | Work item                                                          | Impact      | Effort      | Recommended model | Dependency            |
| ----- | ------------------------------------------------------------------ | ----------- | ----------- | ----------------- | --------------------- |
| 1     | Remove smooth scrolling from primary navigation                    | High        | Very low    | Terra, low        | None                  |
| 2     | Normalize interactive targets to at least 44px                     | High        | Low         | Terra, medium     | None                  |
| 3     | Add touch-safe button press feedback and hover gating              | High        | Low         | Terra, medium     | Shared motion tokens  |
| 4     | Remove the false recipe-card hover affordance                      | Medium      | Very low    | Terra, low        | None                  |
| 5     | Replace the progress `width` transition with `scaleX()`            | Medium      | Low         | Terra, medium     | Shared motion tokens  |
| 6     | Replace the global reduced-motion override with component policies | High        | Medium      | Sol, high         | Shared motion tokens  |
| 7     | Migrate dialogs and confirmations to Base UI                       | Very high   | High        | Sol, high         | Reduced-motion policy |
| 8     | Simplify sticky headers and mobile toolbar offsets                 | High        | Medium      | Sol, high         | None                  |
| 9     | Reorganize Home Stock actions                                      | High        | Medium-high | Sol, high         | Base UI Menu          |
| 10    | Migrate notifications to Sonner                                    | Medium-high | Medium      | Sol, medium       | Reduced-motion policy |
| 11    | Add a moving segmented-control indicator                           | Low-medium  | Medium      | Terra, high       | Shared motion tokens  |

## Phase 1: quick responsiveness and accessibility wins

These changes are independent enough to complete in one session, but the resulting diff should remain narrowly scoped.

### 1.1 Make primary navigation instant

Primary file:

- `src/App.tsx`

Current issue:

- `navigate()` calls `window.scrollTo({ top: 0, behavior: 'smooth' })` for every primary screen change.
- Primary navigation is frequent and should not animate.
- The JavaScript smooth scroll is not controlled by the CSS reduced-motion rule.

Implementation:

- Replace smooth scrolling with an instant scroll to the top.
- Preserve hash navigation and the existing `AppScreen` state behavior.
- Do not add a route or page transition.

Acceptance criteria:

- Switching among Plan, Recipes, Shop, and Settings scrolls to the top instantly.
- Back/forward hash navigation still selects the correct screen.
- No screen crossfade, slide, or stagger is introduced.

### 1.2 Normalize interaction targets

Primary files:

- `src/styles/global.css`
- `src/components/ui/Button.tsx`
- `src/components/ui/SegmentedControl.tsx`
- `src/components/ui/ToastViewport.tsx`

Known undersized targets include:

- `.button--sm` at 2.5rem.
- `.filter-pills button` at 2.5rem.
- `.segmented-control button` at 2.5rem.
- `.toast button` at 2.25rem.
- The servings number input and some compact weather controls require inspection of their effective hit area.

Implementation:

- Make every button, checkbox label, select, and compact actionable control at least 2.75rem in both actionable dimensions.
- Preserve compact visual density with internal alignment and typography rather than shrinking the hit target.
- Ensure icon-only controls retain an accessible label and title/tooltip according to `AGENTS.md`.
- Do not enlarge decorative icons or non-interactive status chips merely to satisfy this rule.

Acceptance criteria:

- No actionable control has an effective target smaller than 44 by 44 CSS pixels.
- Compact controls remain visually aligned in desktop toolbars and mobile cards.
- Keyboard focus rings are fully visible and are not clipped.

### 1.3 Correct button feedback and hover behavior

Primary file:

- `src/styles/global.css`

Current issue:

- Buttons translate upward on hover and return to their default position on active press.
- On touch, the active state therefore provides little physical confirmation.
- Hover transforms are not gated to fine pointers.

Implementation:

- Use `transform: scale(0.97)` for `:active:not(:disabled)`.
- Transition the transform for `var(--motion-fast)` with `var(--ease-out)`.
- Put any retained hover transform inside `@media (hover: hover) and (pointer: fine)`.
- Prefer colour, background, and border hover feedback. A persistent lift is not required.
- Specify transition properties explicitly; never use `transition: all`.

Acceptance criteria:

- Mouse, touch, and pen presses all receive immediate feedback.
- Touch devices do not retain a false hover transform.
- Disabled buttons do not transform.
- Reduced-motion mode removes the scale while retaining non-spatial state feedback.

### 1.4 Remove the recipe-card false affordance

Primary file:

- `src/styles/global.css`

Current issue:

- `.recipe-card:hover` lifts the card and animates its shadow even though the card itself is not clickable.

Implementation:

- Remove the lift and shadow transition.
- Keep hover and press feedback on the actual Edit and Delete controls.
- Do not make the whole card clickable as part of this task; that would require a separate interaction and semantics decision.

Acceptance criteria:

- Hovering whitespace on a recipe card no longer implies that the card opens.
- Edit and Delete remain visibly actionable.
- No animated `box-shadow` remains on recipe cards.

### 1.5 Make the plan progress animation composited

Primary files:

- `src/features/plan/PlanPage.tsx`
- `src/styles/global.css`

Current issue:

- The progress fill uses an inline percentage width and transitions `width`.

Implementation:

- Keep the fill at full width and express progress with a left-origin `scaleX()`.
- Supply the progress value without setting an inheritable CSS variable on a large parent subtree.
- Transition `transform` for `var(--motion-base)` with `var(--ease-in-out)`.
- In reduced-motion mode, keep the state update but remove the spatial transition.

Acceptance criteria:

- The visual percentage matches `decidedCount / 7` for every value from zero through seven.
- Updating the week plan does not animate layout width.
- The fill begins at the left in both light and dark themes.

## Phase 2: shared motion and reduced-motion foundation

Recommended model: `gpt-5.6-sol`, high reasoning.

Primary files:

- `src/styles/tokens.css`
- `src/styles/global.css`

Current issue:

- Durations exist, but strong shared easing tokens do not.
- The current `prefers-reduced-motion` block applies `0.01ms !important` to every element and pseudo-element.
- The global override erases useful opacity and colour feedback and makes component behavior difficult to reason about.

Implementation:

1. Add the shared easing tokens specified earlier in this document.
2. Remove the universal transition and animation duration override.
3. Retain `scroll-behavior: auto` under reduced motion.
4. Add targeted reduced-motion rules alongside or grouped by the components that move spatially.
5. Keep short opacity, background, border, and colour transitions where they improve state comprehension.
6. Remove transform-based modal, toast, button, progress, and segmented-control motion under reduced motion.

Acceptance criteria:

- Reduced-motion mode contains no spatial entrance, exit, press-scale, or sliding-indicator motion.
- State changes remain legible through instant geometry and short non-spatial feedback.
- No universal `transition-duration: 0.01ms !important` remains.
- Existing scrolling is instant under reduced motion.

## Phase 3: accessible dialog and confirmation primitives

Recommended model: `gpt-5.6-sol`, high reasoning.

Primary files:

- `package.json`
- `package-lock.json`
- `src/components/ui/Modal.tsx`
- `src/features/recipes/RecipesPage.tsx`
- `src/features/plan/PlanPage.tsx`
- `src/features/settings/SettingsPage.tsx`
- `src/features/shopping/ShoppingPage.tsx`
- `src/styles/global.css`

Library decision:

- Install `@base-ui/react`.
- Use Base UI Dialog for forms and informational modal surfaces.
- Use Base UI Alert Dialog for destructive confirmations such as recipe deletion, data reset, and Home Stock archiving.
- Official reference: <https://base-ui.com/react/components/dialog>

Migration approach:

- Prefer keeping a local UI wrapper so feature pages do not depend directly on Base UI styling details.
- Preserve the current controlled API shape where practical: `title`, `description`, `children`, `onClose`, and `wide`.
- Use Base UI Title and Description rather than a shared hardcoded `id="modal-title"`.
- Let the primitive manage focus trapping, background inertness, Escape handling, scroll locking, portal placement, and focus restoration.
- Confirm that form autofocus does not unexpectedly open the mobile keyboard when a dialog was opened by touch.
- Destructive Alert Dialogs should initially focus the safe action unless the primitive's accessible default provides equivalent behavior.
- Closing on an outside press is acceptable for non-destructive forms only if no unsaved-data loss policy is violated.

Motion specification:

- Centered panel: opacity plus `scale(0.96)` to settled over 200ms using `var(--ease-out)`.
- Backdrop: opacity over the same 200ms.
- Exit both over 140ms through Base UI ending-state attributes.
- Keep the modal centered; do not use trigger-based transform origin.
- Reduced motion: opacity only.

Acceptance criteria:

- Opening a dialog moves focus inside it.
- Tab and Shift+Tab cannot escape an open modal.
- Escape closes when allowed.
- Closing returns focus to the invoking control.
- Background controls cannot be activated while a modal is open.
- Screen readers receive a unique title and optional description.
- Destructive confirmations clearly distinguish Cancel from the destructive action.
- Existing recipe, stock, manual-item, reset, archive, and stock-only flows still complete successfully.

Suggested verification:

- Add focused component tests for opening, focus containment, Escape, cancellation, confirmation, and focus restoration.
- Manually verify keyboard-only operation on every dialog type.
- Inspect the animation at 2x to 5x duration before restoring production timings.

## Phase 4: simplify persistent page chrome

Recommended model: `gpt-5.6-sol`, high reasoning.

Primary files:

- `src/components/ui/PageHeader.tsx`
- `src/features/plan/PlanPage.tsx`
- `src/features/recipes/RecipesPage.tsx`
- `src/features/shopping/ShoppingPage.tsx`
- `src/styles/global.css`

Current issue:

- The top bar, editorial page header, and feature toolbar can all be sticky.
- Mobile styles depend on fixed offsets such as `top: 14rem`, which are brittle when titles, actions, text wrapping, or viewport dimensions change.
- Large editorial copy occupies valuable space during the task itself.

Target structure:

- Show the large title and description as normal document content.
- Keep at most one compact task toolbar sticky beneath the top bar.
- Plan: sticky week switcher plus the most important week state; do not keep the full hero copy sticky.
- Recipes: sticky search and filters; keep the page title in normal flow.
- Shop: keep the To buy / At home switch and contextually important action accessible without stacking multiple sticky blocks.
- On small screens, prioritize the current task and one primary action over summary metrics.

Implementation constraints:

- Do not add an animated collapsing header. Scrolling and core task navigation should remain direct.
- Avoid hardcoded offsets derived from assumed content heights.
- Respect safe areas and the fixed bottom navigation.
- Verify long household names, long recipe filter labels, and narrow 320px layouts.

Acceptance criteria:

- No page has more than one feature-level sticky region below the app top bar.
- Sticky content never overlaps page content, dialogs, or bottom navigation.
- Mobile users retain access to primary actions without losing a large fraction of the viewport.
- Plan, Recipes, and Shop retain a clear page identity when scrolled to the top.

## Phase 5: clarify Home Stock action hierarchy

Recommended model: `gpt-5.6-sol`, high reasoning.

Primary files:

- `src/features/shopping/ShoppingPage.tsx`
- `src/styles/global.css`
- A local Base UI Menu wrapper under `src/components/ui` if one does not already exist

Current issue:

- Each active stock card can show quantity controls, Mark used up, Edit, Use soon, Use in next plan, and Archive at similar visual weight.
- The density obscures the primary household task and becomes especially crowded on mobile.

Target hierarchy:

1. Quantity state and quantity adjustment remain the dominant controls.
2. When quantity is zero, `Add to shop` remains the primary action.
3. `Use soon` and `Use in next plan` remain visible planning-intent toggles with clear selected states and `aria-pressed`.
4. Edit and Archive move into a Base UI overflow Menu.
5. Archive remains behind an Alert Dialog confirmation.
6. A card should not present more than one visually primary button at a time.

Implementation notes:

- Use a labelled icon-only menu trigger with a tooltip/title.
- Do not hide quantity adjustment or planning intent in the overflow menu.
- Preserve the distinction between zero quantity and archive; zero items must remain active until explicitly archived.
- Keep `Use soon` and `Use in next plan` visually distinct because they affect different planning behavior.
- Avoid new card entrance, stagger, or reordering animation.

Acceptance criteria:

- Users can adjust quantity, mark an item used up, set or clear planning intent, edit, and archive using keyboard and touch.
- Selected planning-intent controls expose their state programmatically.
- The card footer does not wrap into an unreadable cluster at 320px.
- Edit and Archive are still discoverable from each card.
- Existing Home Stock business rules and tests remain unchanged.

## Phase 6: replace the custom toast renderer with Sonner

Recommended model: `gpt-5.6-sol`, medium reasoning.

Primary files:

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/app/AppProvider.tsx`
- `src/components/ui/ToastViewport.tsx`
- `src/styles/global.css`

Library decision:

- Install `sonner`.
- Official reference: <https://sonner.emilkowal.ski/getting-started>
- Background on hidden-tab timer behavior: <https://emilkowal.ski/ui/building-a-toast-component>

Migration approach:

- Preserve `notify(message, tone)` as the application-facing API so feature code does not churn.
- Delegate that API to `toast`, `toast.success`, `toast.error`, or `toast.info`.
- Replace the custom `ToastViewport` with a locally styled Sonner `Toaster` wrapper, or repurpose the existing component name to minimize app-level change.
- Match light, dark, and system themes using existing colour and typography tokens.
- Position above the mobile bottom navigation and preserve the current bottom-right desktop location unless usability testing indicates otherwise.
- Confirm whether the custom `toasts` and `dismissToast` provider state can be removed without breaking tests or consumers.

Motion specification:

- Use interruptible enter/exit transitions, not custom keyframes.
- The intended product feel is calm but crisp: target 200ms enter and 140ms exit if Sonner's styling hooks permit this without fighting the library.
- Enter from and exit through the same bottom edge.
- Reduced motion uses opacity only.
- Do not install a second animation library to customize toasts.

Acceptance criteria:

- Existing success, info, and error notifications render with correct tone.
- Toast timers pause while the page is hidden and resume when visible.
- Multiple toasts stack without overlap and can be dismissed.
- The toast region does not cover the mobile bottom navigation.
- The close target is at least 44 by 44 CSS pixels.
- Notifications remain readable in light and dark themes.

## Phase 7: optional segmented-control polish

Recommended model: `gpt-5.6-terra`, high reasoning.

Primary files:

- `src/components/ui/SegmentedControl.tsx`
- `src/styles/global.css`

This phase is optional and should be attempted only after all higher-priority work is stable.

Implementation:

- Add one background indicator beneath the option labels.
- Move it with a horizontal transform over 200ms using `var(--ease-in-out)`.
- Keep labels stationary and continuously interactive.
- Preserve `aria-pressed` or replace the group with an equally appropriate radio semantic; do not mix conflicting semantics.
- Reduced motion moves the indicator instantly while allowing a short colour transition.

Acceptance criteria:

- The indicator position is correct for every option count supported by the generic component.
- Rapid clicks retarget smoothly rather than restarting a keyframe.
- Keyboard and touch interactions remain immediate.
- Layout does not shift when the selected option changes.

## Motion explicitly rejected

Do not add any of the following during this plan:

- Page transitions or smooth scrolling for primary navigation.
- Staggered recipe, shopping-list, or Home Stock card entrances.
- Animated filtering or reordering of recipe and inventory data.
- Decorative hover lift on non-clickable cards.
- Whole-page theme crossfades.
- Animated weather data or explanatory chart effects.
- A general-purpose Motion/Framer Motion dependency.
- Bounce on standard controls, dialogs, menus, or toasts.

These candidates were rejected because they are frequent, affect information users are actively reading, imply false affordances, or add complexity without improving comprehension.

## Verification matrix

Every implementation session should run the checks relevant to its scope. The session completing the full plan should cover the entire matrix.

| Area           | Required checks                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Keyboard       | Logical tab order, visible focus, modal trapping, Escape behavior, trigger focus restoration, overflow Menu operation |
| Touch          | 44px targets, no sticky hover, no crowded card actions, mobile dialog scrolling, bottom navigation clearance          |
| Reduced motion | No spatial modal/toast/button/indicator movement; instant core navigation; state remains understandable               |
| Responsive     | 320px, 375px, 768px, and desktop widths; portrait and landscape where practical                                       |
| Themes         | Light, dark, and system; no unreadable toast or dialog states                                                         |
| Performance    | No width transition for plan progress; no animated recipe-card shadow; no unnecessary JS animation library            |
| Behavior       | All recipe, plan, shopping, Home Stock, settings, import/export, and notification flows remain functional             |
| Automated      | Relevant focused tests during development, followed by `npm run check` before final handoff                           |

## Suggested commit boundaries

If the user requests commits, keep them reviewable and avoid mixing unrelated phases:

1. `fix: make core interactions immediate and touch safe`
2. `fix: add targeted reduced motion behavior`
3. `refactor: migrate modal flows to Base UI`
4. `refactor: simplify responsive page chrome`
5. `refactor: clarify Home Stock actions`
6. `refactor: migrate notifications to Sonner`
7. `polish: add segmented control state motion`

Do not create commits unless the user explicitly requests them.

## Handoff format for each session

At the end of a session, record:

- Tasks completed from this plan.
- Files changed.
- User-visible behavior changed.
- Tests and checks run, with results.
- Manual verification completed and any unverified areas.
- Known follow-ups or deviations from the plan.
- The next recommended task and its model tier.

## Definition of done

This plan is complete when:

- Primary navigation is instant.
- All actionable targets meet the 44px requirement.
- Hover motion is pointer-gated and touch presses receive clear feedback.
- Reduced motion is component-specific and retains useful non-spatial feedback.
- Dialogs and destructive confirmations have complete focus and dismissal behavior.
- Mobile pages no longer stack large persistent headers and brittle fixed offsets.
- Home Stock cards have a clear task hierarchy.
- Toasts handle stacking, dismissal, themes, and inactive tabs robustly.
- Progress animation uses a transform rather than width.
- Only the approved, purposeful motion remains.
- `npm run check` passes, and the keyboard, touch, responsive, theme, and reduced-motion matrix has been verified.
