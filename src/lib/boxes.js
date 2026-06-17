// Box data + estimation logic for the Moving Volume Estimator.
//
// This module is intentionally FRAMEWORK-FREE — it imports no React and knows
// nothing about how items were collected. It takes a list of items, each
// tagged with a size category, and returns a box estimate. Manual entry feeds
// it today; the planned photo scanner will feed it the same shape later, so the
// whole estimation pipeline is decoupled from the input method.
//
// An item is:
//   { name?: string,
//     size: 'small' | 'medium' | 'large',
//     quantity?: number,   // how many of this item (default 1)
//     fragile?: boolean }  // fragile OR heavy → smaller, sturdier box
// (`name` is for display; `size`, `quantity`, and `fragile` drive the estimate.)

/**
 * Catalog of box types with real published volumes, in cubic feet.
 *
 * Volumes verified against U-Haul's published box guide (June 2026):
 *   Book / file box                     ~12×15×10 in  → 1.0 cu ft
 *   Small Moving Box     16⅜ × 12⅝ × 12⅝ in           → 1.5 cu ft
 *   Medium Moving Box    18⅛ × 18 × 16 in             → 3.0 cu ft
 *   Large Moving Box     18 × 18 × 24 in              → 4.5 cu ft
 *   Extra-Large Moving Box 24 × 18 × 24 in            → 6.0 cu ft
 *
 * Note: the build spec's reference sheet listed the X-Large at 6.1 cu ft, but
 * U-Haul publishes it as 6 cu ft (24×18×24 = 6.0), so we use the verified 6.0.
 *
 * The estimator packs ordinary items into small/medium/large boxes and routes
 * fragile/heavy items into the book/file box; the extra-large entry rounds out
 * the catalog for display and future use.
 */
export const BOXES = {
  file: { id: 'file', label: 'Book / file box', volumeCubicFeet: 1.0 },
  small: { id: 'small', label: 'Small box', volumeCubicFeet: 1.5 },
  medium: { id: 'medium', label: 'Medium box', volumeCubicFeet: 3.0 },
  large: { id: 'large', label: 'Large box', volumeCubicFeet: 4.5 },
  xlarge: { id: 'xlarge', label: 'Extra-large box', volumeCubicFeet: 6.0 },
}

/** The item size categories the estimator understands, in display order. */
export const ITEM_SIZES = ['small', 'medium', 'large']

/**
 * How an ordinary (non-fragile) item size maps to a box, plus how many such
 * items we assume fit per box. These packing capacities are deliberate MVP
 * assumptions — illustrative, not a precise logistics model. Tune freely:
 *   ~5 small items  per small box
 *   ~3 medium items per medium box
 *   ~2 large items  per large box
 */
export const SIZE_TO_BOX = {
  small: { boxId: 'small', itemsPerBox: 5 },
  medium: { boxId: 'medium', itemsPerBox: 3 },
  large: { boxId: 'large', itemsPerBox: 2 },
}

/**
 * Box-choice rule beyond raw volume: a fragile OR heavy item is packed into the
 * small, sturdy book/file box (double-walled, 1.0 cu ft) instead of the box its
 * raw size would otherwise pick — so a heavy box stays liftable and a fragile
 * one is better protected. Such items pack fewer-per-box than ordinary small
 * items. Like the capacities above, this is an MVP assumption, not a precise
 * figure. All fragile/heavy items collect here regardless of their size tag.
 */
export const STURDY_BOX = { boxId: 'file', itemsPerBox: 4 }

/**
 * Estimate the boxes needed for a list of sized items.
 *
 * @param {Array<{ name?: string, size: string, quantity?: number, fragile?: boolean }>} items
 * @returns {{
 *   breakdown: Array<{
 *     size: string, boxId: string, label: string,
 *     itemCount: number, count: number,
 *     boxVolumeCubicFeet: number, subtotalCubicFeet: number,
 *   }>,
 *   counts: { small: number, medium: number, large: number, file: number },
 *   totalBoxes: number,
 *   totalCubicFeet: number,
 * }}
 */
export function estimateBoxes(items) {
  const list = Array.isArray(items) ? items : []

  // 1. Tally item quantities into buckets. A fragile/heavy item overrides its
  //    size and routes to the sturdy box; every other item routes by size.
  //    Items without a recognized size are ignored (fragile or not).
  const sizeTally = { small: 0, medium: 0, large: 0 }
  let sturdyTally = 0
  for (const item of list) {
    if (!Object.prototype.hasOwnProperty.call(sizeTally, item?.size)) continue
    const qty = itemQuantity(item)
    if (qty <= 0) continue
    if (item.fragile) {
      sturdyTally += qty
    } else {
      sizeTally[item.size] += qty
    }
  }

  // 2. Convert tallies into whole boxes (always round up). The sturdy/file row
  //    comes last so the breakdown reads small → medium → large → fragile.
  const breakdown = [
    ...ITEM_SIZES.map((size) =>
      buildRow({ size, ...SIZE_TO_BOX[size], itemCount: sizeTally[size] }),
    ),
    buildRow({ size: 'fragile', ...STURDY_BOX, itemCount: sturdyTally }),
  ]

  // 3. Roll up totals. The total volume feeds the vehicle lookup (vehicles.js).
  const totalBoxes = breakdown.reduce((sum, row) => sum + row.count, 0)
  const totalCubicFeet = round1(
    breakdown.reduce((sum, row) => sum + row.count * row.boxVolumeCubicFeet, 0),
  )
  const counts = Object.fromEntries(
    breakdown.map((row) => [row.boxId, row.count]),
  )

  return { breakdown, counts, totalBoxes, totalCubicFeet }
}

/** Build one breakdown row, rounding the item tally up to whole boxes. */
function buildRow({ size, boxId, itemsPerBox, itemCount }) {
  const box = BOXES[boxId]
  const count = Math.ceil(itemCount / itemsPerBox) // 0 items → 0 boxes
  return {
    size,
    boxId,
    label: box.label,
    itemCount,
    count,
    boxVolumeCubicFeet: box.volumeCubicFeet,
    subtotalCubicFeet: round1(count * box.volumeCubicFeet),
  }
}

/**
 * Resolve an item's quantity. Missing or non-numeric → 1 (treat as one unit);
 * zero or negative → 0 (contributes nothing). A positive finite number is used
 * as-is; box counts always round up, so any fractional remainder still rounds
 * into a whole box.
 */
function itemQuantity(item) {
  const raw = item?.quantity
  if (raw === undefined || raw === null) return 1
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  return n > 0 ? n : 0
}

/** Round to one decimal place to avoid floating-point noise in volumes. */
function round1(n) {
  return Math.round(n * 10) / 10
}
