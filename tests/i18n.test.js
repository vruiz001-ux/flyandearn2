/**
 * FlyAndEarn - i18n System Tests
 *
 * Tests for:
 * - Locale resolution
 * - Translation with interpolation
 * - Pluralization
 * - Currency/date/number formatting
 * - Glossary terms
 * - Server-side i18n
 */

import { jest } from '@jest/globals';

// ==========================================
// LOCALE RESOLUTION TESTS
// ==========================================

describe('Locale Resolution', () => {
  // Mock the module for testing
  const SUPPORTED_LOCALES = ['en-GB', 'en-US', 'fr-FR', 'pl-PL', 'de-DE', 'fr-CH', 'de-CH', 'de-AT'];
  const SUPPORTED_LANGUAGES = ['en', 'fr', 'pl', 'de'];
  const DEFAULT_LOCALE = 'en-GB';

  const LANGUAGE_COUNTRY_MAP = {
    en: 'GB',
    fr: 'FR',
    pl: 'PL',
    de: 'DE',
  };

  function parseLocale(locale) {
    if (!locale) return { language: 'en', country: null };
    const normalized = locale.replace('_', '-');
    const parts = normalized.split('-');
    const language = parts[0].toLowerCase();
    const country = parts[1] ? parts[1].toUpperCase() : null;
    return { language, country };
  }

  function buildLocale(language, country) {
    const lang = language.toLowerCase();
    const ctry = country ? country.toUpperCase() : LANGUAGE_COUNTRY_MAP[lang] || 'GB';
    return `${lang}-${ctry}`;
  }

  function resolveLocale({ userProfile, cookie, urlParam, acceptLanguage } = {}) {
    const sources = [userProfile, cookie, urlParam, acceptLanguage];

    for (const source of sources) {
      if (!source) continue;

      const { language, country } = parseLocale(source);

      if (!SUPPORTED_LANGUAGES.includes(language)) continue;

      const locale = buildLocale(language, country);

      if (SUPPORTED_LOCALES.includes(locale)) {
        return locale;
      }

      const fallbackLocale = buildLocale(language, LANGUAGE_COUNTRY_MAP[language]);
      if (SUPPORTED_LOCALES.includes(fallbackLocale)) {
        return fallbackLocale;
      }
    }

    return DEFAULT_LOCALE;
  }

  test('should return default locale when no input provided', () => {
    expect(resolveLocale({})).toBe('en-GB');
  });

  test('should use userProfile locale when valid', () => {
    expect(resolveLocale({ userProfile: 'fr-FR' })).toBe('fr-FR');
    expect(resolveLocale({ userProfile: 'pl-PL' })).toBe('pl-PL');
    expect(resolveLocale({ userProfile: 'de-DE' })).toBe('de-DE');
  });

  test('should prioritize userProfile over cookie', () => {
    expect(resolveLocale({
      userProfile: 'fr-FR',
      cookie: 'de-DE',
    })).toBe('fr-FR');
  });

  test('should fall back to cookie when userProfile not provided', () => {
    expect(resolveLocale({
      cookie: 'de-DE',
    })).toBe('de-DE');
  });

  test('should handle language-only input', () => {
    expect(resolveLocale({ urlParam: 'fr' })).toBe('fr-FR');
    expect(resolveLocale({ urlParam: 'de' })).toBe('de-DE');
    expect(resolveLocale({ urlParam: 'pl' })).toBe('pl-PL');
  });

  test('should handle Accept-Language header format', () => {
    expect(resolveLocale({ acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' })).toBe('fr-FR');
    expect(resolveLocale({ acceptLanguage: 'pl' })).toBe('pl-PL');
  });

  test('should handle country variants correctly', () => {
    expect(resolveLocale({ userProfile: 'fr-CH' })).toBe('fr-CH');
    expect(resolveLocale({ userProfile: 'de-AT' })).toBe('de-AT');
    expect(resolveLocale({ userProfile: 'de-CH' })).toBe('de-CH');
  });

  test('should fall back for unsupported country variant', () => {
    // fr-CA is not supported, should fall back to fr-FR
    expect(resolveLocale({ userProfile: 'fr-CA' })).toBe('fr-FR');
  });

  test('should handle underscore format (legacy)', () => {
    expect(resolveLocale({ userProfile: 'fr_FR' })).toBe('fr-FR');
    expect(resolveLocale({ userProfile: 'pl_PL' })).toBe('pl-PL');
  });

  test('should reject unsupported languages', () => {
    expect(resolveLocale({ userProfile: 'es-ES' })).toBe('en-GB');
    expect(resolveLocale({ userProfile: 'it-IT' })).toBe('en-GB');
    expect(resolveLocale({ userProfile: 'zh-CN' })).toBe('en-GB');
  });

  test('should handle case insensitivity', () => {
    expect(resolveLocale({ userProfile: 'FR-FR' })).toBe('fr-FR');
    expect(resolveLocale({ userProfile: 'En-Us' })).toBe('en-US');
  });
});

// ==========================================
// PLURALIZATION TESTS
// ==========================================

describe('Pluralization', () => {
  function getPluralForm(count, locale) {
    const language = locale.split('-')[0];

    // Polish has complex plural rules
    if (language === 'pl') {
      if (count === 0) return 'zero';
      if (count === 1) return 'one';
      const mod10 = count % 10;
      const mod100 = count % 100;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
      if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 12 && mod100 <= 14)) return 'many';
      return 'other';
    }

    // French: 0 and 1 are singular
    if (language === 'fr') {
      if (count === 0 || count === 1) return 'one';
      return 'other';
    }

    // English and German: standard singular/plural
    if (count === 0) return 'zero';
    if (count === 1) return 'one';
    return 'other';
  }

  describe('English pluralization', () => {
    test('should return "zero" for 0', () => {
      expect(getPluralForm(0, 'en-GB')).toBe('zero');
    });

    test('should return "one" for 1', () => {
      expect(getPluralForm(1, 'en-GB')).toBe('one');
    });

    test('should return "other" for 2+', () => {
      expect(getPluralForm(2, 'en-GB')).toBe('other');
      expect(getPluralForm(5, 'en-GB')).toBe('other');
      expect(getPluralForm(100, 'en-GB')).toBe('other');
    });
  });

  describe('Polish pluralization', () => {
    test('should return "zero" for 0', () => {
      expect(getPluralForm(0, 'pl-PL')).toBe('zero');
    });

    test('should return "one" for 1', () => {
      expect(getPluralForm(1, 'pl-PL')).toBe('one');
    });

    test('should return "few" for 2-4', () => {
      expect(getPluralForm(2, 'pl-PL')).toBe('few');
      expect(getPluralForm(3, 'pl-PL')).toBe('few');
      expect(getPluralForm(4, 'pl-PL')).toBe('few');
    });

    test('should return "many" for 5-21', () => {
      expect(getPluralForm(5, 'pl-PL')).toBe('many');
      expect(getPluralForm(10, 'pl-PL')).toBe('many');
      expect(getPluralForm(11, 'pl-PL')).toBe('many');
      expect(getPluralForm(12, 'pl-PL')).toBe('many');
      expect(getPluralForm(21, 'pl-PL')).toBe('many');
    });

    test('should return "few" for 22-24, 32-34, etc.', () => {
      expect(getPluralForm(22, 'pl-PL')).toBe('few');
      expect(getPluralForm(23, 'pl-PL')).toBe('few');
      expect(getPluralForm(24, 'pl-PL')).toBe('few');
      expect(getPluralForm(32, 'pl-PL')).toBe('few');
    });

    test('should return "many" for 25-31', () => {
      expect(getPluralForm(25, 'pl-PL')).toBe('many');
      expect(getPluralForm(30, 'pl-PL')).toBe('many');
    });
  });

  describe('French pluralization', () => {
    test('should return "one" for 0 (French treats 0 as singular)', () => {
      expect(getPluralForm(0, 'fr-FR')).toBe('one');
    });

    test('should return "one" for 1', () => {
      expect(getPluralForm(1, 'fr-FR')).toBe('one');
    });

    test('should return "other" for 2+', () => {
      expect(getPluralForm(2, 'fr-FR')).toBe('other');
      expect(getPluralForm(5, 'fr-FR')).toBe('other');
    });
  });
});

// ==========================================
// INTERPOLATION TESTS
// ==========================================

describe('Interpolation', () => {
  function interpolate(str, variables) {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (varName in variables) {
        return variables[varName];
      }
      return match;
    });
  }

  test('should replace single variable', () => {
    expect(interpolate('Hello, {{name}}!', { name: 'John' }))
      .toBe('Hello, John!');
  });

  test('should replace multiple variables', () => {
    expect(interpolate('{{greeting}}, {{name}}!', { greeting: 'Hello', name: 'John' }))
      .toBe('Hello, John!');
  });

  test('should handle missing variables gracefully', () => {
    expect(interpolate('Hello, {{name}}!', {}))
      .toBe('Hello, {{name}}!');
  });

  test('should handle count variable', () => {
    expect(interpolate('You have {{count}} items', { count: 5 }))
      .toBe('You have 5 items');
  });

  test('should preserve non-matching patterns', () => {
    expect(interpolate('Price: ${{price}} ({{currency}})', { price: 100 }))
      .toBe('Price: $100 ({{currency}})');
  });
});

