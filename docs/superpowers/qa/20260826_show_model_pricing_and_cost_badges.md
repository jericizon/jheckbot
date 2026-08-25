# QA Report: Model Pricing and Cost Badges

**Date:** 2026-08-26
**Type:** UPDATE (UI)
**Classification:** UPDATE

## Summary

Added pricing visibility to the model chip in `MessageToolbar.vue` and tier/cost badges to `ModelPicker.vue` so users can see whether a model is free, paid, or premium before selecting it.

## Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Toolbar model chip shows `Family · Level · Price` | Pass |
| 2 | Toolbar chip uses a colored dot for the model tier (free/paid/premium) | Pass |
| 3 | `ModelPicker` family rows show the cheapest paid price or `Free` | Pass |
| 4 | `ModelPicker` level rows color the price by cost tier and show `Paid`/`Premium` badges | Pass |
| 5 | `ModelPicker` footer shows the selected model's price | Pass |
| 6 | No regressions in keyboard navigation, search, sort, or selection | Pass |

## Implementation

- **Updated:** `apps/web/app/components/MessageToolbar.vue`
  - Added `currentModel`, `currentPricing`, `currentTier`, tier dot, and tier-colored price text to the model chip.
  - Updated `title` and `aria-label` to include the full model, pricing, and tier.

- **Updated:** `apps/web/app/components/ModelPicker.vue`
  - Added tier color maps (`TIER_TEXT`, `TIER_DOT`, `TIER_BG`).
  - Added `variantCostTier`, `variantPricingClass`, `variantDotClass`, `variantBadgeClass`, and `costLabel` helpers.
  - Added `familyPriceSummary` to show the cheapest paid variant on the family row.
  - Added `priceSummary` to `FamilyItem` and populated it in `visibleGroups`.
  - Updated family row template to show a dot, price, and `Free`/`Paid`/`Premium` badge.
  - Updated level row template to color the price and show `Paid`/`Premium` badges for non-free variants.
  - Updated footer to show `Selected: Family · Level · Price`.

## Validation

- `pnpm typecheck` — Pass (exit 0)
- `pnpm test` — Pass
  - `packages/shared`: 8/8 tests
  - `apps/web`: 32/32 tests
  - `apps/api`: 381/381 tests
- `pnpm build` — Pass (exit 0)

## Edge Cases Considered

- Families with both free and paid variants (e.g., `GLM-5.2`) show the cheapest paid price in the family row while the level rows keep each variant's actual price.
- Non-free variants inside an otherwise `free`-tier family are colored as `budget` so they don't look free at a glance.
- Free variants always use `emerald-500` and no `Paid`/`Premium` badge.
- If the current model id is unknown, the toolbar chip falls back to `Models` and the picker footer hides the price.
