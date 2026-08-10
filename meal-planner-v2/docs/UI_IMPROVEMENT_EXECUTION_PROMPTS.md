# UI Improvement Multi-Agent Execution Prompts

Use these prompts in order to implement `docs/UI_IMPROVEMENT_PLAN.md`. Each prompt is designed for a fresh Codex session and can be pasted as-is.

## How to use this pack

1. Run one prompt at a time, in numerical order.
2. Do not start the next prompt until the previous session has reported its changes and verification results.
3. Start each session with the recommended model and reasoning level shown above the prompt.
4. The repository may contain user-owned, uncommitted work. Every session must preserve it.
5. All subagents share the same working directory. To prevent collisions, subagents are read-only unless a prompt explicitly assigns them a non-overlapping file.
6. The root agent owns integration and all edits to shared hotspots: `src/styles/global.css`, `src/styles/tokens.css`, `package.json`, `package-lock.json`, and `src/features/shopping/ShoppingPage.tsx`.
7. If a subagent identifies a problem outside the current phase, record it for the handoff instead of expanding scope.
8. Do not create commits, branches, or pull requests unless separately requested.

The prompts assume the project is located at:

`/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2`

---

## Prompt 1: interaction foundations and quick wins

Recommended model: `gpt-5.6-terra`  
Recommended reasoning: medium

```text
Implement Phase 1 of the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading before any edits:

- AGENTS.md
- docs/UI_IMPROVEMENT_PLAN.md, especially the preflight, shared motion vocabulary, and Phase 1

This is a multi-agent task. Use up to two subagents in parallel, but keep them read-only because several tasks converge on global.css.

Spawn these bounded subtasks:

1. `target_audit`: Read-only. Inventory every actionable control below 44×44px and every ungated hover transform. Return exact file/selector evidence, likely regressions, and a concise acceptance checklist. Do not edit files.
2. `behavior_audit`: Read-only. Inspect primary navigation, recipe-card hover behavior, and plan progress rendering. Identify existing tests that cover these areas and recommend the smallest additional test coverage. Do not edit files.

While they work, inspect the current worktree and relevant files yourself. Treat all existing changes as user-owned. Do not revert unrelated changes.

The root agent must perform all implementation. Complete these items:

- Add the approved `--ease-out` and `--ease-in-out` tokens to tokens.css, extending the existing motion vocabulary.
- Make primary screen navigation scroll to the top instantly; do not add page transitions.
- Normalize effective interactive targets to at least 44×44px, including small buttons, filter pills, segmented-control options, toast dismissal, and any compact controls confirmed by the audit.
- Replace the current button active behavior with `scale(0.97)` over 140ms using `var(--ease-out)`.
- Gate hover-only transforms with `@media (hover: hover) and (pointer: fine)`.
- Remove the recipe-card lift and animated shadow because the card itself is not interactive.
- Replace the plan progress width transition with a left-origin `scaleX()` transform over 200ms using `var(--ease-in-out)`.
- Do not add Base UI, Sonner, Motion, or any other dependency in this phase.
- Do not modify the universal reduced-motion block yet beyond what is strictly necessary for these changes; Phase 2 owns the full policy migration.

After receiving the subagent reports, reconcile their findings before finishing. Add or update focused tests only where they protect changed behavior without creating brittle snapshots.

Verification:

- Run the most focused relevant tests first.
- Run `npm run lint` and `npm run build`.
- If feasible, run `npm run check`; otherwise explain exactly what was not run and why.
- Inspect the final diff for accidental changes to user-owned work.

Handoff requirements:

- Lead with the completed outcome.
- List files changed.
- Report tests and checks with results.
- Report any pre-existing changes you preserved.
- Identify any undersized or hover-sensitive control intentionally deferred.
- Recommend Prompt 2 as the next session if acceptance criteria pass.
```

---

## Prompt 2: reduced-motion policy

Recommended model: `gpt-5.6-sol`  
Recommended reasoning: high