// ==========================================
// FORMATTING TESTS
// ==========================================

describe('Currency Formatting', () => {
  function formatCurrency(amount, currency, locale = 'en-GB') {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '—';
    }

    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency || 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return formatter.format(amount);
    } catch (e) {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }

  test('should format EUR for German locale', () => {
    const result = formatCurrency(1234.50, 'EUR', 'de-DE');
    expect(result).toMatch(/1[.,]234[.,]50/); // Different locales use different separators
    expect(result).toMatch(/€/);
  });

  test('should format PLN for Polish locale', () => {
    const result = formatCurrency(1234.50, 'PLN', 'pl-PL');
    expect(result).toMatch(/1[\s\xa0]?234[.,]50/); // Polish uses space as thousand separator
    expect(result.toLowerCase()).toMatch(/zł|pln/i);
  });

  test('should format GBP for UK locale', () => {
    const result = formatCurrency(1234.50, 'GBP', 'en-GB');
    expect(result).toMatch(/£/);
    expect(result).toMatch(/1,234\.50/);
  });

  test('should format USD for US locale', () => {
    const result = formatCurrency(1234.50, 'USD', 'en-US');
    expect(result).toMatch(/\$/);
    expect(result).toMatch(/1,234\.50/);
  });

  test('should return dash for null/undefined/NaN', () => {
    expect(formatCurrency(null, 'EUR')).toBe('—');
    expect(formatCurrency(undefined, 'EUR')).toBe('—');
    expect(formatCurrency(NaN, 'EUR')).toBe('—');
  });
});

