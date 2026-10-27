import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReservoirRecord, normalizeReservoirRecords } from '../src/reservoirs.js'

test('normalizes database reservoir values to finite numbers', () => {
  const [reservoir] = normalizeReservoirRecords([{
    id: 12,
    reservoir_number: 'R-12',
    capacity_kg: '2500',
    current_weight_kg: '1000',
  }])

  assert.equal(reservoir.id, '12')
  assert.equal(reservoir.capacity_kg, 2500)
  assert.equal(reservoir.current_weight_kg, 1000)
})

test('normalizes camel-case reservoir records and defaults missing volume to empty', () => {
  const reservoir = normalizeReservoirRecord({
    id: '13',
    reservoirNumber: 'R-13',
    capacityKg: 125,
  })

  assert.equal(reservoir.reservoir_number, 'R-13')
  assert.equal(reservoir.capacity_kg, 125)
  assert.equal(reservoir.current_weight_kg, 0)
})

test('preserves legacy database amounts when interpreting them as kilograms', () => {
  const [reservoir] = normalizeReservoirRecords([{
    id: '14',
    reservoir_number: 'R-14',
    capacity_m3: '500',
    current_volume_m3: '125',
  }])

  assert.equal(reservoir.capacity_kg, 500)
  assert.equal(reservoir.current_weight_kg, 125)
})

test('rejects incomplete or out-of-range reservoir records', () => {
  const invalidRecords = [
    { id: '1', reservoir_number: 'R-1', current_weight_kg: 0 },
    { id: '2', reservoir_number: 'R-2', capacity_kg: 'invalid', current_weight_kg: 0 },
    { id: '3', reservoir_number: 'R-3', capacity_kg: 100, current_weight_kg: 'invalid' },
    { id: '4', reservoir_number: 'R-4', capacity_kg: 100, current_weight_kg: 101 },
  ]

  for (const reservoir of invalidRecords) {
    assert.throws(() => normalizeReservoirRecord(reservoir), /რეზერვუარის/)
  }
})
