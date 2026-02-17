/**
 * Universal Language Selector Component
 * Works with both T (legacy) and new i18n system
 */

// Language configuration
const LANGUAGES = {
    en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
    fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
    de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' }
};

const LANGUAGE_ORDER = ['en', 'fr', 'pl', 'de'];

/**
 * Create language selector HTML structure
 */
function createLanguageSelector(containerId, options = {}) {
    const { 
        style = 'dropdown', // 'dropdown' or 'buttons'
        showFlags = true,
        compact = false 
    } = options;
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Language selector container ${containerId} not found`);
        return;
    }
    
    const currentLang = (typeof T !== 'undefined') ? T.getLanguage() : 'en';
    
    if (style === 'dropdown') {
        container.innerHTML = createDropdownHTML(currentLang, showFlags, compact);
        initDropdownEvents(container);
    } else if (style === 'buttons') {
        container.innerHTML = createButtonsHTML(currentLang, showFlags, compact);
        initButtonEvents(container);
    }
    
    // Update display
    updateLanguageDisplay(container, currentLang);
}

/**
 * Create dropdown style HTML
 */
function createDropdownHTML(currentLang, showFlags, compact) {
    const currentLangData = LANGUAGES[currentLang];
    
    return `
        <div class="lang-dropdown" id="langDropdown">
            <button class="lang-dropdown-btn" onclick="toggleLangDropdown(event)" aria-haspopup="true" aria-expanded="false">
                ${showFlags ? `<span class="flag">${currentLangData.flag}</span>` : ''}
                <span class="lang-name">${compact ? currentLang.toUpperCase() : currentLangData.nativeName}</span>
                <span class="arrow">▼</span>
            </button>
            <div class="lang-dropdown-menu" role="menu" aria-label="Select language">
                ${LANGUAGE_ORDER.map(lang => {
                    const langData = LANGUAGES[lang];
                    const isActive = lang === currentLang;
                    return `
                        <div class="lang-option ${isActive ? 'active' : ''}" 
                             data-lang="${lang}" 
                             onclick="setLang('${lang}')" 
                             role="menuitem"
                             ${isActive ? 'aria-selected="true"' : ''}>
                            ${showFlags ? `<img src="data:image/svg+xml;base64,${getFlagSVG(lang)}" alt="${langData.name} flag" class="flag-img" data-lang="${lang}">` : `<span class="flag">${langData.flag}</span>`}
                            <span class="lang-text">${langData.nativeName}</span>
                            ${isActive ? '<span class="check">✓</span>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <style>
        .lang-dropdown {
            position: relative;
            display: inline-block;
        }
        
        .lang-dropdown-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            background: var(--bg-secondary, #1a1a1b);
            border: 1px solid var(--border-color, #333);
            border-radius: 0.5rem;
            color: var(--text-primary, #fff);
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            font-family: inherit;
        }
        
        .lang-dropdown-btn:hover {
            border-color: var(--accent-color, #d4a853);
            background: var(--bg-tertiary, #222);
        }
        
        .lang-dropdown-btn:focus {
            outline: none;
            border-color: var(--accent-color, #d4a853);
            box-shadow: 0 0 0 2px rgba(212, 168, 83, 0.2);
        }
        
        .lang-dropdown-btn .flag {
            font-size: 1.2rem;
            line-height: 1;
        }
        
        .lang-dropdown-btn .arrow {
            margin-left: 0.25rem;
            transition: transform 0.2s ease;
            font-size: 0.75rem;
        }
        
        .lang-dropdown.open .lang-dropdown-btn .arrow {
            transform: rotate(180deg);
        }
        
        .lang-dropdown-menu {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 0.5rem;
            min-width: 160px;
            background: var(--bg-secondary, #1a1a1b);
            border: 1px solid var(--border-color, #333);
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all 0.2s ease;
            overflow: hidden;
        }
        
        .lang-dropdown.open .lang-dropdown-menu {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        
        .lang-option {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.625rem 1rem;
            cursor: pointer;
            transition: background 0.15s ease;
            color: var(--text-primary, #fff);
        }
        
        .lang-option:hover {
            background: var(--bg-tertiary, #222);
        }
        
        .lang-option.active {
            background: var(--accent-color-dim, rgba(212, 168, 83, 0.1));
            color: var(--accent-color, #d4a853);
        }
        
        .lang-option .flag {
            font-size: 1.2rem;
            line-height: 1;
        }
        
        .flag-img {
            width: 24px;
            height: 18px;
            object-fit: cover;
            border-radius: 2px;
        }
        
        .lang-option .lang-text {
            flex: 1;
            font-size: 0.875rem;
        }
        
        .lang-option .check {
            opacity: 0;
            transition: opacity 0.15s ease;
            color: var(--accent-color, #d4a853);
        }
        
        .lang-option.active .check {
            opacity: 1;
        }
        </style>
    `;
}

/**
 * Create button style HTML
 */
function createButtonsHTML(currentLang, showFlags, compact) {
    return `
        <div class="lang-buttons">
            ${LANGUAGE_ORDER.map(lang => {
                const langData = LANGUAGES[lang];
                const isActive = lang === currentLang;
                return `
                    <button class="lang-btn ${isActive ? 'active' : ''}" 
                            data-lang="${lang}" 
                            onclick="setLang('${lang}')"
                            title="${langData.name}"
                            aria-pressed="${isActive}">
                        ${showFlags ? langData.flag : lang.toUpperCase()}
                    </button>
                `;
            }).join('')}
        </div>
        
        <style>
        .lang-buttons {
            display: flex;
            gap: 0.25rem;
            flex-wrap: wrap;
        }
        
        .lang-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 32px;
            border: 1px solid var(--border-color, #333);
            background: var(--bg-secondary, #1a1a1b);
            color: var(--text-primary, #fff);
            border-radius: 6px;
            cursor: pointer;
            font-size: ${showFlags ? '1.1rem' : '0.75rem'};
            font-weight: ${showFlags ? 'normal' : '600'};
            transition: all 0.2s ease;
        }
        
        .lang-btn:hover {
            border-color: var(--accent-color, #d4a853);
            transform: scale(1.05);
        }
        
        .lang-btn:focus {
            outline: none;
            border-color: var(--accent-color, #d4a853);
            box-shadow: 0 0 0 2px rgba(212, 168, 83, 0.2);
        }
        
        .lang-btn.active {
            border-color: var(--accent-color, #d4a853);
            background: rgba(212, 168, 83, 0.1);
            color: var(--accent-color, #d4a853);
        }
        </style>
    `;
}

/**
 * Initialize dropdown events
 */
function initDropdownEvents(container) {
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        const dropdown = container.querySelector('.lang-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
            const btn = dropdown.querySelector('.lang-dropdown-btn');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Keyboard navigation
    const dropdown = container.querySelector('.lang-dropdown');
    if (dropdown) {
        dropdown.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                dropdown.classList.remove('open');
                const btn = dropdown.querySelector('.lang-dropdown-btn');
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                    btn.focus();
                }
            }
        });
    }
}