```text
Implement Phase 2 of the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading:

- AGENTS.md
- docs/UI_IMPROVEMENT_PLAN.md, especially the product principles, shared motion vocabulary, Phase 2, and rejected motion list
- The final handoff from Prompt 1, if available

This is an accessibility-sensitive, multi-agent task. Spawn up to two read-only subagents:

1. `motion_inventory`: Inventory every CSS transition, animation, transform-driven state change, JavaScript scroll behavior, and motion token currently present. Classify each as spatial, non-spatial, frequent, occasional, or already safe. Do not edit files.
2. `reduced_motion_review`: Design a component-level reduced-motion policy for the current code after Prompt 1. Check buttons, progress, modal placeholders, toasts, navigation, theme controls, filters, and any conditional panels. Return concrete selectors and expected behavior. Do not edit files.

The root agent owns all edits to tokens.css and global.css. Preserve user-owned changes and do not broaden the scope.

Implementation goals:

- Remove the universal `transition-duration: 0.01ms !important` and `animation-duration: 0.01ms !important` override.
- Keep `scroll-behavior: auto` under `prefers-reduced-motion: reduce`.
- Add targeted reduced-motion rules for every existing spatial motion.
- Remove press-scale and progress movement under reduced motion while preserving immediate state changes.
- Retain short opacity, colour, background, and border feedback when it materially helps comprehension.
- Confirm primary navigation remains instant in all modes.
- Do not add modal, toast, segmented-control, or decorative motion in this phase. Their later phases own those implementations.
- Do not add a motion library.

Use the full gate from the plan: frequency, purpose, speed, and function. Reject motion when it does not help.

Verification:

- Search the final codebase for `0.01ms`, `transition: all`, ungated hover transforms, `ease-in`, and layout-property animations.
- Run focused tests, `npm run lint`, and `npm run build`.
- Run `npm run check` if feasible.
- Manually reason through normal and reduced-motion states for every remaining transition, and clearly mark anything that still requires browser verification.

Handoff requirements:

- Summarize the normal-motion and reduced-motion policies now in effect.
- List files changed and checks run.
- Include any selectors that still lack an intentional reduced-motion policy.
- Recommend Prompt 3 only if the foundation is stable.
```

---

## Prompt 3: Base UI dialogs and alert dialogs

Recommended model: `gpt-5.6-sol`  
Recommended reasoning: high

```text
Implement Phase 3 of the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading:

- AGENTS.md
- docs/UI_IMPROVEMENT_PLAN.md, especially Phase 3 and the shared motion vocabulary
- Existing Modal.tsx, every Modal call site, package.json, and relevant tests
- The handoffs from Prompts 1 and 2, if available

This is a multi-agent task, but dependency and shared-style edits must remain with the root agent. Spawn up to two read-only subagents:

1. `dialog_mapper`: Inventory every current Modal call site. Classify it as form dialog, informational dialog, or destructive confirmation. Record trigger, expected initial focus, safe close behavior, and required focus restoration. Do not edit files.
2. `dialog_test_designer`: Inspect the test stack and existing feature tests. Propose focused tests for focus entry, focus trapping, Escape, outside press, cancel, confirm, and trigger focus restoration. Identify the least brittle testing strategy. Do not edit files.

The root agent performs dependency installation and all implementation. If network access is blocked, request the required approval rather than inventing a local substitute.

Implementation goals:

- Install `@base-ui/react` and update the lockfile.
- Replace the hand-rolled modal internals with a locally styled Base UI Dialog wrapper while preserving the current feature-facing API where practical.
- Use Base UI Alert Dialog for destructive recipe deletion, data reset, and Home Stock archive confirmation.
- Use Base UI title and description primitives; remove the shared hardcoded modal title ID.
- Let the primitive manage portals, focus movement, focus trapping, inert background behavior, Escape handling, page scroll locking, and focus restoration.
- Ensure touch-opened form dialogs do not unexpectedly summon the keyboard unless the user clearly asked to enter text.
- Keep safe cancellation obvious and ensure destructive confirmations do not initially focus the destructive action unless there is a documented accessibility reason.
- Add modal panel motion: opacity plus `scale(0.96)` over 200ms `var(--ease-out)`.
- Add matching backdrop opacity over 200ms.
- Exit both over 140ms using Base UI ending-state attributes.
- Reduced motion must use opacity only.
- Keep dialogs centered; do not use trigger-based transform origins.
- Do not restructure page headers, Home Stock cards, or toasts in this phase.

After implementation, use the subagent findings to add focused tests. If useful, send one follow-up review task to an existing subagent after the edits are complete, asking for a read-only accessibility review of the final diff.

Verification:

- Run dialog/component tests and affected Plan, Recipes, Settings, and Shopping tests.
- Run `npm run check`.
- Verify from code and tests: opening focus, Tab containment, Shift+Tab containment, Escape, outside press policy, safe cancellation, confirmation, focus restoration, unique labeling, and body scroll behavior.
- Identify any interaction that still requires real-browser verification.

Handoff requirements:

- Enumerate migrated Dialog and Alert Dialog flows.
- Report the dependency version installed.
- Report automated and manual verification.
- Record any deliberate deviation from the wrapper API or focus policy.
- Recommend Prompt 4 when complete.
```

