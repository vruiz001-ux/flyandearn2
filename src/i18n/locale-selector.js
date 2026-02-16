/**
 * FlyAndEarn - Locale Selector Component
 *
 * Provides a UI component for selecting language and country.
 * Supports both combined locale selection and separate language/country selection.
 *
 * Usage:
 *   <div id="locale-selector"></div>
 *   <script type="module">
 *     import { initLocaleSelector } from './i18n/locale-selector.js';
 *     initLocaleSelector('#locale-selector');
 *   </script>
 */

import { i18n, SUPPORTED_LOCALES, SUPPORTED_LANGUAGES, SUPPORTED_COUNTRIES } from './index.js';

// ==========================================
// LOCALE DISPLAY NAMES
// ==========================================

const LANGUAGE_NAMES = {
  en: { native: 'English', en: 'English' },
  fr: { native: 'Français', en: 'French' },
  pl: { native: 'Polski', en: 'Polish' },
  de: { native: 'Deutsch', en: 'German' },
};

const COUNTRY_NAMES = {
  GB: { native: 'United Kingdom', en: 'United Kingdom', flag: '🇬🇧' },
  US: { native: 'United States', en: 'United States', flag: '🇺🇸' },
  FR: { native: 'France', en: 'France', flag: '🇫🇷' },
  PL: { native: 'Polska', en: 'Poland', flag: '🇵🇱' },
  DE: { native: 'Deutschland', en: 'Germany', flag: '🇩🇪' },
  CH: { native: 'Schweiz / Suisse', en: 'Switzerland', flag: '🇨🇭' },
  AT: { native: 'Österreich', en: 'Austria', flag: '🇦🇹' },
};

const LOCALE_DISPLAY = {
  'en-GB': { name: 'English (UK)', flag: '🇬🇧' },
  'en-US': { name: 'English (US)', flag: '🇺🇸' },
  'fr-FR': { name: 'Français (France)', flag: '🇫🇷' },
  'fr-CH': { name: 'Français (Suisse)', flag: '🇨🇭' },
  'pl-PL': { name: 'Polski', flag: '🇵🇱' },
  'de-DE': { name: 'Deutsch (Deutschland)', flag: '🇩🇪' },
  'de-CH': { name: 'Deutsch (Schweiz)', flag: '🇨🇭' },
  'de-AT': { name: 'Deutsch (Österreich)', flag: '🇦🇹' },
};

// ==========================================
// STYLES
// ==========================================

const SELECTOR_STYLES = `
  .locale-selector {
    position: relative;
    display: inline-block;
    font-family: inherit;
  }

  .locale-selector-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary, #1a1a1b);
    border: 1px solid var(--border-color, #333);
    border-radius: 0.5rem;
    color: var(--text-primary, #fff);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .locale-selector-trigger:hover {
    border-color: var(--accent-color, #d4a853);
    background: var(--bg-tertiary, #222);
  }

  .locale-selector-trigger .flag {
    font-size: 1.25rem;
    line-height: 1;
  }

  .locale-selector-trigger .arrow {
    margin-left: 0.25rem;
    transition: transform 0.2s ease;
  }

  .locale-selector.open .locale-selector-trigger .arrow {
    transform: rotate(180deg);
  }

  .locale-selector-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    min-width: 220px;
    background: var(--bg-secondary, #1a1a1b);
    border: 1px solid var(--border-color, #333);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.2s ease;
  }

  .locale-selector.open .locale-selector-dropdown {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .locale-selector-section {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .locale-selector-section:last-child {
    border-bottom: none;
  }

  .locale-selector-section-title {
    padding: 0.25rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #888);
    letter-spacing: 0.05em;
  }

  .locale-selector-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .locale-selector-option:hover {
    background: var(--bg-tertiary, #222);
  }

  .locale-selector-option.selected {
    background: var(--accent-color-dim, rgba(212, 168, 83, 0.1));
    color: var(--accent-color, #d4a853);
  }

  .locale-selector-option .flag {
    font-size: 1.25rem;
    line-height: 1;
  }

  .locale-selector-option .name {
    flex: 1;
    font-size: 0.875rem;
  }

  .locale-selector-option .check {
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .locale-selector-option.selected .check {
    opacity: 1;
  }

  /* Simple mode - just language dropdown */
  .locale-selector-simple select {
    padding: 0.5rem 2rem 0.5rem 1rem;
    background: var(--bg-secondary, #1a1a1b);
    border: 1px solid var(--border-color, #333);
    border-radius: 0.5rem;
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
  }

  .locale-selector-simple select:focus {
    outline: none;
    border-color: var(--accent-color, #d4a853);
  }
`;

// ==========================================
// COMPONENT
// ==========================================

/**
 * Initialize the locale selector component
 *
 * @param {string|HTMLElement} container - Container element or selector
 * @param {Object} options
 * @param {string} options.mode - 'full' (language + country) or 'simple' (language only)
 * @param {boolean} options.showFlag - Show flag emoji
 * @param {Function} options.onLocaleChange - Callback when locale changes
 */