/**
 * Initialize button events
 */
function initButtonEvents(container) {
    // Keyboard navigation for buttons
    const buttons = container.querySelectorAll('.lang-btn');
    buttons.forEach((btn, index) => {
        btn.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const direction = e.key === 'ArrowLeft' ? -1 : 1;
                const nextIndex = (index + direction + buttons.length) % buttons.length;
                buttons[nextIndex].focus();
            }
        });
    });
}

/**
 * Toggle dropdown open/closed
 */
function toggleLangDropdown(event) {
    if (event) event.stopPropagation();
    
    const dropdown = document.querySelector('.lang-dropdown');
    if (dropdown) {
        const isOpen = dropdown.classList.contains('open');
        dropdown.classList.toggle('open');
        
        const btn = dropdown.querySelector('.lang-dropdown-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', !isOpen);
        }
    }
}

/**
 * Set language
 */
function setLang(lang) {
    if (!LANGUAGES[lang]) return;
    
    // Use appropriate i18n system
    if (typeof T !== 'undefined') {
        T.setLanguage(lang);
        T.updatePage();
    }
    
    if (typeof window.i18n !== 'undefined') {
        window.i18n.setLang(lang);
    }
    
    // Update all language selectors on the page
    document.querySelectorAll('.lang-dropdown, .lang-buttons').forEach(container => {
        updateLanguageDisplay(container.parentElement, lang);
    });
    
    // Close dropdown
    const dropdown = document.querySelector('.lang-dropdown');
    if (dropdown) {
        dropdown.classList.remove('open');
        const btn = dropdown.querySelector('.lang-dropdown-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    
    // Store preference
    localStorage.setItem('fae_language', lang);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
}

/**
 * Update language display
 */
function updateLanguageDisplay(container, lang) {
    // Update dropdown button
    const dropdownBtn = container.querySelector('.lang-dropdown-btn');
    if (dropdownBtn) {
        const flag = dropdownBtn.querySelector('.flag');
        const langName = dropdownBtn.querySelector('.lang-name');
        
        if (flag) flag.textContent = LANGUAGES[lang].flag;
        if (langName) langName.textContent = LANGUAGES[lang].nativeName;
    }
    
    // Update active states
    container.querySelectorAll('.lang-option, .lang-btn').forEach(option => {
        const isActive = option.dataset.lang === lang;
        option.classList.toggle('active', isActive);
        
        if (option.hasAttribute('aria-pressed')) {
            option.setAttribute('aria-pressed', isActive);
        }
        if (option.hasAttribute('aria-selected')) {
            option.setAttribute('aria-selected', isActive);
        }
    });
}

/**
 * Simple flag SVG generator (placeholder)
 */
function getFlagSVG(lang) {
    // For now, we'll use emoji flags, but this could be replaced with actual SVG flags
    return btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18" viewBox="0 0 24 18">
        <text x="12" y="14" text-anchor="middle" font-size="14">${LANGUAGES[lang].flag}</text>
    </svg>`);
}

// Export functions to global scope
window.createLanguageSelector = createLanguageSelector;
window.toggleLangDropdown = toggleLangDropdown;
window.setLang = setLang;

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize common selectors
    if (document.getElementById('locale-selector-nav')) {
        createLanguageSelector('locale-selector-nav', { style: 'dropdown', compact: true });
    }
    
    if (document.getElementById('locale-selector-dashboard')) {
        createLanguageSelector('locale-selector-dashboard', { style: 'dropdown', compact: false });
    }
    
    if (document.getElementById('locale-selector-mobile')) {
        createLanguageSelector('locale-selector-mobile', { style: 'buttons' });
    }
});