describe('Date Formatting', () => {
  function formatDate(date, locale = 'en-GB', style = 'medium') {
    if (!date) return '—';

    const dateObj = date instanceof Date ? date : new Date(date);

    if (isNaN(dateObj.getTime())) {
      return '—';
    }

    const styleOptions = {
      short: { year: 'numeric', month: 'numeric', day: 'numeric' },
      medium: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
    };

    try {
      const formatter = new Intl.DateTimeFormat(locale, styleOptions[style] || styleOptions.medium);
      return formatter.format(dateObj);
    } catch (e) {
      return dateObj.toLocaleDateString();
    }
  }

  const testDate = new Date('2025-01-23T12:00:00Z');

  test('should format date for UK locale (dd/mm/yyyy)', () => {
    const result = formatDate(testDate, 'en-GB', 'short');
    expect(result).toMatch(/23.*01.*2025|23.*1.*2025/);
  });

  test('should format date for US locale (mm/dd/yyyy)', () => {
    const result = formatDate(testDate, 'en-US', 'short');
    expect(result).toMatch(/1.*23.*2025/);
  });

  test('should format date for German locale', () => {
    const result = formatDate(testDate, 'de-DE', 'long');
    expect(result).toMatch(/23/);
    expect(result).toMatch(/2025/);
    expect(result.toLowerCase()).toMatch(/jan/);
  });

  test('should return dash for invalid date', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('invalid')).toBe('—');
  });
});

describe('Number Formatting', () => {
  function formatNumber(number, locale = 'en-GB', options = {}) {
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

  test('should format number with thousand separator for German', () => {
    const result = formatNumber(1234567.89, 'de-DE');
    expect(result).toMatch(/1[.]234[.]567[,]89/);
  });

  test('should format number for US locale', () => {
    const result = formatNumber(1234567.89, 'en-US');
    expect(result).toMatch(/1,234,567\.89/);
  });

  test('should return dash for null/undefined/NaN', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber(NaN)).toBe('—');
  });
});

