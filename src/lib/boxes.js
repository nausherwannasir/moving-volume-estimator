// Box data + estimation logic for the Moving Volume Estimator.
//
// This module is intentionally FRAMEWORK-FREE — it imports no React and knows
// nothing about how items were collected. It takes a list of items, each
// tagged with a size category, and returns a box estimate. Manual entry feeds
// it today; the planned photo scanner will feed it the same shape later, so the
// whole estimation pipeline is decoupled from the input method.
//
// An item is: { name?: string, size: 'small' | 'medium' | 'large' }
// (only `size` matters for the estimate; `name` is for display.)

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
 * The estimator below only packs into small/medium/large boxes; the file and
 * extra-large entries round out the catalog for display and future use.
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
 * How a tagged item size maps to a box, plus how many such items we assume fit
 * per box. These packing capacities are deliberate MVP assumptions — illustrative,
 * not a precise logistics model. Tune freely:
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
 * Estimate the boxes needed for a list of sized items.
 *
 * @param {Array<{ name?: string, size: string }>} items
 * @returns {{
 *   breakdown: Array<{
 *     size: string, boxId: string, label: string,
 *     itemCount: number, count: number,
 *     boxVolumeCubicFeet: number, subtotalCubicFeet: number,
 *   }>,
 *   counts: { small: number, medium: number, large: number },
 *   totalBoxes: number,
 *   totalCubicFeet: number,
 * }}
 */
export function estimateBoxes(items) {
  const list = Array.isArray(items) ? items : []

  // 1. Tally items per recognized size category (ignore anything else).
  const itemCounts = { small: 0, medium: 0, large: 0 }
  for (const item of list) {
    const size = item?.size
    if (Object.prototype.hasOwnProperty.call(itemCounts, size)) {
      itemCounts[size] += 1
    }
  }

  // 2. Convert item tallies into whole boxes (always round up).
  const breakdown = ITEM_SIZES.map((size) => {
    const { boxId, itemsPerBox } = SIZE_TO_BOX[size]
    const box = BOXES[boxId]
    const itemCount = itemCounts[size]
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
  })

  // 3. Roll up totals. The total volume feeds the vehicle lookup (Milestone 4).
  const totalBoxes = breakdown.reduce((sum, row) => sum + row.count, 0)
  const totalCubicFeet = round1(
    breakdown.reduce((sum, row) => sum + row.count * row.boxVolumeCubicFeet, 0),
  )
  const counts = Object.fromEntries(
    breakdown.map((row) => [row.size, row.count]),
  )

  return { breakdown, counts, totalBoxes, totalCubicFeet }
}

/** Round to one decimal place to avoid floating-point noise in volumes. */
function round1(n) {
  return Math.round(n * 10) / 10
}
