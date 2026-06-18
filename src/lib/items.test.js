import { describe, it, expect } from 'vitest'
import { detectionsToItems, normalizeItemSize } from './items.js'
import { estimateBoxes } from './boxes.js'

describe('normalizeItemSize', () => {
  it('passes known sizes through, defaults unknown to medium', () => {
    expect(normalizeItemSize('small')).toBe('small')
    expect(normalizeItemSize('large')).toBe('large')
    expect(normalizeItemSize('xl')).toBe('medium')
    expect(normalizeItemSize(undefined)).toBe('medium')
  })
})

describe('detectionsToItems', () => {
  it('maps {name,size} detections into editable items (qty 1, not fragile)', () => {
    expect(detectionsToItems([{ name: 'Book', size: 'small' }])).toEqual([
      { name: 'Book', size: 'small', quantity: 1, fragile: false },
    ])
  })

  it('produces the same estimator field shape as a manually-added item', () => {
    const [item] = detectionsToItems([{ name: 'Sofa', size: 'large' }])
    // id is a UI-only list key added on insert; these are the estimator fields.
    expect(Object.keys(item).sort()).toEqual([
      'fragile',
      'name',
      'quantity',
      'size',
    ])
  })

  it('normalizes an unknown size to medium (user edits before estimating)', () => {
    expect(detectionsToItems([{ name: 'Thing', size: 'huge' }])[0].size).toBe(
      'medium',
    )
  })

  it('drops detections without a usable name', () => {
    expect(
      detectionsToItems([{ size: 'small' }, { name: '  ', size: 'large' }]),
    ).toEqual([])
  })

  it('returns [] for non-array input', () => {
    expect(detectionsToItems(null)).toEqual([])
    expect(detectionsToItems(undefined)).toEqual([])
  })

  it('feeds the unchanged estimator: detected items produce a normal estimate', () => {
    const items = detectionsToItems([
      { name: 'Book', size: 'small' },
      { name: 'Sofa', size: 'large' },
    ])
    const result = estimateBoxes(items)
    expect(result.counts.small).toBe(1) // 1 small item → 1 small box
    expect(result.counts.large).toBe(1) // 1 large item → 1 large box
    expect(result.totalBoxes).toBe(2)
  })
})
