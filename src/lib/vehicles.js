// Vehicle data + recommendation for the Moving Volume Estimator.
//
// Framework-free, like boxes.js: it takes a total cargo volume in cubic feet
// and returns the smallest vehicle that can carry it. Manual entry feeds it the
// total today; the planned scanner will feed it the same total later.

/**
 * Cargo capacities in cubic feet, ordered smallest → largest. `recommendVehicle`
 * relies on this ascending order.
 *
 * Real published figures (verified June 2026):
 *   Car trunk (midsize sedan)      ~15 cu ft   typical EPA-rated sedan trunk
 *   SUV, rear seats folded         ~75 cu ft   typical midsize SUV max cargo
 *   Cargo van                       245 cu ft   U-Haul published
 *   10' moving truck                402 cu ft   U-Haul published
 *   15' moving truck                764 cu ft   U-Haul published
 *   20' moving truck              1,016 cu ft   U-Haul published
 *   26' moving truck              1,682 cu ft   U-Haul published
 */
export const VEHICLES = [
  { id: 'car', label: 'Car (trunk)', cargoCubicFeet: 15 },
  { id: 'suv', label: 'SUV (seats down)', cargoCubicFeet: 75 },
  { id: 'van', label: 'Cargo van', cargoCubicFeet: 245 },
  { id: 'truck10', label: "10' moving truck", cargoCubicFeet: 402 },
  { id: 'truck15', label: "15' moving truck", cargoCubicFeet: 764 },
  { id: 'truck20', label: "20' moving truck", cargoCubicFeet: 1016 },
  { id: 'truck26', label: "26' moving truck", cargoCubicFeet: 1682 },
]

/**
 * Fraction of a vehicle's rated cargo volume you can realistically fill once
 * boxes are stacked with gaps and irregular items get in the way. 0.8 is a
 * deliberate MVP assumption (illustrative, not a guarantee).
 */
export const LOAD_FACTOR = 0.8

/**
 * Recommend the smallest vehicle that can carry `totalCubicFeet`.
 *
 * @param {number} totalCubicFeet — total box volume from estimateBoxes()
 * @returns {{
 *   vehicle: { id: string, label: string, cargoCubicFeet: number } | null,
 *   multipleTrips: boolean,
 *   totalCubicFeet: number,
 * }}
 *   `vehicle` is null when there is nothing to move. `multipleTrips` is true
 *   when the load exceeds even the largest vehicle's usable capacity, in which
 *   case the largest vehicle is recommended.
 */
export function recommendVehicle(totalCubicFeet) {
  const total = Number(totalCubicFeet)
  const volume = Number.isFinite(total) && total > 0 ? total : 0

  if (volume === 0) {
    return { vehicle: null, multipleTrips: false, totalCubicFeet: 0 }
  }

  const fit = VEHICLES.find((v) => v.cargoCubicFeet * LOAD_FACTOR >= volume)
  if (fit) {
    return { vehicle: fit, multipleTrips: false, totalCubicFeet: volume }
  }

  // Bigger than our largest vehicle's usable capacity → recommend it but warn
  // that it will take more than one trip.
  const largest = VEHICLES[VEHICLES.length - 1]
  return { vehicle: largest, multipleTrips: true, totalCubicFeet: volume }
}
