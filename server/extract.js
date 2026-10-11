const fieldPatterns = {
  declarationNumber: [
    /\bC\s*(\d{2,})\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(?:გრაფა\s*A|box\s*A|declaration\s*(?:no\.?|number)|c\s*(?:no\.?|№|number))\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]*)/i,
    /(?:^|\n)\s*A\s*[:#-]\s*([A-Z0-9][A-Z0-9./-]*)/im,
  ],
  declarationDate: [
    /\bC\s*\d{2,}\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(?:თარიღი|date)\s*[:#-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})/i,
  ],
  exporter: [
    /\bEX\s*:\s*["“]?([^"\r\n”]+)/i,
  ],
  importer: [
    /\bIM\s*:\s*["“]?([^"\r\n”]+)/i,
  ],
  declarant: [
    /(?:გრაფა\s*4|box\s*4|4\s+declarant|declarant)\s*[:#-]?\s*([^\r\n]+)/i,
  ],
  dispatchCountry: [
    /(?:გრაფა\s*15|box\s*15|15\s+country of dispatch(?:\s*\/\s*export)?|country of dispatch(?:\s*\/\s*export)?|15\s+country of export)\s*[:#-]?\s*([^\r\n]+)/i,
  ],
  goodsDescription: [
    /(?:გრაფა\s*31|box\s*31|31\s+(?:packages and description of goods|description of goods)|description of goods|საქონლის აღწერა)\s*[:#-]?\s*([^\r\n]+)/i,
  ],
  commodityCode: [
    /(?:გრაფა\s*33|box\s*33|33\s+commodity code|commodity code|საქონლის კოდი)\s*[:#-]?\s*([0-9][0-9 .-]{3,})/i,
  ],
  grossKg: [
    /(?:გრაფა\s*35|box\s*35|35\s+gross mass|gross (?:mass|weight)|ბრუტო(?:\s*კგ)?|gross)\s*(?:\([^)]*\))?\s*[:#-]?\s*([\d.,]+)/i,
  ],
  warehouseName: [
    /(?:გრაფა\s*49|box\s*49|49\s+(?:warehouse|identification of warehouse)|identification of warehouse|warehouse(?:\s+name)?|საწყობი|საწყობის დასახელება)\s*[:#-]?\s*([^\r\n]+)/i,
  ],
}

function cleanField(value) {
  return value.trim().replace(/\s{2,}/g, ' ').replace(/[;,.\s]+$/, '')
}

function cleanGoodsDescription(value) {
  return cleanField(value.split('(', 1)[0])
}

function cleanCountry(value) {
  return cleanField(value.split(/\s*\/\s*/, 1)[0])
}

function findField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return cleanField(match[1])
  }
  return ''
}

function findBoxLabel(items, pattern) {
  return items.find((item) => pattern.test(item.text))
}

function findBoxValue(items, label, { minX = label.x, maxX, minY = label.y - 22, maxY = label.y - 2, pattern } = {}) {
  return items.find((item) =>
    item.x >= minX &&
    (maxX === undefined || item.x < maxX) &&
    item.y >= minY &&
    item.y <= maxY &&
    (!pattern || pattern.test(item.text)),
  )
}

function extractBoxFields(items) {
  const result = {}
  if (!items.length) return result

  const declarantLabel = findBoxLabel(items, /14\s+დეკლარანტი/i)
  if (declarantLabel) {
    const company = findBoxValue(items, declarantLabel, {
      minX: 70,
      maxX: 318,
      minY: declarantLabel.y - 30,
      maxY: declarantLabel.y - 3,
      pattern: /[ა-ჰ]/,
    })
    if (company) result.declarant = cleanField(company.text)
  }

  const countryLabel = findBoxLabel(items, /15\s+გამომგზავნი ქვეყანა/i)
  if (countryLabel) {
    const country = findBoxValue(items, countryLabel, {
      maxX: countryLabel.x + 122,
      minY: countryLabel.y - 18,
      maxY: countryLabel.y - 4,
      pattern: /[ა-ჰA-Z]/i,
    })
    if (country) result.dispatchCountry = cleanCountry(country.text)
  }

  const goodsLabel = findBoxLabel(items, /31\s+საქონლის/i)
  if (goodsLabel) {
    const description = items
      .filter((item) =>
        item.x >= 28 &&
        item.x < 318 &&
        item.y >= goodsLabel.y - 90 &&
        item.y <= goodsLabel.y - 60 &&
        /[ა-ჰ]/.test(item.text) &&
        !/^(?:საქონლის|აღწერა|რაოდენობა|და)\b/.test(item.text),
      )
      .sort((a, b) => b.y - a.y || a.x - b.x)
    if (description.length) {
      const goodsName = description
        .map((item) => cleanGoodsDescription(item.text))
        .filter(Boolean)
        .join(' ')
      if (goodsName) result.goodsDescription = goodsName
    }
  }

  const commodityLabel = findBoxLabel(items, /33\s+საქონლის კოდი/i)
  if (commodityLabel) {
    const code = findBoxValue(items, commodityLabel, {
      maxX: 440,
      minY: commodityLabel.y - 20,
      pattern: /^\d[\d .-]{3,}$/,
    })
    if (code) result.commodityCode = code.text.replace(/[ .-]/g, '')
  }

  const grossLabel = findBoxLabel(items, /35\s+ბრუტო/i)
  if (grossLabel) {
    const gross = findBoxValue(items, grossLabel, {
      maxX: 522,
      minY: grossLabel.y - 22,
      pattern: /^[\d,.]+$/,
    })
    if (gross) result.grossKg = gross.text
  }

  const warehouseLabel = findBoxLabel(items, /49\s+საწყობის დასახელება/i)
  if (warehouseLabel) {
    const warehouse = findBoxValue(items, warehouseLabel, {
      minX: 440,
      minY: warehouseLabel.y - 28,
      pattern: /\S/,
    })
    if (warehouse && !/^\d+$/.test(warehouse.text)) result.warehouseName = cleanField(warehouse.text)
  }

  return result
}

export function extractDeclaration(text, items = []) {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ')
  const boxFields = extractBoxFields(items)
  const extractedNumber = findField(normalized, fieldPatterns.declarationNumber)
  const declarationNumber = /^\d+$/.test(extractedNumber) ? `C${extractedNumber}` : extractedNumber
  const declarationDate = findField(normalized, fieldPatterns.declarationDate)
  const grossText = findField(normalized, fieldPatterns.grossKg).replace(/\s/g, '')
  const grossKg = grossText
    ? Number(grossText.includes(',') && !grossText.includes('.') ? grossText.replace(',', '.') : grossText.replace(/,/g, ''))
    : ''

  return {
    declarationNumber,
    declarationDate,
    exporter: findField(normalized, fieldPatterns.exporter),
    importer: findField(normalized, fieldPatterns.importer),
    declarant: boxFields.declarant || findField(normalized, fieldPatterns.declarant),
    dispatchCountry: boxFields.dispatchCountry
      || cleanCountry(findField(normalized, fieldPatterns.dispatchCountry)),
    goodsDescription: boxFields.goodsDescription
      || cleanGoodsDescription(findField(normalized, fieldPatterns.goodsDescription)),
    commodityCode: boxFields.commodityCode || findField(normalized, fieldPatterns.commodityCode).replace(/[ .-]/g, ''),
    grossKg: boxFields.grossKg
      ? Number(boxFields.grossKg.replace(/,/g, ''))
      : Number.isFinite(grossKg) ? grossKg : '',
    warehouseName: boxFields.warehouseName || findField(normalized, fieldPatterns.warehouseName),
  }
}