---

## Prompt 4: responsive page chrome and sticky regions

Recommended model: `gpt-5.6-sol`  
Recommended reasoning: high

```text
Implement Phase 4 of the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading:

- AGENTS.md
- docs/UI_IMPROVEMENT_PLAN.md, especially Phase 4
- PageHeader.tsx, AppShell.tsx, PlanPage.tsx, RecipesPage.tsx, ShoppingPage.tsx, and all related layout CSS
- Previous prompt handoffs, if available

This is a responsive product-design task. Spawn up to two read-only subagents:

1. `responsive_layout_audit`: Map every sticky region, top offset, z-index, breakpoint, and mobile bottom-navigation clearance. Analyze likely behavior at 320px, 375px, 768px, and desktop widths. Return conflicts and a recommended target structure. Do not edit files.
2. `task_hierarchy_review`: Review Plan, Recipes, and Shop page headers from a task-priority perspective. Recommend which title, context, filters, week controls, segmented controls, metrics, and primary actions should remain visible while scrolling. Do not edit files.

The root agent owns all implementation, especially global.css and the shared PageHeader API.

Implementation goals:

- Move large editorial page headers into normal document flow.
- Retain no more than one feature-level sticky region beneath the app top bar.
- Plan: prioritize the week switcher and essential week state; do not keep the full hero copy sticky.
- Recipes: prioritize search and filters in the sticky task region.
- Shop: prioritize the To buy / At home switch and the current contextually primary action without stacking multiple sticky blocks.
- Remove brittle offsets derived from assumed content heights, including the mobile `top: 14rem` pattern.
- Preserve bottom-navigation clearance and account for safe areas where appropriate.
- Keep Settings simple; do not make it sticky merely for consistency.
- Do not add an animated collapsing header, scroll reveal, or page transition.
- Do not change Home Stock card action hierarchy yet; Prompt 5 owns that work.

Verification:

- Run affected feature tests, lint, and build.
- Inspect CSS for overlapping sticky z-index layers and hardcoded content-height offsets.
- If browser tooling is available, manually inspect 320px, 375px, 768px, and desktop widths in light and dark themes. If not, state that visual verification remains outstanding.
- Verify dialogs and toasts still layer above sticky content.

Handoff requirements:

- Describe the final sticky structure for each page.
- List removed offsets and any new layout tokens.
- Report viewport checks and unresolved visual risks.
- Recommend Prompt 5 when complete.
```

---

## Prompt 5: Home Stock action hierarchy and overflow menu

Recommended model: `gpt-5.6-sol`  
Recommended reasoning: high

```text
Implement Phase 5 of the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading:

- AGENTS.md, especially Home Stock business rules and UI rules
- docs/UI_IMPROVEMENT_PLAN.md, especially Phase 5
- ShoppingPage.tsx, shopping tests, stock planning domain code, current Base UI wrappers, and related CSS
- Previous prompt handoffs, if available

This is a multi-agent product and accessibility task. ShoppingPage.tsx and global.css must have only one writer: the root agent. Spawn up to two read-only subagents:

1. `stock_action_hierarchy`: Analyze every Home Stock card state: positive quantity, zero quantity, frozen, use soon, selected for next plan, replenishment rule, archived, and mobile wrapping. Propose one clear action hierarchy that preserves all business rules. Do not edit files.
2. `menu_accessibility_review`: Inspect Base UI Menu guidance and the project's interaction conventions. Specify trigger labeling, keyboard navigation, focus return, destructive-item treatment, and test cases for the Edit/Archive overflow menu. Do not edit files.

The root agent owns implementation.

Target hierarchy:

- Quantity display and adjustment remain dominant when quantity is positive.
- `Add to shop` remains the primary action at zero quantity.
- `Use soon` and `Use in next plan` remain visible, distinct planning-intent toggles with correct `aria-pressed` state.
- Edit and Archive move into a Base UI overflow Menu.
- Archive continues through an Alert Dialog confirmation.
- No card presents more than one visually primary button at a time.

Constraints:

- Do not hide quantity adjustment or planning intent in the overflow menu.
- Preserve the rule that zero quantity does not archive or delete an item.
- Preserve all stock planning, replenishment, shopping, and archive behavior.
- Use an accessible icon-only menu trigger with a label and title/tooltip.
- Do not add card entrance, reordering, stagger, hover-lift, or spring animation.
- Ensure the footer remains readable and usable at 320px.

After implementation, ask one existing subagent for a read-only review of the final ShoppingPage diff against AGENTS.md business rules before completing the task.

Verification:

- Update or add focused tests for quantity controls, zero-state shopping, both planning toggles, menu opening, Edit, Archive, cancellation, confirmation, and focus restoration.
- Run all ShoppingPage and stock planning tests.
- Run `npm run check`.
- Review keyboard, screen-reader semantics, touch target sizes, and mobile wrapping.

Handoff requirements:

- Describe the final action hierarchy for positive and zero quantity states.
- Confirm which actions moved into the menu.
- Report tests and business-rule review results.
- Record any deferred layout or copy refinements.
- Recommend Prompt 6 when complete.
```

