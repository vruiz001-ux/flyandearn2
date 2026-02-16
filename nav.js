/**
 * FlyAndEarn - Unified Navigation JavaScript
 * Handles keyboard navigation, dropdowns, mobile menu, and accessibility
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================
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
        scrollOffset: 80
    };

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    function getElements() {
        return {
            header: document.querySelector(NAV_CONFIG.headerSelector),
            mobileNav: document.querySelector(NAV_CONFIG.mobileNavSelector),
            mobileOverlay: document.querySelector(NAV_CONFIG.mobileOverlaySelector),
            mobileToggle: document.querySelector(NAV_CONFIG.mobileToggleSelector),
            langSelector: document.querySelector(NAV_CONFIG.langSelectorSelector),
            dropdowns: document.querySelectorAll('.nav-item.has-dropdown'),
            allNavLinks: document.querySelectorAll('.nav-link, .nav-dropdown-link, .mobile-nav-link')
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

    // ========================================
    // DROPDOWN NAVIGATION
    // ========================================

    function initDropdowns() {
        const dropdowns = document.querySelectorAll('.nav-item.has-dropdown');

        dropdowns.forEach(dropdown => {
            const trigger = dropdown.querySelector('.nav-link');
            const menu = dropdown.querySelector('.nav-dropdown');

            if (!trigger || !menu) return;

            // Set ARIA attributes
            const menuId = 'dropdown-' + Math.random().toString(36).substr(2, 9);
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-haspopup', 'true');
            trigger.setAttribute('aria-controls', menuId);
            menu.setAttribute('id', menuId);
            menu.setAttribute('role', 'menu');

            // Menu items
            const menuItems = menu.querySelectorAll('.nav-dropdown-link');
            menuItems.forEach(item => {
                item.setAttribute('role', 'menuitem');
            });

            // Click handler
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                toggleDropdown(dropdown, trigger);
            });

            // Keyboard handlers
            trigger.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        toggleDropdown(dropdown, trigger);
                        if (dropdown.classList.contains(NAV_CONFIG.openClass)) {
                            menuItems[0]?.focus();
                        }
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        openDropdown(dropdown, trigger);
                        menuItems[0]?.focus();
                        break;
                    case 'Escape':
                        closeDropdown(dropdown, trigger);
                        trigger.focus();
                        break;
                }
            });

            // Menu item keyboard navigation
            menuItems.forEach((item, index) => {
                item.addEventListener('keydown', (e) => {
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            menuItems[index + 1]?.focus() || menuItems[0].focus();
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            menuItems[index - 1]?.focus() || menuItems[menuItems.length - 1].focus();
                            break;
                        case 'Escape':
                            e.preventDefault();
                            closeDropdown(dropdown, trigger);
                            trigger.focus();
                            break;
                        case 'Tab':
                            closeDropdown(dropdown, trigger);
                            break;
                    }
                });
            });

            // Close on mouse leave
            dropdown.addEventListener('mouseleave', () => {
                closeDropdown(dropdown, trigger);
            });

            // Open on mouse enter
            dropdown.addEventListener('mouseenter', () => {
                openDropdown(dropdown, trigger);
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-item.has-dropdown')) {
                closeAllDropdowns();
            }
        });
    }

    function toggleDropdown(dropdown, trigger) {
        const isOpen = dropdown.classList.contains(NAV_CONFIG.openClass);
        closeAllDropdowns();
        if (!isOpen) {
            openDropdown(dropdown, trigger);
        }
    }

    function openDropdown(dropdown, trigger) {
        dropdown.classList.add(NAV_CONFIG.openClass);
        trigger.setAttribute('aria-expanded', 'true');
    }

    function closeDropdown(dropdown, trigger) {
        dropdown.classList.remove(NAV_CONFIG.openClass);
        trigger.setAttribute('aria-expanded', 'false');
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.nav-item.has-dropdown').forEach(dropdown => {
            const trigger = dropdown.querySelector('.nav-link');
            closeDropdown(dropdown, trigger);
        });
    }

    // ========================================
    // LANGUAGE SELECTOR
    // ========================================

    function initLangSelector() {
        const langSelector = document.querySelector('.lang-selector');
        if (!langSelector) return;

        const trigger = langSelector.querySelector('.lang-btn-trigger');
        const dropdown = langSelector.querySelector('.lang-dropdown');
        const options = langSelector.querySelectorAll('.lang-option');

        if (!trigger || !dropdown) return;

        // Set ARIA attributes
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-haspopup', 'listbox');
        dropdown.setAttribute('role', 'listbox');
        options.forEach(opt => opt.setAttribute('role', 'option'));

        // Click handler
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLangSelector(langSelector, trigger);
        });

        // Keyboard handlers
        trigger.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    toggleLangSelector(langSelector, trigger);
                    if (langSelector.classList.contains(NAV_CONFIG.openClass)) {
                        options[0]?.focus();
                    }
                    break;
                case 'Escape':
                    closeLangSelector(langSelector, trigger);
                    break;
            }
        });

        // Option keyboard navigation
        options.forEach((option, index) => {
            option.setAttribute('tabindex', '0');

            option.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        options[index + 1]?.focus() || options[0].focus();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        options[index - 1]?.focus() || options[options.length - 1].focus();
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        option.click();
                        closeLangSelector(langSelector, trigger);
                        trigger.focus();
                        break;
                    case 'Escape':
                        closeLangSelector(langSelector, trigger);
                        trigger.focus();
                        break;
                }
            });

            option.addEventListener('click', () => {
                closeLangSelector(langSelector, trigger);
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!langSelector.contains(e.target)) {
                closeLangSelector(langSelector, trigger);
            }
        });
    }

    function toggleLangSelector(selector, trigger) {
        const isOpen = selector.classList.contains(NAV_CONFIG.openClass);
        if (isOpen) {
            closeLangSelector(selector, trigger);
        } else {
            openLangSelector(selector, trigger);
        }
    }

    function openLangSelector(selector, trigger) {
        selector.classList.add(NAV_CONFIG.openClass);
        trigger.setAttribute('aria-expanded', 'true');
    }

    function closeLangSelector(selector, trigger) {
        selector.classList.remove(NAV_CONFIG.openClass);
        trigger.setAttribute('aria-expanded', 'false');
    }

    // ========================================
    // MOBILE NAVIGATION
    // ========================================

    let focusTrapCleanup = null;
    let previousActiveElement = null;

    function initMobileNav() {
        const { mobileNav, mobileOverlay, mobileToggle } = getElements();

        if (!mobileToggle) return;

        mobileToggle.addEventListener('click', toggleMobileNav);
        mobileOverlay?.addEventListener('click', closeMobileNav);

        // Close button inside mobile nav
        const closeBtn = mobileNav?.querySelector('.mobile-nav-close');
        closeBtn?.addEventListener('click', closeMobileNav);

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileNav?.classList.contains(NAV_CONFIG.showClass)) {
                closeMobileNav();
            }
        });

        // Handle link clicks
        mobileNav?.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', () => {
                closeMobileNav();
            });
        });
    }

    function toggleMobileNav() {
        const { mobileNav } = getElements();
        if (mobileNav?.classList.contains(NAV_CONFIG.showClass)) {
            closeMobileNav();
        } else {
            openMobileNav();
        }
    }

    function openMobileNav() {
        const { mobileNav, mobileOverlay, mobileToggle } = getElements();

        if (!mobileNav) return;

        previousActiveElement = document.activeElement;

        mobileNav.classList.add(NAV_CONFIG.showClass);
        mobileOverlay?.classList.add(NAV_CONFIG.showClass);
        mobileToggle?.setAttribute('aria-expanded', 'true');

        document.body.style.overflow = 'hidden';

        // Focus first focusable element
        const firstFocusable = mobileNav.querySelector('a, button');
        firstFocusable?.focus();

        // Trap focus
        focusTrapCleanup = trapFocus(mobileNav);
    }

    function closeMobileNav() {
        const { mobileNav, mobileOverlay, mobileToggle } = getElements();

        mobileNav?.classList.remove(NAV_CONFIG.showClass);
        mobileOverlay?.classList.remove(NAV_CONFIG.showClass);
        mobileToggle?.setAttribute('aria-expanded', 'false');

        document.body.style.overflow = '';

        // Restore focus
        previousActiveElement?.focus();

        // Clean up focus trap
        focusTrapCleanup?.();
        focusTrapCleanup = null;
    }

    // Global function for legacy onclick handlers
    window.toggleMobileMenu = toggleMobileNav;
    window.closeMobileMenu = closeMobileNav;

    // ========================================
    // ACTIVE STATE MANAGEMENT
    // ========================================

    function setActiveStates() {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;

        // Reset all active states
        document.querySelectorAll('.nav-link, .nav-dropdown-link, .mobile-nav-link').forEach(link => {
            link.classList.remove(NAV_CONFIG.activeClass);
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove(NAV_CONFIG.activeClass);
        });

        // Set active based on path
        document.querySelectorAll('.nav-link, .nav-dropdown-link, .mobile-nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            // Handle hash links on same page
            if (href.startsWith('#') && currentHash === href) {
                link.classList.add(NAV_CONFIG.activeClass);
                link.closest('.nav-item')?.classList.add(NAV_CONFIG.activeClass);
            }

            // Handle path links
            if (href.startsWith('/') || href.startsWith('http')) {
                const linkPath = new URL(href, window.location.origin).pathname;
                if (linkPath === currentPath ||
                    (currentPath.endsWith('.html') && linkPath === currentPath.replace('.html', '')) ||
                    (linkPath.endsWith('.html') && currentPath === linkPath.replace('.html', ''))) {
                    link.classList.add(NAV_CONFIG.activeClass);
                    link.closest('.nav-item')?.classList.add(NAV_CONFIG.activeClass);
                }
            }
        });
    }

    // ========================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ========================================

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href === '#') return;

                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const offset = NAV_CONFIG.scrollOffset;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });

                    // Update URL without triggering scroll
                    history.pushState(null, null, href);

                    // Update active state
                    setTimeout(setActiveStates, 100);
                }
            });
        });
    }

    // ========================================
    // STICKY HEADER SCROLL BEHAVIOR
    // ========================================

    function initStickyHeader() {
        const header = document.querySelector(NAV_CONFIG.headerSelector);
        if (!header) return;

        let lastScrollY = window.scrollY;
        let ticking = false;

        function updateHeader() {
            const currentScrollY = window.scrollY;

            if (currentScrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }

            lastScrollY = currentScrollY;
            ticking = false;
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateHeader);
                ticking = true;
            }
        }, { passive: true });
    }

    // ========================================
    // UPDATE FLAG DISPLAY
    // ========================================

    function updateCurrentFlag(lang) {
        const flagContainer = document.querySelector('.lang-btn-trigger .current-flag');
        if (!flagContainer) return;

        const flags = {
            en: '<svg viewBox="0 0 60 40"><rect fill="#012169" width="60" height="40"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="6"/></svg>',
            pl: '<svg viewBox="0 0 60 40"><rect fill="#fff" width="60" height="20"/><rect fill="#DC143C" y="20" width="60" height="20"/></svg>',
            fr: '<svg viewBox="0 0 60 40"><rect fill="#002395" width="20" height="40"/><rect fill="#fff" x="20" width="20" height="40"/><rect fill="#ED2939" x="40" width="20" height="40"/></svg>',
            de: '<svg viewBox="0 0 60 40"><rect fill="#000" width="60" height="13.33"/><rect fill="#DD0000" y="13.33" width="60" height="13.33"/><rect fill="#FFCE00" y="26.66" width="60" height="13.34"/></svg>'
        };

        if (flags[lang]) {
            flagContainer.outerHTML = `<span class="current-flag">${flags[lang]}</span>`;
        }

        // Update active state on options
        document.querySelectorAll('.lang-option, .mobile-lang-btn').forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.lang === lang) {
                opt.classList.add('active');
            }
        });
    }

    // Global function for language switching
    window.setNavLang = function(lang) {
        updateCurrentFlag(lang);
        // Call the existing i18n setLang if available
        if (typeof window.setLang === 'function') {
            window.setLang(lang);
        }
    };

    // ========================================
    // BACK TO TOP BUTTON
    // ========================================

    function initBackToTop() {
        // Check if button already exists
        if (document.querySelector('.back-to-top')) return;

        // Create the button
        const button = document.createElement('button');
        button.className = 'back-to-top';
        button.setAttribute('aria-label', 'Back to top');
        button.setAttribute('type', 'button');
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
        `;

        // Append to body
        document.body.appendChild(button);

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Scroll threshold (300px)
        const SCROLL_THRESHOLD = 300;

        // Track visibility state
        let isVisible = false;

        // Handle scroll - show/hide button
        function handleScroll() {
            const scrollY = window.scrollY || window.pageYOffset;
            const shouldBeVisible = scrollY > SCROLL_THRESHOLD;

            if (shouldBeVisible !== isVisible) {
                isVisible = shouldBeVisible;
                button.classList.toggle('visible', isVisible);
            }
        }

        // Scroll to top on click
        function scrollToTop() {
            // Try to find the header with id="site-header" first, fallback to .site-header
            const header = document.getElementById('site-header') ||
                          document.querySelector('.site-header');

            const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

            if (header) {
                // Scroll to header
                header.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
            } else {
                // Fallback: scroll to top of page
                window.scrollTo({
                    top: 0,
                    behavior: scrollBehavior
                });
            }

            // Focus the header or first focusable element for accessibility
            if (header) {
                header.setAttribute('tabindex', '-1');
                header.focus({ preventScroll: true });
            }
        }

        // Event listeners
        window.addEventListener('scroll', handleScroll, { passive: true });
        button.addEventListener('click', scrollToTop);

        // Initial check
        handleScroll();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        initDropdowns();
        initLangSelector();
        initMobileNav();
        initSmoothScroll();
        initStickyHeader();
        initBackToTop();
        setActiveStates();

        // Update active states on hash change
        window.addEventListener('hashchange', setActiveStates);

        // Set initial language flag
        const currentLang = localStorage.getItem('preferredLang') ||
                           document.documentElement.lang ||
                           'en';
        updateCurrentFlag(currentLang);
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
