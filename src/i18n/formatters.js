/**
 * FlyAndEarn - Localization Formatting Utilities
 *
 * Uses Intl.* APIs for locale-aware formatting of:
 * - Currency
 * - Dates and times
 * - Numbers
 * - Distances (km/mi)
 * - Addresses
 *
 * All functions ensure server/client parity.
 */

// ==========================================
// LOCALE CONFIGURATION
// ==========================================

const LOCALE_SETTINGS = {
  'en-GB': {
    currency: 'GBP',
    distanceUnit: 'mi',
    timeFormat: '24h',
    addressOrder: ['street', 'city', 'postalCode', 'country'],
  },
  'en-US': {
    currency: 'USD',
    distanceUnit: 'mi',
    timeFormat: '12h',
    addressOrder: ['street', 'city', 'state', 'postalCode', 'country'],
  },
  'fr-FR': {
    currency: 'EUR',
    distanceUnit: 'km',
    timeFormat: '24h',
    addressOrder: ['street', 'postalCode', 'city', 'country'],
  },
  'fr-CH': {
    currency: 'CHF',
    distanceUnit: 'km',
    timeFormat: '24h',
    addressOrder: ['street', 'postalCode', 'city', 'country'],
  },
  'pl-PL': {
    currency: 'PLN',
    distanceUnit: 'km',
    timeFormat: '24h',
    addressOrder: ['street', 'postalCode', 'city', 'country'],
  },
  'de-DE': {
    currency: 'EUR',
    distanceUnit: 'km',
    timeFormat: '24h',
    addressOrder: ['street', 'postalCode', 'city', 'country'],
  },
  'de-CH': {
    currency: 'CHF',
    distanceUnit: 'km',
    timeFormat: '24h',
    addressOrder: ['street', 'postalCode', 'city', 'country'],
  },
  'de-AT': {
    currency: 'EUR',
    distanceUnit: 'km',
    timeFormat: '24h',
    addressOrder: ['street', 'postalCode', 'city', 'country'],
  },
};

// Miles to km conversion factor
const KM_TO_MI = 0.621371;

// ==========================================
// CURRENCY FORMATTING
// ==========================================

/**
 * Format a currency amount according to locale conventions
 *
 * @param {number} amount - The amount to format
 * @param {string} currency - ISO 4217 currency code (EUR, PLN, GBP, USD, CHF)
 * @param {string} locale - BCP 47 locale string (e.g., 'pl-PL')
 * @param {Object} options - Additional Intl.NumberFormat options
 * @returns {string} Formatted currency string
 *
 * @example
 * formatCurrency(1234.50, 'EUR', 'de-DE') // "1.234,50 €"
 * formatCurrency(1234.50, 'PLN', 'pl-PL') // "1 234,50 zł"
 * formatCurrency(1234.50, 'GBP', 'en-GB') // "£1,234.50"
 */
export function formatCurrency(amount, currency, locale = 'en-GB', options = {}) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || LOCALE_SETTINGS[locale]?.currency || 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    });

    return formatter.format(amount);
  } catch (e) {
    console.warn(`Currency formatting error for ${currency}/${locale}:`, e);
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format currency with compact notation for large amounts
 *
 * @param {number} amount
 * @param {string} currency
 * @param {string} locale
 * @returns {string}
 *
 * @example
 * formatCurrencyCompact(1234567, 'EUR', 'de-DE') // "1,23 Mio. €"
 */
export function formatCurrencyCompact(amount, currency, locale = 'en-GB') {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'EUR',
      notation: 'compact',
      compactDisplay: 'short',
    });

    return formatter.format(amount);
  } catch (e) {
    return formatCurrency(amount, currency, locale);
  }
}

// ==========================================
// DATE & TIME FORMATTING
// ==========================================

/**
 * Format a date according to locale conventions
 *
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - BCP 47 locale string
 * @param {string} style - 'short', 'medium', 'long', 'full'
 * @returns {string}
 *
 * @example
 * formatDate(new Date(), 'en-GB', 'short')  // "23/01/2025"
 * formatDate(new Date(), 'en-US', 'short')  // "1/23/2025"
 * formatDate(new Date(), 'de-DE', 'long')   // "23. Januar 2025"
 */
export function formatDate(date, locale = 'en-GB', style = 'medium') {
  if (!date) return '—';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '—';
  }

  const styleOptions = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  };

  try {
    const formatter = new Intl.DateTimeFormat(locale, styleOptions[style] || styleOptions.medium);
    return formatter.format(dateObj);
  } catch (e) {
    console.warn(`Date formatting error for ${locale}:`, e);
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format a time according to locale conventions
 *
 * @param {Date|string|number} date - Date/time to format
 * @param {string} locale - BCP 47 locale string
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string}
 *
 * @example
 * formatTime(new Date(), 'en-US') // "2:30 PM"
 * formatTime(new Date(), 'de-DE') // "14:30"
 */
