import { describe, it, expect } from 'vitest'
import { VEHICLES, LOAD_FACTOR, recommendVehicle } from './vehicles.js'

describe('VEHICLES catalog', () => {
  it('lists vehicles with real positive cargo volumes (cu ft)', () => {
    for (const v of VEHICLES) {
      expect(typeof v.label).toBe('string')
      expect(v.label.length).toBeGreaterThan(0)
      expect(v.cargoCubicFeet).toBeGreaterThan(0)
    }
  })

  it('uses the U-Haul published truck capacities', () => {
    const byId = Object.fromEntries(VEHICLES.map((v) => [v.id, v.cargoCubicFeet]))
    expect(byId.van).toBe(245)
    expect(byId.truck10).toBe(402)
    expect(byId.truck15).toBe(764)
    expect(byId.truck20).toBe(1016)
    expect(byId.truck26).toBe(1682)
  })

  it('is ordered smallest → largest (recommendVehicle depends on this)', () => {
    for (let i = 1; i < VEHICLES.length; i++) {
      expect(VEHICLES[i].cargoCubicFeet).toBeGreaterThan(
        VEHICLES[i - 1].cargoCubicFeet,
      )
    }
  })
})

describe('recommendVehicle', () => {
  it('recommends no vehicle for an empty (zero) load', () => {
    const result = recommendVehicle(0)
    expect(result.vehicle).toBeNull()
    expect(result.multipleTrips).toBe(false)
  })

  it('treats negative or non-numeric volume as nothing to move', () => {
    expect(recommendVehicle(-10).vehicle).toBeNull()
    expect(recommendVehicle('nope').vehicle).toBeNull()
  })

  it('picks the smallest vehicle whose usable capacity fits the load', () => {
    // usable = cargoCubicFeet × 0.8: car 12, suv 60, van 196, truck10 321.6
    expect(recommendVehicle(10).vehicle.id).toBe('car')
    expect(recommendVehicle(50).vehicle.id).toBe('suv')
    expect(recommendVehicle(300).vehicle.id).toBe('truck10')
  })

  it('steps up to the next vehicle right past a usable-capacity boundary', () => {
    expect(recommendVehicle(12).vehicle.id).toBe('car') // exactly car's usable
    expect(recommendVehicle(12.1).vehicle.id).toBe('suv') // just over → SUV
  })

  it('recommends the largest vehicle and flags multiple trips when over capacity', () => {
    const result = recommendVehicle(5000)
    expect(result.vehicle.id).toBe('truck26')
    expect(result.multipleTrips).toBe(true)
  })

  it('never recommends a smaller vehicle for a larger load (monotonic)', () => {
    const volumes = [5, 12, 13, 60, 200, 400, 800, 1300]
    let prevIndex = -1
    for (const vol of volumes) {
      const { vehicle } = recommendVehicle(vol)
      const index = VEHICLES.findIndex((v) => v.id === vehicle.id)
      expect(index).toBeGreaterThanOrEqual(prevIndex)
      prevIndex = index
    }
  })

  it('exposes LOAD_FACTOR as a tunable below 1', () => {
    expect(LOAD_FACTOR).toBeGreaterThan(0)
    expect(LOAD_FACTOR).toBeLessThanOrEqual(1)
  })
})
