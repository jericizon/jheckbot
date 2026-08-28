# QA Report: Office Cubicle Layout

## Summary

Implemented a Clash-of-Clans-style cubicle grid office layout where every agent has their own distinct, walled cubicle and the CEO sits in a central corner office. The aesthetic is cartoon office-floor (slate gradient + tile grid) with playful animations, decorative office props, and status-driven game elements.

## Verification Results

### Automated Tests

| Check | Result |
|-------|--------|
| `pnpm --filter @jheckbot/web typecheck` | PASS (exit 0) |
| `pnpm --filter @jheckbot/web test` | PASS — 10 files, 81 tests, 0 failures |

New test coverage:
- `cubicle-layout.test.ts` — 11 tests (grid columns, positions, center-gap reservation, scene height)
- `office.test.ts` — 25 tests (20 existing + 5 new for `getCubicleStatusProp`)

### Spec Success Criteria Traceability

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Every agent has a distinct, bounded cubicle with partition walls | ✅ | `OfficeCubicle.vue` renders walled tiles with partition wall, desk, monitor, chair |
| 2 | CEO in larger central corner office, visually distinct | ✅ | `OfficeCornerOffice.vue` — amber tile, signage, flag, dual monitors, larger footprint |
| 3 | CoC-style cartoon aesthetic, office-adapted | ✅ | Slate floor gradient, tile grid, office props (plants, coffee, lamps), drop shadows, `animate-unit-bob`/`animate-prop-sway` |
| 4 | Each cubicle shows avatar, name, role nameplate, status prop, status dot, activity bar | ✅ | `OfficeCubicle.vue` wraps `OfficeCharacter.vue` (avatar, name, status dot, activity bar) + adds desk monitor, status prop emoji, role nameplate |
| 5 | Responsive: mobile 1-2 cols, desktop 3-4 cols | ✅ | `gridColumns()` caps mobile at 2, desktop at 4; `resize` listener updates viewport ref |
| 6 | Dark mode renders correctly | ✅ | All colored elements have `dark:` variants (verified across 3 fix rounds) |
| 7 | Empty + loading states preserved | ✅ | `OfficeScene.vue` keeps existing `v-if="loading"` and empty branches |
| 8 | No regressions | ✅ | 81/81 tests pass, typecheck clean |
| 9 | New unit tests for cubicleLayout.ts | ✅ | 11 tests covering edge cases + center-gap invariant |
| 10 | Scene height scales with headcount | ✅ | `sceneHeightFor()` grows linearly with row count |

### Critical Fix Applied

The final review identified that `gridPositions` could place employee cubicles on top of the CEO at the scene center (50%, 50%) for certain headcounts (1, 3, 9 employees). Fixed by reserving a 20% center band (40-60% top) and distributing rows above and below it. Two new tests verify this invariant across headcounts 1-12.

## Manual Visual QA Checklist

The following requires a running dev server (user-managed per project rules). Run `pnpm dev` and open the office page to verify:

- [ ] Empty office state renders (🏢 + message)
- [ ] Loading state renders
- [ ] CEO alone renders in corner office, centered
- [ ] 1 employee renders in a cubicle above the CEO, no overlap
- [ ] 4 employees render in a grid, none overlapping the CEO
- [ ] 8+ employees render multi-row, scene height grows, no clipping
- [ ] Mobile breakpoint: 2 columns, no horizontal overflow
- [ ] Desktop breakpoint: up to 4 columns
- [ ] Dark mode: all tiles, floor, props, badges, activity bars legible
- [ ] Hover on a character: bounce + scale, glow ring on active
- [ ] Click a cubicle: detail panel opens (parent page)
- [ ] Click CEO: navigates to CEO chat
- [ ] Resource pills show correct counts
- [ ] Status props on desks match agent statuses

## Deferred Minors

- **Duplicated role-label logic** between `OfficeCubicle.vue` (`deskLabel`) and `OfficeCharacter.vue` (`badgeLabel`) — both have the same role→short-label mapping. Extracting a shared `roleShortLabel` utility is a worthwhile follow-up but was outside the plan scope. No functional drift currently.

## Commits

```
cacf8a1 fix(office): reserve CEO center in grid layout + dark mode activity bar
111e740 fix(office): add dark mode variants to resource pills
ac32b4c feat(office): replace ring layout with cubicle grid
d670a4f style(office): resize character for inside-cubicle presentation
c9f97e3 fix(office): add dark mode variants to OfficeCornerOffice
de35b29 feat(office): add OfficeCornerOffice component for CEO
17f6bb5 fix(office): add dark mode borders to OfficeCubicle
2c05006 feat(office): add OfficeCubicle component
cca2319 feat(office): add cubicle status prop mapping
49d2ad1 feat(office): add cubicle grid layout utility
```

## Verdict

**PASS** — All automated checks green, all spec success criteria met, critical center-overlap issue fixed and tested. Manual visual QA pending user verification with a running dev server.
