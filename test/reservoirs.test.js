import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeReservoir,
  normalizeReservoirMovement,
  ReservoirValidationError,
} from '../server/reservoirs.js'

test('accepts positive receive and release movements', () => {
  assert.deepEqual(normalizeReservoirMovement({ direction: 'receive', quantityKg: 12.5 }), {
    direction: 'receive',
    quantityKg: 12.5,
  })
  assert.deepEqual(normalizeReservoirMovement({ direction: 'release', quantityKg: 3 }), {
    direction: 'release',
    quantityKg: 3,
  })
})

test('rejects invalid movement directions and quantities', () => {
  for (const movement of [
    { direction: 'transfer', quantityKg: 1 },
    { direction: 'receive', quantityKg: 0 },
    { direction: 'release', quantityKg: -1 },
    { direction: 'receive', quantityKg: Number.NaN },
    { direction: 'release', quantityKg: Number.POSITIVE_INFINITY },
    { direction: 'receive', quantityKg: '10' },
    null,
  ]) {
    assert.throws(() => normalizeReservoirMovement(movement), ReservoirValidationError)
  }
})

test('trims the reservoir number and starts with an empty weight', () => {
  assert.deepEqual(normalizeReservoir({
    reservoirNumber: '  R-01  ',
    capacityKg: 2500,
  }), {
    reservoirNumber: 'R-01',
    capacityKg: 2500,
    currentWeightKg: 0,
  })
})

test('accepts a current weight up to the reservoir capacity', () => {
  assert.deepEqual(normalizeReservoir({
    reservoirNumber: 'R-02',
    capacityKg: 100.5,
    currentWeightKg: 100.5,
  }), {
    reservoirNumber: 'R-02',
    capacityKg: 100.5,
    currentWeightKg: 100.5,
  })
})

test('rejects missing or overlong reservoir numbers', () => {
  assert.throws(
    () => normalizeReservoir({ reservoirNumber: '  ', capacityKg: 10 }),
    ReservoirValidationError,
  )
  assert.throws(
    () => normalizeReservoir({ reservoirNumber: 'R'.repeat(61), capacityKg: 10 }),
    ReservoirValidationError,
  )
})

test('rejects non-positive, non-numeric, and out-of-range capacities', () => {
  for (const capacityKg of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '10']) {
    assert.throws(
      () => normalizeReservoir({ reservoirNumber: 'R-01', capacityKg }),
      ReservoirValidationError,
    )
  }
})

test('rejects an initial weight outside the capacity', () => {
  for (const currentWeightKg of [-1, 11, Number.NaN, '5']) {
    assert.throws(
      () => normalizeReservoir({
        reservoirNumber: 'R-01',
        capacityKg: 10,
        currentWeightKg,
      }),
      ReservoirValidationError,
    )
  }
})

test('rejects non-object request data', () => {
  for (const body of [null, [], 'reservoir']) {
    assert.throws(() => normalizeReservoir(body), ReservoirValidationError)
  }
})