// ==========================================
// DISTANCE FORMATTING TESTS
// ==========================================

describe('Distance Formatting', () => {
  const LOCALE_SETTINGS = {
    'en-GB': { distanceUnit: 'mi' },
    'en-US': { distanceUnit: 'mi' },
    'fr-FR': { distanceUnit: 'km' },
    'de-DE': { distanceUnit: 'km' },
    'pl-PL': { distanceUnit: 'km' },
  };

  const KM_TO_MI = 0.621371;

  function formatDistance(km, locale = 'en-GB') {
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

    const precision = value < 10 ? 1 : 0;
    const formattedValue = value.toFixed(precision);

    return `${formattedValue} ${unit}`;
  }

  test('should format in miles for UK locale', () => {
    const result = formatDistance(100, 'en-GB');
    expect(result).toMatch(/62.*mi/);
  });

  test('should format in miles for US locale', () => {
    const result = formatDistance(100, 'en-US');
    expect(result).toMatch(/62.*mi/);
  });

  test('should format in km for French locale', () => {
    const result = formatDistance(100, 'fr-FR');
    expect(result).toBe('100 km');
  });

  test('should format in km for German locale', () => {
    const result = formatDistance(100, 'de-DE');
    expect(result).toBe('100 km');
  });

  test('should show decimal for small distances', () => {
    const result = formatDistance(5, 'de-DE');
    expect(result).toBe('5.0 km');
  });
});

// ==========================================
// GLOSSARY TESTS
// ==========================================

describe('Glossary', () => {
  const GLOSSARY = {
    traveller: {
      translations: {
        'en-GB': 'Traveller',
        'en-US': 'Traveler',
        'fr-FR': 'Voyageur',
        'pl-PL': 'Podróżny',
        'de-DE': 'Reisender',
      },
    },
    postalCode: {
      translations: {
        'en-GB': 'Postcode',
        'en-US': 'ZIP code',
        'fr-FR': 'Code postal',
        'pl-PL': 'Kod pocztowy',
        'de-DE': 'Postleitzahl',
      },
    },
    statusCancelled: {
      translations: {
        'en-GB': 'Cancelled',
        'en-US': 'Canceled',
        'fr-FR': 'Annulé',
        'pl-PL': 'Anulowane',
        'de-DE': 'Storniert',
      },
    },
  };

  function getGlossaryTerm(term, locale = 'en-GB') {
    const entry = GLOSSARY[term];

    if (!entry) {
      return term;
    }

    // Try exact locale match
    if (entry.translations[locale]) {
      return entry.translations[locale];
    }

    // Try language-only fallback
    const language = locale.split('-')[0];
    const languageFallback = Object.keys(entry.translations).find(
      (loc) => loc.startsWith(language + '-')
    );

    if (languageFallback) {
      return entry.translations[languageFallback];
    }

    // Default to en-GB
    return entry.translations['en-GB'] || term;
  }

  test('should return correct term for UK English', () => {
    expect(getGlossaryTerm('traveller', 'en-GB')).toBe('Traveller');
    expect(getGlossaryTerm('postalCode', 'en-GB')).toBe('Postcode');
    expect(getGlossaryTerm('statusCancelled', 'en-GB')).toBe('Cancelled');
  });

  test('should return US variants for US English', () => {
    expect(getGlossaryTerm('traveller', 'en-US')).toBe('Traveler');
    expect(getGlossaryTerm('postalCode', 'en-US')).toBe('ZIP code');
    expect(getGlossaryTerm('statusCancelled', 'en-US')).toBe('Canceled');
  });

  test('should return correct term for French', () => {
    expect(getGlossaryTerm('traveller', 'fr-FR')).toBe('Voyageur');
    expect(getGlossaryTerm('postalCode', 'fr-FR')).toBe('Code postal');
  });

  test('should return correct term for Polish', () => {
    expect(getGlossaryTerm('traveller', 'pl-PL')).toBe('Podróżny');
    expect(getGlossaryTerm('postalCode', 'pl-PL')).toBe('Kod pocztowy');
  });

  test('should return correct term for German', () => {
    expect(getGlossaryTerm('traveller', 'de-DE')).toBe('Reisender');
    expect(getGlossaryTerm('postalCode', 'de-DE')).toBe('Postleitzahl');
  });

  test('should return key for unknown term', () => {
    expect(getGlossaryTerm('unknownTerm', 'en-GB')).toBe('unknownTerm');
  });
});