export function initLocaleSelector(container, options = {}) {
  const {
    mode = 'full',
    showFlag = true,
    onLocaleChange = null,
  } = options;

  const el = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!el) {
    console.warn('[LocaleSelector] Container not found:', container);
    return null;
  }

  // Inject styles if not already present
  if (!document.getElementById('locale-selector-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'locale-selector-styles';
    styleEl.textContent = SELECTOR_STYLES;
    document.head.appendChild(styleEl);
  }

  if (mode === 'simple') {
    return initSimpleSelector(el, { showFlag, onLocaleChange });
  }

  return initFullSelector(el, { showFlag, onLocaleChange });
}

/**
 * Simple language-only dropdown
 */
function initSimpleSelector(el, { onLocaleChange }) {
  const currentLang = i18n.currentLang;

  el.innerHTML = `
    <div class="locale-selector-simple">
      <select id="language-select" aria-label="Select language">
        ${SUPPORTED_LANGUAGES.map(lang => `
          <option value="${lang}" ${lang === currentLang ? 'selected' : ''}>
            ${LANGUAGE_NAMES[lang]?.native || lang}
          </option>
        `).join('')}
      </select>
    </div>
  `;

  const select = el.querySelector('#language-select');

  select.addEventListener('change', async (e) => {
    const lang = e.target.value;
    i18n.setLang(lang);

    // Save to user profile if logged in
    await saveLocaleToProfile();

    if (onLocaleChange) {
      onLocaleChange({ language: lang, locale: i18n.currentLocale });
    }
  });

  // Update on locale change
  window.addEventListener('localeChanged', (e) => {
    select.value = e.detail.language;
  });

  return { el, select };
}

/**
 * Full locale selector with language and country
 * Uses native <select> for reliability
 */
function initFullSelector(el, { showFlag, onLocaleChange }) {
  const currentLocale = i18n.currentLocale || 'en-GB';

  el.innerHTML = `
    <div class="locale-selector-native">
      <select id="locale-select-full" aria-label="Select language and region">
        ${SUPPORTED_LOCALES.map(locale => {
          const d = LOCALE_DISPLAY[locale] || { name: locale, flag: '🌐' };
          const isSelected = locale === currentLocale;
          return `<option value="${locale}" ${isSelected ? 'selected' : ''}>${d.flag} ${d.name}</option>`;
        }).join('')}
      </select>
    </div>
  `;

  // Add styles for native select
  const style = document.createElement('style');
  style.textContent = `
    .locale-selector-native select {
      padding: 0.5rem 2rem 0.5rem 0.75rem;
      background: var(--bg-secondary, #1a1a1b);
      border: 1px solid var(--border-color, #333);
      border-radius: 0.5rem;
      color: var(--text-primary, #fff);
      font-size: 0.875rem;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      min-width: 160px;
    }
    .locale-selector-native select:hover {
      border-color: var(--accent-color, #d4a853);
    }
    .locale-selector-native select:focus {
      outline: none;
      border-color: var(--accent-color, #d4a853);
      box-shadow: 0 0 0 2px rgba(212, 168, 83, 0.2);
    }
    .locale-selector-native select option {
      background: var(--bg-secondary, #1a1a1b);
      color: var(--text-primary, #fff);
      padding: 0.5rem;
    }
  `;
  if (!document.getElementById('locale-native-styles')) {
    style.id = 'locale-native-styles';
    document.head.appendChild(style);
  }

  const select = el.querySelector('#locale-select-full');

  select.addEventListener('change', async (e) => {
    const locale = e.target.value;

    // Change locale
    i18n.setLocale(locale);

    // Save to user profile if logged in
    await saveLocaleToProfile();

    if (onLocaleChange) {
      onLocaleChange({ locale, language: i18n.currentLang, country: i18n.currentCountry });
    }
  });

  // Update on locale change from elsewhere
  window.addEventListener('localeChanged', (e) => {
    select.value = e.detail.locale;
  });

  return { el, select };
}

/**
 * Save locale preference to user profile via API
 */
async function saveLocaleToProfile() {
  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preferredLocale: i18n.currentLocale,
        preferredLanguage: i18n.currentLang,
        preferredCountry: i18n.currentCountry,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      // User might not be logged in, that's ok
      console.debug('[LocaleSelector] Could not save to profile (user may not be logged in)');
    }
  } catch (e) {
    // Silently fail - locale is already saved in cookie
    console.debug('[LocaleSelector] Could not save to profile:', e.message);
  }
}

/**
 * Create a standalone language switcher for the footer
 */
export function createFooterLanguageSwitcher() {
  const div = document.createElement('div');
  div.className = 'footer-language-switcher';
  div.innerHTML = `
    <span style="color: var(--text-muted); font-size: 0.875rem; margin-right: 0.5rem;">Language:</span>
  `;

  const links = SUPPORTED_LANGUAGES.map(lang => {
    const name = LANGUAGE_NAMES[lang].native;
    const isActive = lang === i18n.currentLang;
    return `<a href="?lang=${lang}" class="lang-link ${isActive ? 'active' : ''}" data-lang="${lang}">${name}</a>`;
  }).join(' | ');

  div.innerHTML += links;

  // Handle clicks
  div.querySelectorAll('.lang-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = link.dataset.lang;
      i18n.setLang(lang);

      // Update active state
      div.querySelectorAll('.lang-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  return div;
}

export {
  LANGUAGE_NAMES,
  COUNTRY_NAMES,
  LOCALE_DISPLAY,
};
