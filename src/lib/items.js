// The shared item shape that feeds the estimator.
//
// Both input methods — manual entry and photo detection — produce items of the
// same shape so that, once in the list, they are indistinguishable and flow
// through estimateBoxes() / recommendVehicle() unchanged. ITEM_SIZES (from the
// estimator) is the single source of truth for valid sizes.

import { ITEM_SIZES } from './boxes.js'

/** Clamp a size to a known item size; default 'medium' (the user can edit it). */
export function normalizeItemSize(size) {
  return ITEM_SIZES.includes(size) ? size : 'medium'
}

/**
 * Convert detection output (`{ name, size }[]`) into estimator items ready to
 * drop into the list: quantity 1, not fragile, size normalized. The result has
 * the SAME estimator fields a manually-added item has (the UI only adds an `id`
 * list key on insert), so detected and manual items behave identically.
 *
 * @param {Array<{ name?: string, size?: string }>} detections
 * @returns {Array<{ name: string, size: string, quantity: number, fragile: boolean }>}
 */
export function detectionsToItems(detections) {
  if (!Array.isArray(detections)) return []
  return detections
    .filter((d) => d && typeof d.name === 'string' && d.name.trim())
    .map((d) => ({
      name: d.name.trim(),
      size: normalizeItemSize(d.size),
      quantity: 1,
      fragile: false,
    }))
}
