import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extractDeclaration } from '../server/extract.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

test('extracts customs declaration fields from labelled PDF text', () => {
  const fields = extractDeclaration(`
    C No: C12345678
    Date: 12.10.2026
    EX: "Geo Trade Export"
    IM: "Geo Trade Import"
    4 Declarant: Geo Trade LLC
    15 Country of dispatch/export: Georgia
    31 Packages and description of goods: Electronic parts
    33 Commodity code: 8542 31 900 0
    35 Gross mass (kg): 1,250.50
    49 Identification of warehouse: Tbilisi Customs Warehouse
  `)

  assert.deepEqual(fields, {
    declarationNumber: 'C12345678',
    declarationDate: '12.10.2026',
    exporter: 'Geo Trade Export',
    importer: 'Geo Trade Import',
    declarant: 'Geo Trade LLC',
    dispatchCountry: 'Georgia',
    goodsDescription: 'Electronic parts',
    commodityCode: '8542319000',
    grossKg: 1250.5,
    warehouseName: 'Tbilisi Customs Warehouse',
  })
})

test('recognizes Georgian field labels and import direction', () => {
  const fields = extractDeclaration(`
    გრაფა A: C-556677
    თარიღი: 2026-10-12
    IM: "ტანსაცმლის იმპორტი"
    გრაფა 4: დეკლარანტი
    გრაფა 15: თურქეთი
    გრაფა 31: ტექსტილი
    გრაფა 33: 6203420000
    გრაფა 35: 1250,5
    გრაფა 49: თბილისის საწყობი
  `)

  assert.equal(fields.declarationNumber, 'C-556677')
  assert.equal(fields.importer, 'ტანსაცმლის იმპორტი')
  assert.equal(fields.dispatchCountry, 'თურქეთი')
  assert.equal(fields.grossKg, 1250.5)
})

test('returns empty fields when PDF has no extractable text', () => {
  const fields = extractDeclaration('')
  assert.equal(fields.declarationNumber, '')
  assert.equal(fields.grossKg, '')
})

test('extracts customs form values from the sample PDF layout', () => {
  const fields = extractDeclaration(
    `
      C 2902 10/10/2026
      EX:"Sample Exporter"
      IM: "Sample Importer"
    `,
    [
      { text: '14 დეკლარანტი/წარმომადგენელი', x: 77, y: 653 },
      { text: '000000001', x: 200, y: 652 },
      { text: 'კომპანია შპს', x: 77, y: 642 },
      { text: 'მისამართი', x: 77, y: 632 },
      { text: '15 გამომგზავნი ქვეყანა', x: 318, y: 655 },
      { text: 'საქართველო / GEORGIA', x: 318, y: 643 },
      { text: '31 საქონლის', x: 28, y: 506 },
      { text: 'აღწერა', x: 28, y: 499 },
      { text: 'საქონლის დასახელება (დეტალი 1)', x: 77, y: 431 },
      { text: '(დამატებითი აღწერა)', x: 77, y: 421 },
      { text: '33 საქონლის კოდი', x: 379, y: 506 },
      { text: '12345678', x: 380, y: 494 },
      { text: '35 ბრუტო (კგ)', x: 440, y: 482 },
      { text: '2,273,898.00', x: 476, y: 469 },
      { text: '49 საწყობის დასახელება', x: 440, y: 333 },
      { text: 'WHS000001', x: 466, y: 319 },
    ],
  )

  assert.deepEqual(fields, {
    declarationNumber: 'C2902',
    declarationDate: '10/10/2026',
    exporter: 'Sample Exporter',
    importer: 'Sample Importer',
    declarant: 'კომპანია შპს',
    dispatchCountry: 'საქართველო',
    goodsDescription: 'საქონლის დასახელება',
    commodityCode: '12345678',
    grossKg: 2273898,
    warehouseName: 'WHS000001',
  })
})

const samplePdfPath = fileURLToPath(new URL('../2902.pdf', import.meta.url))

test('extracts all requested values from the provided 2902.pdf', {
  skip: !existsSync(samplePdfPath),
}, async () => {
  const buffer = await readFile(samplePdfPath)
  const items = []
  const parsed = await pdfParse(buffer, {
    pagerender: async (page) => {
      const content = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      })
      items.push(
        ...content.items
          .filter((item) => item.str?.trim())
          .map((item) => ({
            text: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
          })),
      )
      return content.items.map((item) => item.str).join(' ')
    },
  })

  assert.deepEqual(extractDeclaration(parsed.text.trim(), items), {
    declarationNumber: 'C2902',
    declarationDate: '10/10/2026',
    exporter: 'TENGISCHEVROIL',
    importer: 'TENGISCHEVROIL',
    declarant: 'შპს ომნი',
    dispatchCountry: 'ყაზახეთი',
    goodsDescription: 'ნედლი ნავთობი',
    commodityCode: '27090090',
    grossKg: 2273898,
    warehouseName: 'WHS245432544',
  })
})
