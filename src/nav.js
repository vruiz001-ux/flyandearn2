/**
 * FlyAndEarn - Navigation Module
 * Handles keyboard navigation, dropdowns, mobile menu, and accessibility
 */

const NAV_CONFIG = {
  headerSelector: '.site-header',
  mobileNavSelector: '#mobileNav',
  mobileOverlaySelector: '#mobileNavOverlay',
  mobileToggleSelector: '#mobileMenuToggle',
  langSelectorSelector: '.lang-selector',
  dropdownClass: 'nav-item',
  openClass: 'open',
  activeClass: 'active',
  showClass: 'show',
  scrollOffset: 80,
};

function getElements() {
  return {
    header: document.querySelector(NAV_CONFIG.headerSelector),
    mobileNav: document.querySelector(NAV_CONFIG.mobileNavSelector),
    mobileOverlay: document.querySelector(NAV_CONFIG.mobileOverlaySelector),
    mobileToggle: document.querySelector(NAV_CONFIG.mobileToggleSelector),
    langSelector: document.querySelector(NAV_CONFIG.langSelectorSelector),
    dropdowns: document.querySelectorAll('.nav-item.has-dropdown'),
    allNavLinks: document.querySelectorAll('.nav-link, .nav-dropdown-link, .mobile-nav-link'),
  };
}

function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleTabKey(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }

  element.addEventListener('keydown', handleTabKey);
  return () => element.removeEventListener('keydown', handleTabKey);
}

function initDropdowns() {
  const dropdowns = document.querySelectorAll('.nav-item.has-dropdown');

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector('.nav-link');
    const menu = dropdown.querySelector('.nav-dropdown');

    if (!trigger || !menu) return;

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = dropdown.classList.contains(NAV_CONFIG.openClass);

      // Close all dropdowns first
      dropdowns.forEach((d) => d.classList.remove(NAV_CONFIG.openClass));

      if (!isOpen) {
        dropdown.classList.add(NAV_CONFIG.openClass);
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Keyboard navigation
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      } else if (e.key === 'Escape') {
        dropdown.classList.remove(NAV_CONFIG.openClass);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item.has-dropdown')) {
      dropdowns.forEach((d) => {
        d.classList.remove(NAV_CONFIG.openClass);
        const t = d.querySelector('.nav-link');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

function initMobileNav() {
  const { mobileNav, mobileOverlay, mobileToggle } = getElements();
  if (!mobileNav || !mobileToggle) return;

  let cleanupTrapFocus = null;

  function openMobileNav() {
    mobileNav.classList.add(NAV_CONFIG.showClass);
    if (mobileOverlay) mobileOverlay.classList.add(NAV_CONFIG.showClass);
    mobileToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    cleanupTrapFocus = trapFocus(mobileNav);

    const firstLink = mobileNav.querySelector('a, button');
    if (firstLink) firstLink.focus();
  }

  function closeMobileNav() {
    mobileNav.classList.remove(NAV_CONFIG.showClass);
    if (mobileOverlay) mobileOverlay.classList.remove(NAV_CONFIG.showClass);
    mobileToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (cleanupTrapFocus) cleanupTrapFocus();
    mobileToggle.focus();
  }

  mobileToggle.addEventListener('click', () => {
    const isOpen = mobileNav.classList.contains(NAV_CONFIG.showClass);
    if (isOpen) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });

  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileNav);
  }

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav.classList.contains(NAV_CONFIG.showClass)) {
      closeMobileNav();
    }
  });

  // Close button
  const closeBtn = mobileNav.querySelector('.mobile-nav-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMobileNav);
  }

  // Close when clicking mobile nav links
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      setTimeout(closeMobileNav, 100);
    });
  });
}

function initLangSelector() {
  const { langSelector } = getElements();
  if (!langSelector) return;

  const trigger = langSelector.querySelector('.lang-trigger, .lang-current');
  const dropdown = langSelector.querySelector('.lang-dropdown');

  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    langSelector.classList.toggle(NAV_CONFIG.openClass);
  });

  dropdown.querySelectorAll('button, a').forEach((option) => {
    option.addEventListener('click', (e) => {
      const lang = e.currentTarget.dataset.lang;
      if (lang && typeof window.T !== 'undefined') {
        window.T.setLang(lang);
        if (typeof window.T.apply === 'function') {
          window.T.apply();
        }
      }
      langSelector.classList.remove(NAV_CONFIG.openClass);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.lang-selector')) {
      langSelector.classList.remove(NAV_CONFIG.openClass);
    }
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '#!' || !href.startsWith('#')) return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offsetTop = target.offsetTop - NAV_CONFIG.scrollOffset;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth',
        });
      }
    });
  });
}

function initBackToTop() {
  // Prevent duplicate buttons
  if (document.querySelector('.back-to-top')) return;

  // Create the button
  const button = document.createElement('button');
  button.className = 'back-to-top';
  button.setAttribute('aria-label', 'Back to top');
  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>';
  document.body.appendChild(button);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SCROLL_THRESHOLD = 300;

  function updateVisibility() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      button.classList.add('visible');
    } else {
      button.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', updateVisibility, { passive: true });
  updateVisibility();

  button.addEventListener('click', function () {
    const header = document.getElementById('site-header');
    if (header) {
      header.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      header.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  });
}

export function initNavigation() {
  initDropdowns();
  initMobileNav();
  initLangSelector();
  initSmoothScroll();
  initBackToTop();
}

// Auto-init when DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }
}

export default initNavigation;
