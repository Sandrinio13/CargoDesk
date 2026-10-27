export class ReservoirValidationError extends Error {}

export function normalizeReservoirMovement(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ReservoirValidationError('ოპერაციის მონაცემები არასწორია.')
  }

  const { direction, quantityKg } = body
  if (direction !== 'receive' && direction !== 'release') {
    throw new ReservoirValidationError('აირჩიეთ მიღების ან გაშვების ოპერაცია.')
  }
  if (
    typeof quantityKg !== 'number' ||
    !Number.isFinite(quantityKg) ||
    quantityKg <= 0 ||
    quantityKg > 99_999_999_999.999
  ) {
    throw new ReservoirValidationError('რაოდენობა უნდა იყოს 0-ზე მეტი და ვალიდური რიცხვი.')
  }

  return { direction, quantityKg }
}

export function normalizeReservoir(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ReservoirValidationError('რეზერვუარის მონაცემები არასწორია.')
  }

  const reservoirNumber = String(body.reservoirNumber ?? '').trim()
  const capacityKg = typeof body.capacityKg === 'number' ? body.capacityKg : Number.NaN
  const currentWeightKg = body.currentWeightKg == null
    ? 0
    : typeof body.currentWeightKg === 'number'
      ? body.currentWeightKg
      : Number.NaN

  if (!reservoirNumber || reservoirNumber.length > 60) {
    throw new ReservoirValidationError('რეზერვუარის ნომერი აუცილებელია და 60 სიმბოლოს არ უნდა აღემატებოდეს.')
  }
  if (!Number.isFinite(capacityKg) || capacityKg <= 0 || capacityKg > 99_999_999_999.999) {
    throw new ReservoirValidationError('ტევადობა უნდა იყოს 0-ზე მეტი და ვალიდური რიცხვი.')
  }
  if (
    !Number.isFinite(currentWeightKg) ||
    currentWeightKg < 0 ||
    currentWeightKg > capacityKg
  ) {
    throw new ReservoirValidationError('დატვირთვა უნდა იყოს 0-სა და რეზერვუარის ტევადობას შორის.')
  }

  return { reservoirNumber, capacityKg, currentWeightKg }
}