---

## Prompt 6: Sonner notification migration

Recommended model: `gpt-5.6-sol`  
Recommended reasoning: medium

```text
Implement Phase 6 of the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading:

- AGENTS.md, especially the shared toast error pattern
- docs/UI_IMPROVEMENT_PLAN.md, especially Phase 6
- App.tsx, AppProvider.tsx, ToastViewport.tsx, every `notify()` caller, existing tests, and toast CSS
- Previous prompt handoffs, if available

This is a multi-agent migration. The root agent must be the only writer to package files, AppProvider.tsx, ToastViewport.tsx, and global.css. Spawn up to two read-only subagents:

1. `notification_api_map`: Inventory all notification tones, callers, tests, provider state, and assumptions about timing or dismissal. Identify the smallest migration that keeps feature code stable. Do not edit files.
2. `toast_visual_review`: Analyze desktop and mobile placement, bottom-navigation clearance, themes, close-target sizing, reduced-motion behavior, and existing token usage. Return a concrete Sonner styling checklist. Do not edit files.

The root agent owns dependency installation and implementation. Request approval if network access is blocked.

Implementation goals:

- Install `sonner` and update the lockfile.
- Preserve `notify(message, tone)` as the feature-facing API.
- Delegate to Sonner's default, success, info, and error toast functions.
- Replace or repurpose ToastViewport as a local Toaster wrapper.
- Remove obsolete custom toast array, dismiss logic, and timers only after confirming there are no consumers.
- Style through existing typography and colour tokens for light, dark, and system themes.
- Keep bottom-right placement on desktop and clear the fixed bottom navigation on mobile.
- Ensure dismissal controls meet the 44px target.
- Use interruptible enter/exit behavior. Target 200ms enter and 140ms exit if the library's supported styling hooks allow it cleanly.
- Enter from and exit through the same bottom edge.
- Reduced motion uses opacity only.
- Do not add Motion or custom keyframe orchestration.

Verification:

- Test all tones and representative notify callers.
- Verify multiple toasts, dismissal, automatic timing, hidden-tab timer behavior, mobile placement, and light/dark theming.
- Run relevant provider and feature tests.
- Run `npm run check`.
- Inspect the final bundle/build for correct Sonner CSS inclusion.

Handoff requirements:

- Report the installed Sonner version.
- Explain how the existing notify API was preserved.
- List removed custom toast state and CSS.
- Report theme, reduced-motion, placement, timing, and test verification.
- Recommend Prompt 7 when complete.
```

---

## Prompt 7: optional segmented-control polish

Recommended model: `gpt-5.6-terra`  
Recommended reasoning: high

