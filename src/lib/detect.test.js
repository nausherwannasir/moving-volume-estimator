import { describe, it, expect } from 'vitest'
import {
  normalizeSize,
  parseGeminiItems,
  cocoClassToSize,
  cocoDetectionsToItems,
} from './detect.js'

describe('normalizeSize', () => {
  it('passes through the three known sizes', () => {
    expect(normalizeSize('small')).toBe('small')
    expect(normalizeSize('medium')).toBe('medium')
    expect(normalizeSize('large')).toBe('large')
  })

  it('defaults anything unknown to medium (user confirms anyway)', () => {
    expect(normalizeSize('huge')).toBe('medium')
    expect(normalizeSize(undefined)).toBe('medium')
    expect(normalizeSize(42)).toBe('medium')
  })
})

describe('parseGeminiItems', () => {
  it('parses a clean JSON array into {name,size} items', () => {
    const text = '[{"name":"Books","size":"small"},{"name":"Sofa","size":"large"}]'
    expect(parseGeminiItems(text)).toEqual([
      { name: 'Books', size: 'small' },
      { name: 'Sofa', size: 'large' },
    ])
  })

  it('strips ```json fences before parsing', () => {
    const text = '```json\n[{"name":"Lamp","size":"medium"}]\n```'
    expect(parseGeminiItems(text)).toEqual([{ name: 'Lamp', size: 'medium' }])
  })

  it('strips bare ``` fences before parsing', () => {
    const text = '```\n[{"name":"Mug","size":"small"}]\n```'
    expect(parseGeminiItems(text)).toEqual([{ name: 'Mug', size: 'small' }])
  })

  it('returns [] for non-JSON junk instead of throwing', () => {
    expect(parseGeminiItems('I see a sofa and some books.')).toEqual([])
    expect(parseGeminiItems('')).toEqual([])
  })

  it('returns [] when the JSON is not an array', () => {
    expect(parseGeminiItems('{"name":"Books","size":"small"}')).toEqual([])
  })

  it('drops entries without a usable name', () => {
    const text = '[{"size":"small"},{"name":"  ","size":"large"},{"name":"Box","size":"medium"}]'
    expect(parseGeminiItems(text)).toEqual([{ name: 'Box', size: 'medium' }])
  })

  it('defaults an invalid or missing size to medium', () => {
    const text = '[{"name":"Mystery"},{"name":"Thing","size":"gigantic"}]'
    expect(parseGeminiItems(text)).toEqual([
      { name: 'Mystery', size: 'medium' },
      { name: 'Thing', size: 'medium' },
    ])
  })

  it('returns [] for non-string input', () => {
    expect(parseGeminiItems(null)).toEqual([])
    expect(parseGeminiItems(undefined)).toEqual([])
    expect(parseGeminiItems(123)).toEqual([])
  })
})

describe('cocoClassToSize', () => {
  it('maps known classes to a coarse real-world size', () => {
    expect(cocoClassToSize('book')).toBe('small')
    expect(cocoClassToSize('microwave')).toBe('medium')
    expect(cocoClassToSize('couch')).toBe('large')
  })

  it('defaults unmapped classes to medium', () => {
    expect(cocoClassToSize('totally unknown thing')).toBe('medium')
  })
})

describe('cocoDetectionsToItems', () => {
  it('maps detections to title-cased {name,size} items', () => {
    const detections = [
      { class: 'book', score: 0.9 },
      { class: 'couch', score: 0.8 },
    ]
    expect(cocoDetectionsToItems(detections)).toEqual([
      { name: 'Book', size: 'small' },
      { name: 'Couch', size: 'large' },
    ])
  })

  it('drops very-low-confidence detections below the score threshold', () => {
    const detections = [
      { class: 'book', score: 0.2 },
      { class: 'tv', score: 0.7 },
    ]
    expect(cocoDetectionsToItems(detections)).toEqual([
      { name: 'Tv', size: 'medium' },
    ])
  })

  it('keeps moderate-confidence detections (e.g. a 0.4 water bottle)', () => {
    // Single transparent objects often score 0.3–0.5; favor recall since the
    // user confirms sizes anyway.
    expect(cocoDetectionsToItems([{ class: 'bottle', score: 0.4 }])).toEqual([
      { name: 'Bottle', size: 'small' },
    ])
  })

  it('excludes living things (people, pets) — not belongings', () => {
    const detections = [
      { class: 'person', score: 0.99 },
      { class: 'dog', score: 0.95 },
      { class: 'book', score: 0.8 },
    ]
    expect(cocoDetectionsToItems(detections)).toEqual([
      { name: 'Book', size: 'small' },
    ])
  })

  it('returns [] for non-array input', () => {
    expect(cocoDetectionsToItems(null)).toEqual([])
    expect(cocoDetectionsToItems(undefined)).toEqual([])
  })
})
