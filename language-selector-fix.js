// Language Selector Fix - Missing JavaScript Functions

// Toggle language dropdown
function toggleLangDropdown(event) {
    if (event) event.stopPropagation();
    
    const langSelector = document.getElementById('langDropdown');
    if (!langSelector) return;
    
    const isOpen = langSelector.classList.contains('open');
    
    // Close all dropdowns first
    document.querySelectorAll('.lang-selector.open').forEach(dropdown => {
        dropdown.classList.remove('open');
    });
    
    // Toggle current dropdown
    if (!isOpen) {
        langSelector.classList.add('open');
        const btn = langSelector.querySelector('.lang-btn-trigger');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
        const btn = langSelector.querySelector('.lang-btn-trigger');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

// Set language and update UI
function setLang(lang) {
    console.log('Setting language to:', lang);
    
    // Store preference
    localStorage.setItem('fae_language', lang);
    
    // Update page language attribute
    document.documentElement.lang = lang;
    
    // Use existing i18n system if available
    if (typeof T !== 'undefined' && T.setLanguage) {
        T.setLanguage(lang);
        if (T.updatePage) T.updatePage();
    }
    
    if (typeof window.i18n !== 'undefined' && window.i18n.setLang) {
        window.i18n.setLang(lang);
    }
    
    // Update all language selector displays
    updateLanguageSelectors(lang);
    
    // Close dropdown
    const langSelector = document.getElementById('langDropdown');
    if (langSelector) {
        langSelector.classList.remove('open');
        const btn = langSelector.querySelector('.lang-btn-trigger');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('languageChanged', { 
        detail: { language: lang } 
    }));
    
    // Show success message
    const message = getLanguageLabel(lang);
    if (typeof showToast !== 'undefined') {
        showToast(`Language changed to ${message}`, 'success');
    }
}

// Update language selector displays
function updateLanguageSelectors(lang) {
    const langData = {
        en: { name: 'English', flag: 'GB' },
        pl: { name: 'Polski', flag: 'PL' },
        fr: { name: 'Français', flag: 'FR' },
        de: { name: 'Deutsch', flag: 'DE' }
    };
    
    // Update desktop selector
    const desktopOptions = document.querySelectorAll('.lang-option');
    desktopOptions.forEach(option => {
        const isActive = option.dataset.lang === lang;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    
    // Update mobile selector
    const mobileOptions = document.querySelectorAll('.mobile-lang-btn');
    mobileOptions.forEach(option => {
        const isActive = option.dataset.lang === lang;
        option.classList.toggle('active', isActive);
    });
}

// Get language display label
function getLanguageLabel(lang) {
    const labels = {
        en: 'English',
        pl: 'Polski', 
        fr: 'Français',
        de: 'Deutsch'
    };
    return labels[lang] || lang.toUpperCase();
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.lang-selector')) {
        document.querySelectorAll('.lang-selector.open').forEach(dropdown => {
            dropdown.classList.remove('open');
            const btn = dropdown.querySelector('.lang-btn-trigger');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        });
    }
});

// Initialize language from localStorage or browser
function initializeLanguage() {
    const savedLang = localStorage.getItem('fae_language');
    const browserLang = navigator.language.split('-')[0];
    const supportedLangs = ['en', 'pl', 'fr', 'de'];
    
    let initialLang = 'en'; // default
    
    if (savedLang && supportedLangs.includes(savedLang)) {
        initialLang = savedLang;
    } else if (supportedLangs.includes(browserLang)) {
        initialLang = browserLang;
    }
    
    // Update selectors to show correct initial state
    updateLanguageSelectors(initialLang);
    
    // Set document language
    document.documentElement.lang = initialLang;
    
    return initialLang;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    const currentLang = initializeLanguage();
    console.log('Language selector initialized with:', currentLang);
});

// Handle keyboard navigation
document.addEventListener('keydown', function(e) {
    const langSelector = document.getElementById('langDropdown');
    if (!langSelector || !langSelector.classList.contains('open')) return;
    
    if (e.key === 'Escape') {
        langSelector.classList.remove('open');
        const btn = langSelector.querySelector('.lang-btn-trigger');
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.focus();
        }
    }
});

// Export functions to global scope
window.toggleLangDropdown = toggleLangDropdown;
window.setLang = setLang;
window.updateLanguageSelectors = updateLanguageSelectors;