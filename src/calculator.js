const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100

export function calculateExcisePenalty({ quantityKg, customsValue, exciseRatePerTonne }) {
  if ([quantityKg, customsValue, exciseRatePerTonne].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('კალკულატორის მნიშვნელობები უნდა იყოს არაუარყოფითი რიცხვები.')
  }

  const exciseRatePerKg = exciseRatePerTonne / 1000
  const excise = roundMoney(quantityKg * exciseRatePerKg)
  const vat = roundMoney((customsValue + excise) * 0.18)

  return {
    exciseRatePerKg,
    excise,
    vat,
    penalty: roundMoney(excise + vat),
  }
}