// ==========================================
// SERVER I18N TESTS
// ==========================================

describe('Server i18n - Locale from Request', () => {
  function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach((cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      if (name && rest.length > 0) {
        cookies[name] = rest.join('=');
      }
    });

    return cookies;
  }

  function resolveLocaleFromRequest(event, options = {}) {
    const { userLocale } = options;
    const headers = event.headers || {};
    const SUPPORTED_LANGUAGES = ['en', 'fr', 'pl', 'de'];
    const DEFAULT_LOCALE = 'en-GB';

    // 1. Check X-Locale header
    const headerLocale = headers['x-locale'] || headers['X-Locale'];
    if (headerLocale) {
      const lang = headerLocale.split('-')[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return headerLocale;
      }
    }

    // 2. Check user profile locale
    if (userLocale) {
      const lang = userLocale.split('-')[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return userLocale;
      }
    }

    // 3. Check cookie
    const cookies = parseCookies(headers.cookie);
    const cookieLocale = cookies.fae_locale;
    if (cookieLocale) {
      const lang = cookieLocale.split('-')[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return cookieLocale;
      }
    }

    return DEFAULT_LOCALE;
  }

  test('should use X-Locale header', () => {
    const event = {
      headers: { 'x-locale': 'fr-FR' },
    };
    expect(resolveLocaleFromRequest(event)).toBe('fr-FR');
  });

  test('should use user profile locale', () => {
    const event = { headers: {} };
    expect(resolveLocaleFromRequest(event, { userLocale: 'de-DE' })).toBe('de-DE');
  });

  test('should use cookie locale', () => {
    const event = {
      headers: { cookie: 'fae_locale=pl-PL; other=value' },
    };
    expect(resolveLocaleFromRequest(event)).toBe('pl-PL');
  });

  test('should prioritize X-Locale over cookie', () => {
    const event = {
      headers: {
        'x-locale': 'fr-FR',
        cookie: 'fae_locale=de-DE',
      },
    };
    expect(resolveLocaleFromRequest(event)).toBe('fr-FR');
  });

  test('should return default for invalid locale', () => {
    const event = {
      headers: { 'x-locale': 'es-ES' },
    };
    expect(resolveLocaleFromRequest(event)).toBe('en-GB');
  });
});

// ==========================================
// ADDRESS FORMATTING TESTS
// ==========================================

describe('Address Formatting', () => {
  function formatAddress(address, countryCode = 'GB') {
    if (!address) return '—';

    const { street, city, state, postalCode, country } = address;

    switch (countryCode.toUpperCase()) {
      case 'US':
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
      case 'PL':
        const euParts = [street];
        if (postalCode && city) {
          euParts.push(`${postalCode} ${city}`);
        } else if (city) {
          euParts.push(city);
        }
        if (country) euParts.push(country);
        return euParts.filter(Boolean).join(', ');

      default:
        const parts = [street, city, postalCode, country];
        return parts.filter(Boolean).join(', ');
    }
  }

  test('should format US address with state', () => {
    const address = {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
    };
    expect(formatAddress(address, 'US')).toBe('123 Main St, New York, NY 10001');
  });

  test('should format German address (postal before city)', () => {
    const address = {
      street: 'Hauptstraße 1',
      postalCode: '10115',
      city: 'Berlin',
    };
    expect(formatAddress(address, 'DE')).toBe('Hauptstraße 1, 10115 Berlin');
  });

  test('should format UK address', () => {
    const address = {
      street: '10 Downing Street',
      city: 'London',
      postalCode: 'SW1A 2AA',
    };
    expect(formatAddress(address, 'GB')).toBe('10 Downing Street, London, SW1A 2AA');
  });

  test('should format Polish address', () => {
    const address = {
      street: 'ul. Nowy Świat 1',
      postalCode: '00-001',
      city: 'Warszawa',
    };
    expect(formatAddress(address, 'PL')).toBe('ul. Nowy Świat 1, 00-001 Warszawa');
  });
});
