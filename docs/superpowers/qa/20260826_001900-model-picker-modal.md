# QA Report: Model Picker Modal

**Date:** 2026-08-26
**Type:** Major Enhancement (UI)
**Classification:** UPDATE / REFACTOR

## Summary

Replaced the inline `<select>` model family + thinking-level dropdowns in
`MessageToolbar.vue` with a single modal picker (`ModelPicker.vue`) modeled on
the existing `SkillsPicker.vue`. The toolbar now shows a compact chip displaying
the current `Family · Level`; clicking it opens the modal.

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Model selection lives in a modal | Pass |
| 2 | Search filter in the modal | Pass |
| 3 | Models categorized per group (tier) | Pass |
| 4 | Sort within each category | Pass |
| 5 | Choose thinking level | Pass |

## Implementation

- **New:** `apps/web/app/components/ModelPicker.vue`
  - Teleported modal, same shell/transition as `SkillsPicker`.
  - Search input filters across `id`, `label`, `context`, `tier`.
  - Tier-grouped sections (Free → Budget → Mid-range → Premium) with counts.
  - Sort control (Default / Name / Context / Price) applied within each tier.
  - Family rows expand to reveal thinking-level variants (level label, pricing,
    Free badge, check on current). Selecting a level emits `select(variantId)`.
  - Keyboard nav: ↑/↓ across family + level rows, Enter to expand/select, Esc
    to close. `activeIndex` clamped on expand/collapse and query change.
  - Footer: visible model count + current selection summary.
  - Auto-expands the currently-selected family on open.

- **Edited:** `apps/web/app/components/MessageToolbar.vue`
  - Removed the two `<select>`s and the inline search input.
  - Removed `familyGroups`, `filteredFamilyGroups`, `onFamilyChange`,
    `levelOptions`, `levelRank`, `TIER_*`, `filterQuery` — all selection logic
    moved into `ModelPicker`.
  - Added a model chip button showing `currentLabel` (derived from
    `modelValue` + `families`); emits `openModels`.
  - Still re-exports `ModelFamily` type for consumers.
  - `update:modelValue` emit retained for `v-model` compatibility (the page
    still binds `v-model="selectedModel"`; the modal writes to it via `@select`).

- **Edited:** `apps/web/app/pages/conversations/[id].vue`
  - Added `modelPickerOpen` ref, `@open-models` handler, `<ModelPicker>`.

- **Edited:** `apps/web/app/pages/projects/[id].vue`
  - Same wiring as above.

## Validation

- `pnpm typecheck` — Pass (exit 0).
- `pnpm test` (vitest) — Pass, 25/25 tests across 5 files.
- `pnpm build` (nuxt build) — Pass, exit 0, no warnings/errors.
- Existing `use-selected-model.test.ts` persistence regression suite still
  green — the composable and `v-model` flow are unchanged.

## Edge Cases Considered

- **Empty families list:** renders "No models available." empty state.
- **No search matches:** renders "No models match "{query}"." empty state.
- **Family with single variant:** still expandable; one level row shown.
- **Collapse while activeIndex points at a removed level row:** watcher clamps
  `activeIndex` back into bounds.
- **Unknown `current` id (not in any family):** chip falls back to "Models";
  no family shows the selected check; modal opens with no auto-expand.
- **Free vs paid variant pricing:** free variants render pricing in emerald;
  paid variants use the muted content color.
- **Sort stability:** `default` preserves API order; other modes use
  `Array.sort` (stable in modern V8).

## Regressions

None observed. The `selectedModel` ref, `ensureDefault` persistence, and the
`/api/models` contract are untouched. `MessageToolbar` keeps the same prop
shape (`modelValue`, `families`, `bypassMode`, `disabled`) and the same
`update:modelValue` / `update:bypassMode` emits, so both pages compile and
typecheck without further changes.

## Manual Validation Outstanding

Per dev-server restrictions, the app was not run live. Recommended manual
checks before merge:

1. Open a conversation and a project page; click the model chip → modal opens.
2. Search filters families live; clearing restores the full list.
3. Cycle the sort control; verify ordering within each tier changes.
4. Expand a family; select a thinking level; modal closes and the chip label
   updates to `Family · Level`.
5. Keyboard: ↑/↓ moves highlight, Enter expands/selects, Esc closes.
6. Confirm the selected model persists when navigating between projects and
   conversations (covered by the existing persistence test).
