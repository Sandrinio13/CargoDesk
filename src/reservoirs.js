function readReservoirNumber(reservoir, snakeCaseKey, camelCaseKey) {
  const value = reservoir[snakeCaseKey] ?? reservoir[camelCaseKey]
  return typeof value === 'string' ? value.trim() : ''
}

function readReservoirAmount(reservoir, snakeCaseKey, camelCaseKey, fallback) {
  const value = reservoir[snakeCaseKey] ?? reservoir[camelCaseKey] ?? fallback
  const amount = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(amount)) {
    throw new Error('რეზერვუარის ტევადობის ან დატვირთვის მონაცემები არასწორია.')
  }
  return amount
}

export function normalizeReservoirRecord(reservoir) {
  if (!reservoir || typeof reservoir !== 'object' || Array.isArray(reservoir)) {
    throw new Error('რეზერვუარის მონაცემები არასწორია.')
  }

  const reservoirNumber = readReservoirNumber(reservoir, 'reservoir_number', 'reservoirNumber')
  const capacityKg = readReservoirAmount(
    reservoir,
    'capacity_kg',
    'capacityKg',
    reservoir.capacity_m3 ?? reservoir.capacityM3,
  )
  const currentWeightKg = readReservoirAmount(
    reservoir,
    'current_weight_kg',
    'currentWeightKg',
    reservoir.current_volume_m3 ?? reservoir.currentVolumeM3 ?? 0,
  )

  if (
    reservoir.id == null ||
    !reservoirNumber ||
    capacityKg <= 0 ||
    currentWeightKg < 0 ||
    currentWeightKg > capacityKg
  ) {
    throw new Error('რეზერვუარის მონაცემები არასრულია ან ტევადობის ფარგლებს სცდება.')
  }

  return {
    ...reservoir,
    id: String(reservoir.id),
    reservoir_number: reservoirNumber,
    capacity_kg: capacityKg,
    current_weight_kg: currentWeightKg,
  }
}

export function normalizeReservoirRecords(reservoirs) {
  if (!Array.isArray(reservoirs)) {
    throw new Error('რეზერვუარების სია არასწორია.')
  }
  return reservoirs.map(normalizeReservoirRecord)
}
