import 'dotenv/config'
import { createRequire } from 'node:module'
import { neon } from '@neondatabase/serverless'
import express from 'express'
import multer from 'multer'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractDeclaration } from './extract.js'
import {
  normalizeReservoir,
  normalizeReservoirMovement,
  ReservoirValidationError,
} from './reservoirs.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
const app = express()
const port = Number(process.env.PORT) || 3001
const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
})

let databaseReady = false
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

app.use(express.json({ limit: '1mb' }))

async function ensureDatabase() {
  if (!sql) return
  await sql`
    CREATE TABLE IF NOT EXISTS declarations (
      id BIGSERIAL PRIMARY KEY,
      declaration_number TEXT NOT NULL DEFAULT '',
      declaration_date TEXT NOT NULL DEFAULT '',
      exporter TEXT NOT NULL DEFAULT '',
      importer TEXT NOT NULL DEFAULT '',
      declarant TEXT NOT NULL DEFAULT '',
      dispatch_country TEXT NOT NULL DEFAULT '',
      goods_description TEXT NOT NULL DEFAULT '',
      commodity_code TEXT NOT NULL DEFAULT '',
      gross_kg NUMERIC(14, 3),
      warehouse_name TEXT NOT NULL DEFAULT '',
      source_filename TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    ALTER TABLE declarations
    ADD COLUMN IF NOT EXISTS exporter TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS importer TEXT NOT NULL DEFAULT ''
  `
  await sql`
    CREATE TABLE IF NOT EXISTS reservoirs (
      id BIGSERIAL PRIMARY KEY,
      reservoir_number TEXT NOT NULL UNIQUE,
      capacity_kg NUMERIC(14, 3) NOT NULL CHECK (capacity_kg > 0),
      current_weight_kg NUMERIC(14, 3) NOT NULL DEFAULT 0
        CHECK (current_weight_kg >= 0 AND current_weight_kg <= capacity_kg),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'reservoirs'
          AND column_name = 'capacity_m3'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'reservoirs'
          AND column_name = 'capacity_kg'
      ) THEN
        ALTER TABLE reservoirs RENAME COLUMN capacity_m3 TO capacity_kg;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'reservoirs'
          AND column_name = 'current_volume_m3'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'reservoirs'
          AND column_name = 'current_weight_kg'
      ) THEN
        ALTER TABLE reservoirs RENAME COLUMN current_volume_m3 TO current_weight_kg;
      END IF;
    END;
    $$
  `
  databaseReady = true
}

function requireDatabase(_request, response, next) {
  if (!sql || !databaseReady) {
    return response.status(503).json({
      error: sql
        ? 'Neon მონაცემთა ბაზასთან კავშირი ვერ ხერხდება. გადაამოწმეთ ქსელი და სერვერის ლოგი.'
        : 'Neon მონაცემთა ბაზა არ არის კონფიგურირებული. დაამატეთ DATABASE_URL .env ფაილში.',
    })
  }
  next()
}

const declarationFields = [
  'declarationNumber',
  'declarationDate',
  'exporter',
  'importer',
  'declarant',
  'dispatchCountry',
  'goodsDescription',
  'commodityCode',
  'warehouseName',
]

function normalizeDeclaration(body) {
  const declaration = Object.fromEntries(
    declarationFields.map((field) => [field, String(body[field] ?? '').trim()]),
  )

  const grossKg = body.grossKg === '' || body.grossKg == null ? null : Number(body.grossKg)
  if (grossKg !== null && (!Number.isFinite(grossKg) || grossKg < 0)) {
    throw new Error('ბრუტო წონა უნდა იყოს ნულზე მეტი ან ტოლი რიცხვი.')
  }

  declaration.grossKg = grossKg
  declaration.sourceFilename = String(body.sourceFilename ?? '').trim().slice(0, 255)
  return declaration
}

app.get('/api/health', (_request, response) => {
  response.json({ databaseConfigured: Boolean(sql), databaseReady })
})

app.get('/api/reservoirs', requireDatabase, async (_request, response, next) => {
  try {
    const rows = await sql`
      SELECT id, reservoir_number, capacity_kg, current_weight_kg, created_at
      FROM reservoirs
      ORDER BY created_at, id
    `
    response.json(rows)
  } catch (error) {
    next(error)
  }
})

app.post('/api/reservoirs', requireDatabase, async (request, response, next) => {
  try {
    const reservoir = normalizeReservoir(request.body)
    const rows = await sql`
      INSERT INTO reservoirs (reservoir_number, capacity_kg, current_weight_kg)
      VALUES (
        ${reservoir.reservoirNumber},
        ${reservoir.capacityKg},
        ${reservoir.currentWeightKg}
      )
      RETURNING id, reservoir_number, capacity_kg, current_weight_kg, created_at
    `
    response.status(201).json(rows[0])
  } catch (error) {
    if (error instanceof ReservoirValidationError) {
      return response.status(400).json({ error: error.message })
    }
    if (error.code === '23505') {
      return response.status(409).json({ error: 'ამ ნომრით რეზერვუარი უკვე არსებობს.' })
    }
    next(error)
  }
})

