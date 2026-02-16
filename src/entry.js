/**
 * FlyAndEarn - Main Entry Point
 *
 * This is the single entry point for the Vite build.
 * It loads critical modules immediately and lazy-loads heavy features.
 */

// ===========================================
// CRITICAL IMPORTS (loaded immediately)
// ===========================================
import { Store } from './core/store.js';
import { Stats } from './core/stats.js';
import { i18n, T } from './i18n/index.js';
import { initLocaleSelector } from './i18n/locale-selector.js';
import { initNavigation } from './nav.js';

// ===========================================
// LAZY LOAD FUNCTIONS
// ===========================================

// Airports data (loaded on demand)
let airportsModule = null;
export async function getAirports() {
  if (!airportsModule) {
    airportsModule = await import('./data/airports.js');
  }
  return airportsModule;
}

// Currencies data (loaded on demand)
let currenciesModule = null;
export async function getCurrencies() {
  if (!currenciesModule) {
    currenciesModule = await import('./data/currencies.js');
  }
  return currenciesModule;
}

// Calculator feature (loaded when section visible)
export async function loadCalculatorFeature() {
  const module = await import('./features/calculator.js');
  return module;
}

// Map feature (loaded when map section visible)
export async function loadMapFeature() {
  const module = await import('./features/map.js');
  return module;
}

// ===========================================
// INITIALIZATION
// ===========================================

async function initApp() {
  // Initialize i18n first (with user locale if logged in)
  let userLocale = null;
  try {
    const meResponse = await fetch('/api/me', { credentials: 'include' });
    if (meResponse.ok) {
      const data = await meResponse.json();
      userLocale = data.user?.preferredLocale;
    }
  } catch (e) {
    // User not logged in, use cookie/browser locale
  }

  await i18n.init({ userLocale });

  // Initialize locale selector in navigation
  const localeSelectorContainer = document.getElementById('locale-selector-nav');
  if (localeSelectorContainer) {
    initLocaleSelector(localeSelectorContainer, {
      mode: 'full',
      showFlag: true,
      onLocaleChange: () => {
        // Re-apply translations to the page
        i18n.apply();
      },
    });
  }

  // Initialize navigation
  initNavigation();

  // Initialize stats display
  Stats.init();

  // Set up lazy loading for heavy features
  setupLazyLoading();

  // Load main app logic (the big module from main-app.js)
  // We keep this as a separate script for backward compatibility
  // but it will be loaded with defer

  console.log('[FlyAndEarn] App initialized');
}

function setupLazyLoading() {
  // Lazy load calculator when savings section is visible
  const calculatorSection = document.getElementById('savings');
  if (calculatorSection) {
    const observer = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            const { initCalculatorLazyLoad } = await loadCalculatorFeature();
            initCalculatorLazyLoad();
            break;
          }
        }
      },
      { rootMargin: '300px', threshold: 0 }
    );
    observer.observe(calculatorSection);
  }

  // Lazy load map when map section is visible
  const mapSection = document.getElementById('map-section');
  if (mapSection) {
    const observer = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            const { initMapLazyLoad } = await loadMapFeature();
            initMapLazyLoad();
            break;
          }
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(mapSection);
  }

  // Preload airports/currencies data when user starts typing in forms
  document.querySelectorAll('input[data-needs-airports], select[data-needs-airports]').forEach((el) => {
    el.addEventListener('focus', () => getAirports(), { once: true });
  });

  document.querySelectorAll('input[data-needs-currencies], select[data-needs-currencies]').forEach((el) => {
    el.addEventListener('focus', () => getCurrencies(), { once: true });
  });
}

// ===========================================
// EXPOSE GLOBALS FOR BACKWARD COMPATIBILITY
// ===========================================

if (typeof window !== 'undefined') {
  // Core modules
  window.Store = Store;
  window.Stats = Stats;
  window.T = T;
  window.i18n = i18n;

  // Lazy loaders
  window.getAirports = getAirports;
  window.getCurrencies = getCurrencies;
  window.loadCalculatorFeature = loadCalculatorFeature;
  window.loadMapFeature = loadMapFeature;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

export { Store, Stats, i18n, T };
