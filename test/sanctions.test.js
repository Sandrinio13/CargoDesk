import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sanctions = JSON.parse(
  await readFile(new URL('../src/sanctions.json', import.meta.url), 'utf8'),
)

test('includes the complete sanctions register and source links', () => {
  assert.equal(sanctions.updatedAt, '13.10.2026')
  assert.equal(sanctions.totalRecords, 15870)
  assert.equal(sanctions.rows.length, sanctions.totalRecords)
  assert.equal(sanctions.codedRecords, 13390)
  assert.equal(sanctions.fields.length, 14)
  assert.equal(sanctions.resources.length, 26)
  assert.ok(sanctions.resources.every(({ url }) => url.startsWith('https://')))
})

test('preserves goods codes, restriction flags, and long export-control entries', () => {
  const horse = sanctions.rows.find((row) => row.code === '0101 21 000 00')
  assert.ok(horse)
  assert.deepEqual(horse.restrictions, [
    { key: 'f', value: 'კი' },
    { key: 'h', value: 'კი' },
  ])

  const dualUseEntry = sanctions.rows
    .flatMap((row) => row.restrictions)
    .find((restriction) => restriction.key === 'n')
  assert.ok(dualUseEntry)
  assert.ok(dualUseEntry.value.length > 100)
})
