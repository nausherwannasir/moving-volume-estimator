import { describe, it, expect } from 'vitest'
import { BOXES, estimateBoxes } from './boxes.js'

// The sample list from the build spec, used to verify the whole pipeline.
const SAMPLE_ITEMS = [
  { name: 'Books', size: 'small' },
  { name: 'Books', size: 'small' },
  { name: 'Kitchenware', size: 'medium' },
  { name: 'Lamp', size: 'medium' },
  { name: 'Clothes', size: 'large' },
  { name: 'Bedding', size: 'large' },
  { name: 'Monitor', size: 'medium' },
]

describe('BOXES catalog', () => {
  it('lists box types with U-Haul published volumes (cu ft)', () => {
    expect(BOXES.file.volumeCubicFeet).toBe(1.0)
    expect(BOXES.small.volumeCubicFeet).toBe(1.5)
    expect(BOXES.medium.volumeCubicFeet).toBe(3.0)
    expect(BOXES.large.volumeCubicFeet).toBe(4.5)
    expect(BOXES.xlarge.volumeCubicFeet).toBe(6.0)
  })

  it('gives every box type a human-readable label', () => {
    for (const box of Object.values(BOXES)) {
      expect(typeof box.label).toBe('string')
      expect(box.label.length).toBeGreaterThan(0)
    }
  })
})

describe('estimateBoxes', () => {
  it('returns all-zero estimate for an empty list', () => {
    const result = estimateBoxes([])
    expect(result.totalBoxes).toBe(0)
    expect(result.totalCubicFeet).toBe(0)
    expect(result.counts).toEqual({ small: 0, medium: 0, large: 0 })
  })

  it('treats non-array input as empty', () => {
    expect(estimateBoxes(undefined).totalBoxes).toBe(0)
    expect(estimateBoxes(null).totalBoxes).toBe(0)
  })

  it('estimates the sample list into 1 small + 1 medium + 1 large box', () => {
    const result = estimateBoxes(SAMPLE_ITEMS)
    expect(result.counts).toEqual({ small: 1, medium: 1, large: 1 })
    expect(result.totalBoxes).toBe(3)
    // 1×1.5 + 1×3.0 + 1×4.5
    expect(result.totalCubicFeet).toBe(9)
  })

  it('rounds box counts up to whole boxes', () => {
    // 5 small per small box: 6 small items need 2 boxes, 5 need exactly 1.
    expect(estimateBoxes(makeItems('small', 6)).counts.small).toBe(2)
    expect(estimateBoxes(makeItems('small', 5)).counts.small).toBe(1)
    // 3 medium per medium box.
    expect(estimateBoxes(makeItems('medium', 4)).counts.medium).toBe(2)
    // 2 large per large box.
    expect(estimateBoxes(makeItems('large', 3)).counts.large).toBe(2)
  })

  it('ignores items with an unrecognized size', () => {
    const result = estimateBoxes([{ name: 'Mystery', size: 'gigantic' }])
    expect(result.totalBoxes).toBe(0)
    expect(result.totalCubicFeet).toBe(0)
  })

  it('total volume equals the sum of the per-type subtotals', () => {
    const result = estimateBoxes(SAMPLE_ITEMS)
    const summed = result.breakdown.reduce(
      (sum, row) => sum + row.subtotalCubicFeet,
      0,
    )
    expect(result.totalCubicFeet).toBeCloseTo(summed, 5)
  })

  it('exposes a per-type breakdown the UI can render', () => {
    const result = estimateBoxes(SAMPLE_ITEMS)
    const small = result.breakdown.find((row) => row.size === 'small')
    expect(small).toMatchObject({
      label: 'Small box',
      count: 1,
      itemCount: 2,
      boxVolumeCubicFeet: 1.5,
      subtotalCubicFeet: 1.5,
    })
  })
})

function makeItems(size, n) {
  return Array.from({ length: n }, (_, i) => ({ name: `${size}-${i}`, size }))
}