export function formatTime(date, locale = 'en-GB', includeSeconds = false) {
  if (!date) return '—';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '—';
  }

  const settings = LOCALE_SETTINGS[locale] || LOCALE_SETTINGS['en-GB'];

  const options = {
    hour: 'numeric',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' }),
    hour12: settings.timeFormat === '12h',
  };

  try {
    const formatter = new Intl.DateTimeFormat(locale, options);
    return formatter.format(dateObj);
  } catch (e) {
    return dateObj.toLocaleTimeString();
  }
}

/**
 * Format a date and time together
 *
 * @param {Date|string|number} date
 * @param {string} locale
 * @param {Object} options
 * @returns {string}
 */
export function formatDateTime(date, locale = 'en-GB', options = {}) {
  if (!date) return '—';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '—';
  }

  const settings = LOCALE_SETTINGS[locale] || LOCALE_SETTINGS['en-GB'];
  const { dateStyle = 'medium', timeStyle = 'short' } = options;

  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      dateStyle,
      timeStyle,
      hour12: settings.timeFormat === '12h',
    });
    return formatter.format(dateObj);
  } catch (e) {
    return `${formatDate(dateObj, locale)} ${formatTime(dateObj, locale)}`;
  }
}

/**
 * Format a relative time (e.g., "2 days ago", "in 3 hours")
 *
 * @param {Date|string|number} date
 * @param {string} locale
 * @returns {string}
 */
export function formatRelativeTime(date, locale = 'en-GB') {
  if (!date) return '—';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '—';
  }

  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);
  const diffWeeks = Math.round(diffDays / 7);
  const diffMonths = Math.round(diffDays / 30);
  const diffYears = Math.round(diffDays / 365);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (Math.abs(diffSecs) < 60) {
      return rtf.format(diffSecs, 'second');
    } else if (Math.abs(diffMins) < 60) {
      return rtf.format(diffMins, 'minute');
    } else if (Math.abs(diffHours) < 24) {
      return rtf.format(diffHours, 'hour');
    } else if (Math.abs(diffDays) < 7) {
      return rtf.format(diffDays, 'day');
    } else if (Math.abs(diffWeeks) < 4) {
      return rtf.format(diffWeeks, 'week');
    } else if (Math.abs(diffMonths) < 12) {
      return rtf.format(diffMonths, 'month');
    } else {
      return rtf.format(diffYears, 'year');
    }
  } catch (e) {
    return formatDate(dateObj, locale);
  }
}

// ==========================================
// NUMBER FORMATTING
// ==========================================

/**
 * Format a number according to locale conventions
 *
 * @param {number} number
 * @param {string} locale
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string}
 *
 * @example
 * formatNumber(1234567.89, 'de-DE') // "1.234.567,89"
 * formatNumber(1234567.89, 'en-US') // "1,234,567.89"
 */
export function formatNumber(number, locale = 'en-GB', options = {}) {
  if (number === null || number === undefined || isNaN(number)) {
    return '—';
  }

  try {
    const formatter = new Intl.NumberFormat(locale, options);
    return formatter.format(number);
  } catch (e) {
    return number.toString();
  }
}

/**
 * Format a percentage
 *
 * @param {number} value - Value as decimal (0.15 = 15%)
 * @param {string} locale
 * @param {number} decimals
 * @returns {string}
 */
export function formatPercent(value, locale = 'en-GB', decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return formatter.format(value);
  } catch (e) {
    return `${(value * 100).toFixed(decimals)}%`;
  }
}

/**
 * Format number with compact notation
 *
 * @param {number} number
 * @param {string} locale
 * @returns {string}
 *
 * @example
 * formatNumberCompact(1234567, 'en-GB') // "1.2M"
 */
export function formatNumberCompact(number, locale = 'en-GB') {
  if (number === null || number === undefined || isNaN(number)) {
    return '—';
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
    });
    return formatter.format(number);
  } catch (e) {
    return number.toString();
  }
}

// ==========================================
// DISTANCE FORMATTING
// ==========================================

/**
 * Format a distance with locale-appropriate unit (km or mi)
 *
 * @param {number} km - Distance in kilometers
 * @param {string} locale
 * @returns {string}
 *
 * @example
 * formatDistance(100, 'en-GB') // "62 mi"
 * formatDistance(100, 'de-DE') // "100 km"
 */