app.delete('/api/reservoirs/:id', requireDatabase, async (request, response, next) => {
  try {
    if (!/^\d+$/.test(request.params.id)) {
      return response.status(400).json({ error: 'რეზერვუარის ნომერი არასწორია.' })
    }

    const rows = await sql`
      DELETE FROM reservoirs
      WHERE id = ${request.params.id}
      RETURNING id
    `
    if (!rows.length) {
      return response.status(404).json({ error: 'რეზერვუარი ვერ მოიძებნა.' })
    }

    response.json({ id: rows[0].id })
  } catch (error) {
    next(error)
  }
})

app.post('/api/reservoirs/:id/transactions', requireDatabase, async (request, response, next) => {
  try {
    if (!/^\d+$/.test(request.params.id)) {
      return response.status(400).json({ error: 'რეზერვუარის ნომერი არასწორია.' })
    }
    const movement = normalizeReservoirMovement(request.body)
    const isReceiving = movement.direction === 'receive'
    const changeKg = isReceiving ? movement.quantityKg : -movement.quantityKg

    const rows = await sql`
      UPDATE reservoirs
      SET current_weight_kg = current_weight_kg + ${changeKg}
      WHERE id = ${request.params.id}
        AND (${isReceiving} = FALSE OR current_weight_kg + ${movement.quantityKg} <= capacity_kg)
        AND (${isReceiving} = TRUE OR current_weight_kg >= ${movement.quantityKg})
      RETURNING id, reservoir_number, capacity_kg, current_weight_kg, created_at
    `
    if (!rows.length) {
      const existing = await sql`
        SELECT id, capacity_kg, current_weight_kg
        FROM reservoirs
        WHERE id = ${request.params.id}
      `
      if (!existing.length) {
        return response.status(404).json({ error: 'რეზერვუარი ვერ მოიძებნა.' })
      }
      const error = isReceiving
        ? 'მიღების რაოდენობა რეზერვუარში დარჩენილ ტევადობას აღემატება.'
        : 'გასაშვები რაოდენობა რეზერვუარში არსებულ მარაგს აღემატება.'
      return response.status(409).json({ error })
    }

    response.json(rows[0])
  } catch (error) {
    if (error instanceof ReservoirValidationError) {
      return response.status(400).json({ error: error.message })
    }
    next(error)
  }
})

app.post('/api/declarations/parse', upload.single('file'), async (request, response, next) => {
  try {
    const file = request.file
    if (!file) return response.status(400).json({ error: 'ასატვირთი PDF ფაილი ვერ მოიძებნა.' })
    if (file.size < 5 || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      return response.status(400).json({ error: 'ატვირთული ფაილი ვალიდური PDF არ არის.' })
    }

    const items = []
    const parsed = await pdfParse(file.buffer, {
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
    const text = parsed.text.trim()
    response.json({
      fields: extractDeclaration(text, items),
      sourceFilename: file.originalname,
      hasText: Boolean(text),
      pageCount: parsed.numpages,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/declarations', requireDatabase, async (_request, response, next) => {
  try {
    const rows = await sql`
      SELECT id, declaration_number, declaration_date, declarant,
             exporter, importer, dispatch_country, goods_description, commodity_code, gross_kg,
             warehouse_name, source_filename, created_at
      FROM declarations
      ORDER BY created_at DESC
      LIMIT 500
    `
    response.json(rows)
  } catch (error) {
    next(error)
  }
})

app.post('/api/declarations', requireDatabase, async (request, response, next) => {
  try {
    const declaration = normalizeDeclaration(request.body)
    const rows = await sql`
      INSERT INTO declarations (
        declaration_number, declaration_date, exporter, importer,
        declarant, dispatch_country, goods_description, commodity_code, gross_kg,
        warehouse_name, source_filename
      ) VALUES (
        ${declaration.declarationNumber},
        ${declaration.declarationDate},
        ${declaration.exporter},
        ${declaration.importer},
        ${declaration.declarant},
        ${declaration.dispatchCountry},
        ${declaration.goodsDescription},
        ${declaration.commodityCode},
        ${declaration.grossKg},
        ${declaration.warehouseName},
        ${declaration.sourceFilename}
      )
      RETURNING id, declaration_number, declaration_date, declarant,
                exporter, importer, dispatch_country, goods_description, commodity_code, gross_kg,
                warehouse_name, source_filename, created_at
    `
    response.status(201).json(rows[0])
  } catch (error) {
    if (error.message?.startsWith('ბრუტო')) {
      return response.status(400).json({ error: error.message })
    }
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'PDF ფაილის მაქსიმალური ზომაა 20 მბ.'
      : 'ატვირთეთ მხოლოდ ერთი PDF ფაილი.'
    return response.status(400).json({ error: message })
  }
  console.error('API შეცდომა:', error)
  response.status(500).json({ error: 'სერვერზე შეცდომაა. სცადეთ ხელახლა.' })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(rootDirectory, 'dist')))
  app.use((request, response, next) => {
    if (request.method === 'GET') return response.sendFile(join(rootDirectory, 'dist', 'index.html'))
    next()
  })
}

try {
  await ensureDatabase()
} catch (error) {
  console.error('Neon მონაცემთა ბაზასთან დაკავშირება ვერ მოხერხდა; PDF-ის ამოღება ხელმისაწვდომია, ბაზის API კი გამორთულია:', error)
}

app.listen(port, () => {
  console.log(`CargoDesk API მუშაობს: http://localhost:${port}`)
  if (!sql) console.warn('DATABASE_URL არ არის მითითებული — PDF-ის ამოღება ხელმისაწვდომია, ბაზის API კი გამორთულია.')
})
