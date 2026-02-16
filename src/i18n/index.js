/**
 * FlyAndEarn - Enhanced i18n Core Module
 *
 * Features:
 * - Country + Language locale support (e.g., en-GB, en-US, fr-FR, pl-PL, de-DE)
 * - Namespace-based translations
 * - Pluralization with locale-specific rules
 * - Interpolation with variables
 * - Currency, date, number formatting via Intl APIs
 * - Locale resolution: profile > cookie > URL > Accept-Language > default
 * - Missing key logging for QA
 * - Backward compatibility with existing T object
 */

import { TRANSLATIONS } from './translations.js';
import { formatCurrency, formatDate, formatNumber, formatDistance, formatAddress } from './formatters.js';
import { GLOSSARY, getGlossaryTerm } from './glossary.js';

// ==========================================
// SUPPORTED LOCALES & CONFIGURATION
// ==========================================

export const SUPPORTED_LOCALES = ['en-GB', 'en-US', 'fr-FR', 'pl-PL', 'de-DE', 'fr-CH', 'de-CH', 'de-AT'];
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'pl', 'de'];
export const SUPPORTED_COUNTRIES = ['GB', 'US', 'FR', 'PL', 'DE', 'CH', 'AT'];
export const DEFAULT_LOCALE = 'en-GB';
export const DEFAULT_LANGUAGE = 'en';

// Language to default country mapping
const LANGUAGE_COUNTRY_MAP = {
  en: 'GB',
  fr: 'FR',
  pl: 'PL',
  de: 'DE',
};

// Country to default language mapping
const COUNTRY_LANGUAGE_MAP = {
  GB: 'en',
  US: 'en',
  FR: 'fr',
  PL: 'pl',
  DE: 'de',
  CH: 'de', // Switzerland defaults to German
  AT: 'de', // Austria defaults to German
};

// Country-specific locale variants (same language, different country)
const LOCALE_VARIANTS = {
  'en-GB': { currency: 'GBP', dateFormat: 'dd/MM/yyyy', distanceUnit: 'mi' },
  'en-US': { currency: 'USD', dateFormat: 'MM/dd/yyyy', distanceUnit: 'mi' },
  'fr-FR': { currency: 'EUR', dateFormat: 'dd/MM/yyyy', distanceUnit: 'km' },
  'fr-CH': { currency: 'CHF', dateFormat: 'dd.MM.yyyy', distanceUnit: 'km' },
  'pl-PL': { currency: 'PLN', dateFormat: 'dd.MM.yyyy', distanceUnit: 'km' },
  'de-DE': { currency: 'EUR', dateFormat: 'dd.MM.yyyy', distanceUnit: 'km' },
  'de-CH': { currency: 'CHF', dateFormat: 'dd.MM.yyyy', distanceUnit: 'km' },
  'de-AT': { currency: 'EUR', dateFormat: 'dd.MM.yyyy', distanceUnit: 'km' },
};

// ==========================================
// LOCALE RESOLUTION
// ==========================================

/**
 * Parse a locale string into language and country components
 * @param {string} locale - e.g., "fr-FR", "en", "pl_PL"
 * @returns {{ language: string, country: string|null }}
 */
export function parseLocale(locale) {
  if (!locale) return { language: DEFAULT_LANGUAGE, country: null };

  const normalized = locale.replace('_', '-');
  const parts = normalized.split('-');
  const language = parts[0].toLowerCase();
  const country = parts[1] ? parts[1].toUpperCase() : null;

  return { language, country };
}

/**
 * Build a canonical locale string from language and country
 * @param {string} language
 * @param {string} country
 * @returns {string}
 */
export function buildLocale(language, country) {
  const lang = language.toLowerCase();
  const ctry = country ? country.toUpperCase() : LANGUAGE_COUNTRY_MAP[lang] || 'GB';
  return `${lang}-${ctry}`;
}

