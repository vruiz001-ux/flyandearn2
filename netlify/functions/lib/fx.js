import prisma from './prisma.js';

// Default rates used as fallback if database rates unavailable
const DEFAULT_RATES = {
  EUR_PLN: 4.32,
  PLN_EUR: 0.2315,
  EUR_EUR: 1,
  PLN_PLN: 1,
};

/**
 * Get the current exchange rate between two currencies
 * @param {string} fromCurrency - Source currency code (e.g., "EUR")
 * @param {string} toCurrency - Target currency code (e.g., "PLN")
 * @returns {Promise<{rate: number, source: string}>}
 */
export async function getFxRate(fromCurrency, toCurrency) {
  // Same currency = no conversion needed
  if (fromCurrency === toCurrency) {
    return { rate: 1, source: 'identity' };
  }

  const now = new Date();

  try {
    // Look for a valid rate in the database
    const fxRate = await prisma.fxRate.findFirst({
      where: {
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (fxRate) {
      return { rate: fxRate.rate, source: fxRate.source || 'database' };
    }

    // Try reverse lookup and calculate inverse
    const inverseRate = await prisma.fxRate.findFirst({
      where: {
        fromCurrency: toCurrency.toUpperCase(),
        toCurrency: fromCurrency.toUpperCase(),
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (inverseRate) {
      return {
        rate: 1 / inverseRate.rate,
        source: `${inverseRate.source || 'database'}_inverse`,
      };
    }
  } catch (error) {
    console.error('Error fetching FX rate from database:', error);
  }

  // Fall back to default rates
  const key = `${fromCurrency.toUpperCase()}_${toCurrency.toUpperCase()}`;
  if (DEFAULT_RATES[key]) {
    return { rate: DEFAULT_RATES[key], source: 'default' };
  }

  // Try inverse of default
  const inverseKey = `${toCurrency.toUpperCase()}_${fromCurrency.toUpperCase()}`;
  if (DEFAULT_RATES[inverseKey]) {
    return { rate: 1 / DEFAULT_RATES[inverseKey], source: 'default_inverse' };
  }

  // No rate available
  throw new Error(`No exchange rate available for ${fromCurrency} to ${toCurrency}`);
}

/**
 * Convert an amount from one currency to another
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {Promise<{convertedAmount: number, rate: number, source: string}>}
 */
export async function convertCurrency(amount, fromCurrency, toCurrency) {
  const { rate, source } = await getFxRate(fromCurrency, toCurrency);
  const convertedAmount = Math.round(amount * rate * 100) / 100; // Round to 2 decimals
  return { convertedAmount, rate, source };
}

/**
 * Set or update an FX rate in the database
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @param {number} rate
 * @param {string} source - Source of the rate (e.g., "ECB", "manual")
 * @param {Date} validUntil - Optional expiry date
 */
export async function setFxRate(fromCurrency, toCurrency, rate, source = 'manual', validUntil = null) {
  const now = new Date();

  // Expire any existing rates for this pair
  await prisma.fxRate.updateMany({
    where: {
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      validUntil: null,
    },
    data: {
      validUntil: now,
    },
  });

  // Create new rate
  return prisma.fxRate.create({
    data: {
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      rate,
      source,
      validFrom: now,
      validUntil,
    },
  });
}

/**
 * Get the appropriate currency for a user based on their country
 * @param {string} country - User's country
 * @returns {string} - Currency code
 */
export function getCurrencyForCountry(country) {
  if (!country) return 'EUR';
  const polishVariants = ['poland', 'polska', 'pl', 'pol'];
  return polishVariants.includes(country.toLowerCase()) ? 'PLN' : 'EUR';
}

/**
 * Format an amount for display with currency symbol
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatCurrency(amount, currency) {
  const symbols = {
    EUR: '\u20AC',
    PLN: 'z\u0142',
    USD: '$',
    GBP: '\u00A3',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toFixed(2)}`;
}
