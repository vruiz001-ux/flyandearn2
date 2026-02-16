/**
 * FlyAndEarn - Currencies Data (Lazy Loaded)
 */

export const CURRENCIES = {
  EUR: { symbol: '\u20AC', code: 'EUR', name: 'Euro', decimals: 2, position: 'before' },
  USD: { symbol: '$', code: 'USD', name: 'US Dollar', decimals: 2, position: 'before' },
  GBP: { symbol: '\u00A3', code: 'GBP', name: 'British Pound', decimals: 2, position: 'before' },
  PLN: { symbol: 'z\u0142', code: 'PLN', name: 'Polish Zloty', decimals: 2, position: 'after' },
  CHF: { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc', decimals: 2, position: 'before' },
  JPY: { symbol: '\u00A5', code: 'JPY', name: 'Japanese Yen', decimals: 0, position: 'before' },
  AED: { symbol: 'AED', code: 'AED', name: 'UAE Dirham', decimals: 2, position: 'before' },
  SAR: { symbol: 'SAR', code: 'SAR', name: 'Saudi Riyal', decimals: 2, position: 'before' },
  QAR: { symbol: 'QAR', code: 'QAR', name: 'Qatari Riyal', decimals: 2, position: 'before' },
  PHP: { symbol: '\u20B1', code: 'PHP', name: 'Philippine Peso', decimals: 2, position: 'before' },
  SGD: { symbol: 'S$', code: 'SGD', name: 'Singapore Dollar', decimals: 2, position: 'before' },
  THB: { symbol: '\u0E3F', code: 'THB', name: 'Thai Baht', decimals: 2, position: 'before' },
  MYR: { symbol: 'RM', code: 'MYR', name: 'Malaysian Ringgit', decimals: 2, position: 'before' },
  INR: { symbol: '\u20B9', code: 'INR', name: 'Indian Rupee', decimals: 2, position: 'before' },
  AUD: { symbol: 'A$', code: 'AUD', name: 'Australian Dollar', decimals: 2, position: 'before' },
  CAD: { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar', decimals: 2, position: 'before' },
  ZAR: { symbol: 'R', code: 'ZAR', name: 'South African Rand', decimals: 2, position: 'before' },
};

export const COUNTRY_CURRENCY = {
  Austria: 'EUR', Belgium: 'EUR', Finland: 'EUR', France: 'EUR', Germany: 'EUR',
  Greece: 'EUR', Ireland: 'EUR', Italy: 'EUR', Netherlands: 'EUR', Portugal: 'EUR',
  Spain: 'EUR', Poland: 'PLN', UK: 'GBP', 'United Kingdom': 'GBP',
  Switzerland: 'CHF', Japan: 'JPY', USA: 'USD', 'United States': 'USD',
  UAE: 'AED', 'Saudi Arabia': 'SAR', Qatar: 'QAR', Philippines: 'PHP',
  Singapore: 'SGD', Thailand: 'THB', Malaysia: 'MYR', India: 'INR',
  Australia: 'AUD', Canada: 'CAD', 'South Africa': 'ZAR',
};

export function getCurrencyForCountry(country) {
  if (!country) return CURRENCIES.EUR;
  const code = COUNTRY_CURRENCY[country] || 'EUR';
  return CURRENCIES[code] || CURRENCIES.EUR;
}

export function getCurrencyCodeForCountry(country) {
  if (!country) return 'EUR';
  return COUNTRY_CURRENCY[country] || 'EUR';
}

export function formatCurrencyAmount(amount, countryOrCode) {
  let currency;
  if (CURRENCIES[countryOrCode]) {
    currency = CURRENCIES[countryOrCode];
  } else {
    currency = getCurrencyForCountry(countryOrCode);
  }

  const num = parseFloat(amount);
  if (isNaN(num)) return currency.symbol + '0';

  const formatted = num.toFixed(currency.decimals);
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formattedNum = parts.join('.');

  if (currency.position === 'after') {
    return formattedNum + ' ' + currency.symbol;
  }
  return currency.symbol + formattedNum;
}

export function getCurrencySymbol(country) {
  const currency = getCurrencyForCountry(country);
  return currency.symbol;
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.CURRENCIES = CURRENCIES;
  window.COUNTRY_CURRENCY = COUNTRY_CURRENCY;
  window.getCurrencyForCountry = getCurrencyForCountry;
  window.getCurrencyCodeForCountry = getCurrencyCodeForCountry;
  window.formatCurrencyAmount = formatCurrencyAmount;
  window.getCurrencySymbol = getCurrencySymbol;
}