```text
Evaluate and, only if robust, implement Phase 7 of the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading:

- AGENTS.md
- docs/UI_IMPROVEMENT_PLAN.md, especially Phase 7
- SegmentedControl.tsx, every call site, related CSS, and previous handoffs

This is an optional polish task. A correct static control is better than a fragile animated one. Spawn up to two read-only subagents:

1. `segmented_design`: Propose a generic moving-indicator implementation that works for every supported option count and label width without layout shift. Evaluate DOM, CSS, ResizeObserver, and accessibility tradeoffs. Do not edit files.
2. `segmented_semantics`: Review the current group and `aria-pressed` semantics versus radio semantics. Recommend the least disruptive correct approach and a keyboard test matrix. Do not edit files.

The root agent decides whether the candidate passes the gate. If it does not, make no implementation and document the rejection.

If implementing:

- Add one background indicator beneath stationary labels.
- Move it with a transform over 200ms using `var(--ease-in-out)`.
- Rapid changes must retarget smoothly through transitions, not restart keyframes.
- Preserve immediate pointer and keyboard interaction.
- Preserve or improve semantics without mixing incompatible group and radio patterns.
- Reduced motion moves the indicator instantly while allowing a 140ms colour fade.
- Ensure all options retain a 44px target.
- Do not add a motion library.

Verification:

- Test two, three, and any other supported option counts.
- Test unequal and wrapping-resistant labels at mobile and desktop widths.
- Test keyboard navigation, focus visibility, touch, rapid clicks, and reduced motion.
- Run focused tests, lint, build, and preferably `npm run check`.

Handoff requirements:

- State clearly whether the optional animation was implemented or rejected.
- If implemented, explain why the approach is generic and accessible.
- If rejected, explain which gate failed and retain the current static control.
- Recommend Prompt 8 for the final audit.
```

---

## Prompt 8: final multi-agent audit and completion pass

Recommended model: `gpt-5.6-sol`  
Recommended reasoning: high

```text
Perform the final completion audit for the UI improvement plan in:

/Users/sanjaypatel/Documents/Family Meal Planner/meal-planner-v2

Required reading:

- AGENTS.md
- docs/UI_IMPROVEMENT_PLAN.md in full, especially the rejected motion list, verification matrix, handoff format, and definition of done
- All available handoffs from Prompts 1 through 7
- The complete current diff

This is a multi-agent review. Spawn three read-only subagents in parallel if capacity allows:

1. `accessibility_final`: Audit keyboard flow, focus, dialog and menu semantics, target sizes, labels, live regions, reduced motion, and destructive confirmations against AGENTS.md and the plan. Do not edit files.
2. `motion_performance_final`: Audit every transition and animation for purpose, frequency, property choice, duration, easing, interruption, hover gating, and reduced-motion behavior. Search specifically for smooth core navigation, `transition: all`, `ease-in`, layout-property animations, ungated hover motion, keyframes on dynamic UI, and unnecessary Motion usage. Do not edit files.
3. `product_responsive_final`: Audit Plan, Recipes, Shop, Home Stock, Settings, toasts, dialogs, sticky regions, mobile bottom navigation, and action hierarchy at the source level. Identify likely 320px, dark-theme, and long-content failures. Do not edit files.

While the subagents work:

- Inspect `git status --short` and the complete diff.
- Map every plan acceptance criterion to evidence in code or tests.
- Do not assume earlier sessions completed their phases correctly.

After receiving all reports, consolidate findings by severity. The root agent may fix issues that are clearly within the UI plan. Preserve user-owned changes and do not expand into unrelated product work. If two findings conflict, prioritize accessibility, business rules, and directness over decorative polish.

Required verification:

- Run all focused UI tests needed for any final fixes.
- Run `npm run check` and report each constituent result.
- Search for all rejected patterns named in the plan.
- If browser tooling is available, verify the full responsive, theme, keyboard, touch, and reduced-motion matrix. If not, clearly separate code/test verification from outstanding visual verification.
- Review the final diff for accidental dependency, API, data-model, or business-rule changes.

Completion rules:

- Do not claim the plan is complete if a definition-of-done item is unverified or failing.
- Classify remaining items as blocking, non-blocking follow-up, or intentionally rejected.
- Do not create a commit or PR unless explicitly requested.

Final response format:

1. Overall completion verdict.
2. Plan phases completed.
3. Files and dependencies changed across the final pass.
4. Tests and checks with exact results.
5. Manual verification performed.
6. Remaining risks or blockers.
7. A concise recommendation for the next action, if any.
```

## Why the prompts use read-only subagents

Most phases converge on the same small set of files. Allowing several agents to edit those files simultaneously would make conflicts and accidental overwrites more likely than useful parallelism. These prompts use subagents where parallelism adds the most value:

- complete inventories before editing;
- accessibility and product-design review from independent perspectives;
- test design while the root agent studies the implementation;
- final diff review after the root agent integrates changes.

The root agent remains the single writer and decision owner for each session. This preserves the speed benefits of multi-agent analysis without sacrificing coherence or the user's existing work.