/**
 * Resolve the best locale based on available signals
 * Priority: userProfile > cookie > URL param > Accept-Language > default
 *
 * @param {Object} options
 * @param {string} options.userProfile - Locale from user profile (e.g., 'fr-FR')
 * @param {string} options.cookie - Locale from cookie
 * @param {string} options.urlParam - Locale from URL (?lang=fr)
 * @param {string} options.acceptLanguage - Browser Accept-Language header
 * @returns {string} Resolved locale (e.g., 'fr-FR')
 */
export function resolveLocale({ userProfile, cookie, urlParam, acceptLanguage } = {}) {
  // Try each source in priority order
  const sources = [userProfile, cookie, urlParam, acceptLanguage];

  for (const source of sources) {
    if (!source) continue;

    const { language, country } = parseLocale(source);

    if (!SUPPORTED_LANGUAGES.includes(language)) continue;

    // Build full locale
    const locale = buildLocale(language, country);

    // Check if this exact locale is supported
    if (SUPPORTED_LOCALES.includes(locale)) {
      return locale;
    }

    // Fall back to language's default country
    const fallbackLocale = buildLocale(language, LANGUAGE_COUNTRY_MAP[language]);
    if (SUPPORTED_LOCALES.includes(fallbackLocale)) {
      return fallbackLocale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Get locale configuration (currency, date format, etc.)
 * @param {string} locale
 * @returns {Object}
 */
export function getLocaleConfig(locale) {
  return LOCALE_VARIANTS[locale] || LOCALE_VARIANTS[DEFAULT_LOCALE];
}

// ==========================================
// PLURALIZATION
// ==========================================

/**
 * Get plural form for a locale
 * Uses standard CLDR plural rules
 * @param {number} count
 * @param {string} locale
 * @returns {string} - 'zero', 'one', 'two', 'few', 'many', 'other'
 */
export function getPluralForm(count, locale) {
  const { language } = parseLocale(locale);

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

// ==========================================
// ENHANCED I18N CLASS
// ==========================================

class I18n {
  constructor() {
    this.currentLocale = DEFAULT_LOCALE;
    this.currentLang = DEFAULT_LANGUAGE;
    this.currentCountry = 'GB';
    this.data = { ...TRANSLATIONS };
    this.loaded = new Set(['core']);
    this.missingKeys = new Set();
  }

  /**
   * Initialize i18n system
   * @param {Object} options
   * @param {string} options.userLocale - Locale from user profile
   */
  async init(options = {}) {
    const { userLocale } = options;

    // Get cookie
    const cookieLocale = this.getLocaleCookie();

    // Get URL param
    const urlParams = new URLSearchParams(window.location.search);
    const urlLocale = urlParams.get('lang') || urlParams.get('locale');

    // Get browser language
    const browserLang = navigator.language || navigator.userLanguage;

    // Check old localStorage key for backward compatibility with legacy i18n.js
    const legacyLang = localStorage.getItem('fae_language');

    // Resolve locale
    const locale = resolveLocale({
      userProfile: userLocale,
      cookie: cookieLocale || legacyLang,
      urlParam: urlLocale,
      acceptLanguage: browserLang,
    });

    this.setLocale(locale, false);

    // Load full translations
    await this.loadTranslations();

    // Apply to DOM
    this.apply();

    return locale;
  }

  /**
   * Set the current locale
   * @param {string} locale
   * @param {boolean} apply - Whether to apply translations immediately
   */
  setLocale(locale, apply = true) {
    const { language, country } = parseLocale(locale);
    const resolvedLocale = buildLocale(language, country);

    if (!SUPPORTED_LOCALES.includes(resolvedLocale)) {
      console.warn(`Locale ${resolvedLocale} not supported, falling back to ${DEFAULT_LOCALE}`);
      this.currentLocale = DEFAULT_LOCALE;
    } else {
      this.currentLocale = resolvedLocale;
    }

    const parsed = parseLocale(this.currentLocale);
    this.currentLang = parsed.language;
    this.currentCountry = parsed.country;

    // Update cookie
    this.setLocaleCookie(this.currentLocale);

    // Update localStorage for backward compatibility
    localStorage.setItem('flyandearn_lang', this.currentLang);
    localStorage.setItem('flyandearn_locale', this.currentLocale);
    localStorage.setItem('flyandearn_country', this.currentCountry);
    // Sync with legacy i18n.js key
    localStorage.setItem('fae_language', this.currentLang);

    // Update HTML lang
    document.documentElement.lang = this.currentLocale;

    // Dispatch event
    window.dispatchEvent(new CustomEvent('localeChanged', {
      detail: {
        locale: this.currentLocale,
        language: this.currentLang,
        country: this.currentCountry,
      }
    }));

    if (apply) {
      this.apply();
    }
  }

  /**
   * Set language only (country will use default for that language)
   * @param {string} lang
   */
  setLang(lang) {
    const country = LANGUAGE_COUNTRY_MAP[lang] || 'GB';
    this.setLocale(buildLocale(lang, country));
  }

  /**
   * Set country (language will use default for that country)
   * @param {string} country
   */
  setCountry(country) {
    const lang = COUNTRY_LANGUAGE_MAP[country] || 'en';
    this.setLocale(buildLocale(lang, country));
  }

  /**
   * Set both language and country explicitly
   * @param {string} language
   * @param {string} country
   */
  setLanguageAndCountry(language, country) {
    this.setLocale(buildLocale(language, country));
  }

  async loadTranslations() {
    if (this.loaded.has('full')) return;

    try {
      const module = await import('./translations.js');
      this.data = { ...this.data, ...module.TRANSLATIONS };
      this.loaded.add('full');
    } catch (err) {
      console.warn('Failed to load full translations:', err);
    }
  }

  /**
   * Translate a key with optional interpolation and pluralization
   *
   * @param {string} key - Translation key (e.g., 'nav.login' or 'trips.count')
   * @param {Object} options - Interpolation variables and options
   * @param {number} options.count - For pluralization
   * @param {string} options.context - Context variant (e.g., 'formal', 'informal')
   * @returns {string}
   */
  t(key, options = {}) {
    const { count, context, ...variables } = options;

    // Try locale-specific key first (e.g., key_en-US)
    let entry = this.data[`${key}_${this.currentLocale}`] || this.data[key];

    if (!entry) {
      this.logMissingKey(key);
      return key;
    }

    // Get translation for current language
    let translation = entry[this.currentLang] || entry.en || key;

    // Handle country-specific overrides
    if (entry[`${this.currentLang}_${this.currentCountry}`]) {
      translation = entry[`${this.currentLang}_${this.currentCountry}`];
    }

    // Handle pluralization
    if (typeof count === 'number') {
      const pluralForm = getPluralForm(count, this.currentLocale);
      const pluralKey = `${key}_${pluralForm}`;
      const pluralEntry = this.data[pluralKey];

      if (pluralEntry) {
        translation = pluralEntry[this.currentLang] || pluralEntry.en || translation;
      }
    }

    // Handle context variants
    if (context) {
      const contextKey = `${key}_${context}`;
      const contextEntry = this.data[contextKey];

      if (contextEntry) {
        translation = contextEntry[this.currentLang] || contextEntry.en || translation;
      }
    }

    // Interpolate variables
    if (Object.keys(variables).length > 0 || typeof count === 'number') {
      translation = this.interpolate(translation, { ...variables, count });
    }

    return translation;
  }

  /**
   * Interpolate variables into a translation string
   * Supports: {{variable}}, {{count}}
   * @param {string} str
   * @param {Object} variables
   * @returns {string}
   */
  interpolate(str, variables) {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (varName in variables) {
        return variables[varName];
      }
      return match;
    });
  }

  /**
   * Log missing translation key for QA
   * @param {string} key
   */
  logMissingKey(key) {
    if (this.missingKeys.has(key)) return;

    this.missingKeys.add(key);
    console.warn(`[i18n] Missing translation: ${key} for locale ${this.currentLocale}`);

    // Store in sessionStorage for dev overlay
    const stored = JSON.parse(sessionStorage.getItem('i18n_missing_keys') || '[]');
    stored.push({
      key,
      locale: this.currentLocale,
      page: window.location.pathname,
      timestamp: Date.now(),
    });
    sessionStorage.setItem('i18n_missing_keys', JSON.stringify(stored));
  }

  /**
   * Apply translations to DOM elements
   */
  apply() {
    // data-i18n for text content
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const options = el.getAttribute('data-i18n-options');
      const opts = options ? JSON.parse(options) : {};
      const translated = this.t(key, opts);

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translated;
      } else {
        el.innerHTML = translated;
      }
    });

    // data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    // data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });

    // data-i18n-aria for accessibility
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', this.t(key));
    });

    // data-i18n-value for form values
    document.querySelectorAll('[data-i18n-value]').forEach((el) => {
      const key = el.getAttribute('data-i18n-value');
      el.value = this.t(key);
    });
  }

  // Cookie helpers
  getLocaleCookie() {
    const match = document.cookie.match(/(?:^|; )fae_locale=([^;]*)/);
    return match ? match[1] : null;
  }

  setLocaleCookie(locale) {
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    document.cookie = `fae_locale=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }

  // ==========================================
  // FORMATTING UTILITIES (delegated)
  // ==========================================

  /**
   * Format currency amount
   * @param {number} amount
   * @param {string} currency - ISO 4217 code (e.g., 'EUR', 'PLN')
   * @returns {string}
   */
  formatCurrency(amount, currency) {
    return formatCurrency(amount, currency, this.currentLocale);
  }

  /**
   * Format date
   * @param {Date|string|number} date
   * @param {string} style - 'short', 'medium', 'long', 'full'
   * @returns {string}
   */
  formatDate(date, style = 'medium') {
    return formatDate(date, this.currentLocale, style);
  }

  /**
   * Format number
   * @param {number} number
   * @param {Object} options - Intl.NumberFormat options
   * @returns {string}
   */
  formatNumber(number, options = {}) {
    return formatNumber(number, this.currentLocale, options);
  }

  /**
   * Format distance with locale-appropriate unit
   * @param {number} km - Distance in kilometers
   * @returns {string}
   */
  formatDistance(km) {
    return formatDistance(km, this.currentLocale);
  }

  /**
   * Format address based on country conventions
   * @param {Object} address
   * @returns {string}
   */
  formatAddress(address) {
    return formatAddress(address, this.currentCountry);
  }

  /**
   * Get a glossary term with proper locale-specific wording
   * @param {string} term - e.g., 'traveller', 'dutyFree', 'serviceFee'
   * @returns {string}
   */
  glossary(term) {
    return getGlossaryTerm(term, this.currentLocale);
  }

  /**
   * Get locale configuration
   * @returns {Object}
   */
  getConfig() {
    return getLocaleConfig(this.currentLocale);
  }

  /**
   * Get missing keys for QA
   * @returns {Array}
   */
  getMissingKeys() {
    return JSON.parse(sessionStorage.getItem('i18n_missing_keys') || '[]');
  }

  /**
   * Clear missing keys log
   */
  clearMissingKeys() {
    sessionStorage.removeItem('i18n_missing_keys');
    this.missingKeys.clear();
  }
}

// Create singleton instance
export const i18n = new I18n();

// Legacy T object for backward compatibility
export const T = {
  get currentLang() {
    return i18n.currentLang;
  },
  set currentLang(val) {
    i18n.setLang(val);
  },
  get data() {
    return i18n.data;
  },
  t(key, options) {
    return i18n.t(key, options);
  },
  setLang(lang) {
    i18n.setLang(lang);
  },
  // Alias for backward compatibility with old i18n.js
  setLanguage(lang) {
    i18n.setLang(lang);
  },
  getLanguage() {
    return i18n.currentLang;
  },
  init() {
    // Already initialized by i18n singleton, just return current lang
    return i18n.currentLang;
  },
  updatePage() {
    i18n.apply();
  },
  apply() {
    i18n.apply();
  },
};

// Shorthand translation function
export function t(key, options) {
  return i18n.t(key, options);
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.T = T;
  window.i18n = i18n;
  window.t = t;
}

// Re-export utilities
export { formatCurrency, formatDate, formatNumber, formatDistance, formatAddress };
export { GLOSSARY, getGlossaryTerm };

export default i18n;
