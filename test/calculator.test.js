import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateExcisePenalty } from '../src/calculator.js'

test('calculates excise, VAT, and total penalty for the sample values', () => {
  assert.deepEqual(
    calculateExcisePenalty({ quantityKg: 1000, customsValue: 2000, exciseRatePerTonne: 500 }),
    { exciseRatePerKg: 0.5, excise: 500, vat: 450, penalty: 950 },
  )
})

test('rounds tax amounts to two decimal places', () => {
  assert.deepEqual(
    calculateExcisePenalty({ quantityKg: 1, customsValue: 0, exciseRatePerTonne: 1 }),
    { exciseRatePerKg: 0.001, excise: 0, vat: 0, penalty: 0 },
  )
  assert.deepEqual(
    calculateExcisePenalty({ quantityKg: 500, customsValue: 100, exciseRatePerTonne: 1 }),
    { exciseRatePerKg: 0.001, excise: 0.5, vat: 18.09, penalty: 18.59 },
  )
})

test('rejects negative and non-finite inputs', () => {
  assert.throws(
    () => calculateExcisePenalty({ quantityKg: -1, customsValue: 2000, exciseRatePerTonne: 500 }),
    RangeError,
  )
  assert.throws(
    () => calculateExcisePenalty({ quantityKg: 1000, customsValue: Infinity, exciseRatePerTonne: 500 }),
    RangeError,
  )
})