export function formatDistance(km, locale = 'en-GB') {
  if (km === null || km === undefined || isNaN(km)) {
    return '—';
  }

  const settings = LOCALE_SETTINGS[locale] || LOCALE_SETTINGS['en-GB'];
  const useMiles = settings.distanceUnit === 'mi';

  let value = km;
  let unit = 'km';

  if (useMiles) {
    value = km * KM_TO_MI;
    unit = 'mi';
  }

  // Format with appropriate precision
  const precision = value < 10 ? 1 : 0;
  const formattedValue = formatNumber(value, locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  return `${formattedValue} ${unit}`;
}

// ==========================================
// ADDRESS FORMATTING
// ==========================================

/**
 * Format an address according to country conventions
 *
 * @param {Object} address
 * @param {string} address.street
 * @param {string} address.city
 * @param {string} address.state - State/province (mainly US)
 * @param {string} address.postalCode
 * @param {string} address.country
 * @param {string} countryCode - ISO country code for formatting rules
 * @returns {string}
 *
 * @example
 * // US format
 * formatAddress({ street: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001' }, 'US')
 * // "123 Main St, New York, NY 10001"
 *
 * // German format
 * formatAddress({ street: 'Hauptstraße 1', postalCode: '10115', city: 'Berlin' }, 'DE')
 * // "Hauptstraße 1, 10115 Berlin"
 */
export function formatAddress(address, countryCode = 'GB') {
  if (!address) return '—';

  const { street, city, state, postalCode, country } = address;

  // Country-specific formatting
  switch (countryCode.toUpperCase()) {
    case 'US':
      // US: Street, City, State ZIP
      const usParts = [street, city];
      if (state && postalCode) {
        usParts.push(`${state} ${postalCode}`);
      } else if (state) {
        usParts.push(state);
      } else if (postalCode) {
        usParts.push(postalCode);
      }
      if (country) usParts.push(country);
      return usParts.filter(Boolean).join(', ');

    case 'DE':
    case 'AT':
    case 'CH':
    case 'PL':
      // European: Street, PostalCode City
      const euParts = [street];
      if (postalCode && city) {
        euParts.push(`${postalCode} ${city}`);
      } else if (city) {
        euParts.push(city);
      }
      if (country) euParts.push(country);
      return euParts.filter(Boolean).join(', ');

    case 'GB':
    case 'FR':
    default:
      // UK/French: Street, City, PostalCode
      const parts = [street, city, postalCode, country];
      return parts.filter(Boolean).join(', ');
  }
}

/**
 * Format a postal/ZIP code according to country conventions
 *
 * @param {string} code
 * @param {string} countryCode
 * @returns {string}
 */
export function formatPostalCode(code, countryCode = 'GB') {
  if (!code) return '';

  const cleaned = code.replace(/\s+/g, '').toUpperCase();

  switch (countryCode.toUpperCase()) {
    case 'GB':
      // UK: SW1A 1AA format
      if (cleaned.length > 3) {
        return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
      }
      return cleaned;

    case 'PL':
      // Poland: XX-XXX format
      if (cleaned.length === 5 && !cleaned.includes('-')) {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
      }
      return cleaned;

    case 'US':
      // US: XXXXX or XXXXX-XXXX
      if (cleaned.length === 9 && !cleaned.includes('-')) {
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
      }
      return cleaned;

    default:
      return code;
  }
}

// ==========================================
// PHONE NUMBER FORMATTING
// ==========================================

/**
 * Format a phone number according to country conventions
 *
 * @param {string} phone
 * @param {string} countryCode
 * @returns {string}
 */
export function formatPhone(phone, countryCode = 'GB') {
  if (!phone) return '';

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Country prefixes
  const prefixes = {
    GB: '+44',
    US: '+1',
    FR: '+33',
    DE: '+49',
    PL: '+48',
    CH: '+41',
    AT: '+43',
  };

  // If no prefix, add country prefix
  if (!cleaned.startsWith('+')) {
    return `${prefixes[countryCode] || ''} ${cleaned}`;
  }

  return cleaned;
}

// ==========================================
// UNIT CONVERSION HELPERS
// ==========================================

/**
 * Convert kilometers to miles
 * @param {number} km
 * @returns {number}
 */
export function kmToMiles(km) {
  return km * KM_TO_MI;
}

/**
 * Convert miles to kilometers
 * @param {number} mi
 * @returns {number}
 */
export function milesToKm(mi) {
  return mi / KM_TO_MI;
}

/**
 * Convert kilograms to pounds
 * @param {number} kg
 * @returns {number}
 */
export function kgToLbs(kg) {
  return kg * 2.20462;
}

/**
 * Convert pounds to kilograms
 * @param {number} lbs
 * @returns {number}
 */
export function lbsToKg(lbs) {
  return lbs / 2.20462;
}
