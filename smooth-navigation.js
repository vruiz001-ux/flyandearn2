/**
 * Smooth Navigation & SPA-like Experience
 * Makes multi-page navigation feel seamless
 */

// Page load animation
document.addEventListener('DOMContentLoaded', function() {
    // Add loaded class to trigger animation
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 50);

    // Initialize smooth navigation features
    initStickyHeader();
    initBreadcrumbs();
    initRelatedPages();
    initSmoothLinks();
});

/**
 * Initialize sticky header behavior
 */
function initStickyHeader() {
    const header = document.querySelector('.site-header, header');
    if (!header) return;

    let lastScrollY = window.scrollY;
    
    function updateHeader() {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScrollY = currentScrollY;
    }
    
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader(); // Initial call
}

/**
 * Initialize breadcrumbs based on current page
 */
function initBreadcrumbs() {
    const breadcrumbContainer = document.getElementById('breadcrumbs');
    if (!breadcrumbContainer) return;

    const path = window.location.pathname;
    const breadcrumbs = generateBreadcrumbs(path);
    
    if (breadcrumbs.length > 1) {
        breadcrumbContainer.innerHTML = `
            <div class="breadcrumbs">
                <nav aria-label="Breadcrumb">
                    <ol class="breadcrumb-list">
                        ${breadcrumbs.map((crumb, index) => {
                            const isLast = index === breadcrumbs.length - 1;
                            return `
                                <li class="breadcrumb-item">
                                    ${isLast ? 
                                        `<span class="breadcrumb-current">${crumb.title}</span>` :
                                        `<a href="${crumb.url}" class="breadcrumb-link">${crumb.title}</a>`
                                    }
                                    ${!isLast ? '<span class="breadcrumb-separator">›</span>' : ''}
                                </li>
                            `;
                        }).join('')}
                    </ol>
                </nav>
            </div>
        `;
    }
}

/**
 * Generate breadcrumbs based on current path
 */
function generateBreadcrumbs(path) {
    const breadcrumbs = [
        { title: 'Home', url: '/' }
    ];

    // Remove trailing slash and split path
    const cleanPath = path.replace(/\/$/, '');
    const segments = cleanPath.split('/').filter(segment => segment.length > 0);

    // Page mappings
    const pageMap = {
        'about': { title: 'About', url: '/about' },
        'pricing': { title: 'Pricing', url: '/pricing' },
        'contact': { title: 'Contact', url: '/contact' },
        'faq': { title: 'FAQ', url: '/faq' },
        'dashboard': { title: 'Dashboard', url: '/dashboard' },
        'wallet': { title: 'Wallet', url: '/wallet' },
        'map': { title: 'Map', url: '/map' },
        'routes': { title: 'Routes', url: '/routes' },
        'privacy': { title: 'Privacy Policy', url: '/privacy' },
        'terms': { title: 'Terms of Service', url: '/terms' }
    };

    // Build breadcrumbs
    let currentPath = '';
    segments.forEach(segment => {
        currentPath += '/' + segment;
        
        if (pageMap[segment]) {
            breadcrumbs.push({
                title: pageMap[segment].title,
                url: currentPath
            });
        } else if (segment.includes('-')) {
            // Handle route pages like frankfurt-dubai
            const routeName = segment.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' → ');
            breadcrumbs.push({
                title: routeName,
                url: currentPath
            });
        }
    });

    return breadcrumbs;
}

/**
 * Initialize related pages section
 */
function initRelatedPages() {
    const relatedContainer = document.getElementById('related-pages');
    if (!relatedContainer) return;

    const path = window.location.pathname;
    const relatedPages = getRelatedPages(path);
    
    if (relatedPages.length > 0) {
        relatedContainer.innerHTML = `
            <section class="related-pages">
                <div class="related-pages-container">
                    <h2 class="related-pages-title" data-i18n="related.title">You might also like</h2>
                    <div class="related-pages-grid">
                        ${relatedPages.map(page => `
                            <a href="${page.url}" class="related-page-card">
                                <span class="related-page-icon">${page.icon}</span>
                                <h3 class="related-page-title" data-i18n="${page.titleKey}">${page.title}</h3>
                                <p class="related-page-description" data-i18n="${page.descKey}">${page.description}</p>
                                <span class="related-page-cta" data-i18n="${page.ctaKey}">${page.cta}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;

        // Apply translations if available
        if (typeof T !== 'undefined' && T.updatePage) {
            T.updatePage();
        }
    }
}

/**
 * Get related pages for current path
 */
function getRelatedPages(path) {
    const relatedMap = {
        '/about': [
            {
                url: '/pricing',
                icon: '💳',
                title: 'Pricing',
                titleKey: 'related.pricing.title',
                description: 'See our transparent fee structure and subscription plans.',
                descKey: 'related.pricing.desc',
                cta: 'View Pricing',
                ctaKey: 'related.pricing.cta'
            },
            {
                url: '/faq',
                icon: '❓',
                title: 'FAQ',
                titleKey: 'related.faq.title',
                description: 'Get answers to common questions about our service.',
                descKey: 'related.faq.desc',
                cta: 'Read FAQ',
                ctaKey: 'related.faq.cta'
            },
            {
                url: '/dashboard',
                icon: '🚀',
                title: 'Get Started',
                titleKey: 'related.dashboard.title',
                description: 'Join thousands of travelers and buyers already saving money.',
                descKey: 'related.dashboard.desc',
                cta: 'Start Now',
                ctaKey: 'related.dashboard.cta'
            }
        ],
        '/pricing': [
            {
                url: '/faq',
                icon: '❓',
                title: 'FAQ',
                titleKey: 'related.faq.title',
                description: 'Common questions about fees, payments, and service.',
                descKey: 'related.faq.desc',
                cta: 'Read FAQ',
                ctaKey: 'related.faq.cta'
            },
            {
                url: '/contact',
                icon: '📧',
                title: 'Contact Us',
                titleKey: 'related.contact.title',
                description: 'Have questions? Our team is here to help.',
                descKey: 'related.contact.desc',
                cta: 'Get in Touch',
                ctaKey: 'related.contact.cta'
            },
            {
                url: '/dashboard',
                icon: '✈️',
                title: 'Start Earning',
                titleKey: 'related.earn.title',
                description: 'Ready to start? Create your first trip or request.',
                descKey: 'related.earn.desc',
                cta: 'Join Now',
                ctaKey: 'related.earn.cta'
            }
        ],
        '/contact': [
            {
                url: '/faq',
                icon: '💡',
                title: 'FAQ',
                titleKey: 'related.faq.title',
                description: 'Find quick answers to common questions.',
                descKey: 'related.faq.desc',
                cta: 'Browse FAQ',
                ctaKey: 'related.faq.cta'
            },
            {
                url: '/about',
                icon: '🏢',
                title: 'About Us',
                titleKey: 'related.about.title',
                description: 'Learn about our mission and company story.',
                descKey: 'related.about.desc',
                cta: 'Our Story',
                ctaKey: 'related.about.cta'
            }
        ],
        '/faq': [
            {
                url: '/pricing',
                icon: '💰',
                title: 'Pricing',
                titleKey: 'related.pricing.title',
                description: 'Understand our fee structure and payment terms.',
                descKey: 'related.pricing.desc',
                cta: 'View Pricing',
                ctaKey: 'related.pricing.cta'
            },
            {
                url: '/contact',
                icon: '💬',
                title: 'Contact Support',
                titleKey: 'related.support.title',
                description: 'Still have questions? Reach out to our team.',
                descKey: 'related.support.desc',
                cta: 'Contact Us',
                ctaKey: 'related.support.cta'
            },
            {
                url: '/dashboard',
                icon: '🎯',
                title: 'Get Started',
                titleKey: 'related.start.title',
                description: 'Ready to begin? Join our marketplace today.',
                descKey: 'related.start.desc',
                cta: 'Start Now',
                ctaKey: 'related.start.cta'
            }
        ],
        '/privacy': [
            {
                url: '/terms',
                icon: '📋',
                title: 'Terms of Service',
                titleKey: 'related.terms.title',
                description: 'Review the rules and conditions for using our platform.',
                descKey: 'related.terms.desc',
                cta: 'Read Terms',
                ctaKey: 'related.terms.cta'
            },
            {
                url: '/contact',
                icon: '📧',
                title: 'Contact Us',
                titleKey: 'related.contact.title',
                description: 'Have privacy questions? Our team is here to help.',
                descKey: 'related.contact.desc',
                cta: 'Get in Touch',
                ctaKey: 'related.contact.cta'
            }
        ],
        '/terms': [
            {
                url: '/privacy',
                icon: '🔒',
                title: 'Privacy Policy',
                titleKey: 'related.privacy.title',
                description: 'Learn how we protect and handle your personal data.',
                descKey: 'related.privacy.desc',
                cta: 'Read Privacy Policy',
                ctaKey: 'related.privacy.cta'
            },
            {
                url: '/contact',
                icon: '💬',
                title: 'Legal Questions',
                titleKey: 'related.legal.title',
                description: 'Need clarification on our terms? Contact our legal team.',
                descKey: 'related.legal.desc',
                cta: 'Contact Us',
                ctaKey: 'related.legal.cta'
            }
        ]
    };

    return relatedMap[path] || [];
}

/**
 * Initialize smooth internal links
 */
function initSmoothLinks() {
    const internalLinks = document.querySelectorAll('a[href^="/"], a[href^="#"]');
    
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Handle hash links (same page)
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
                return;
            }
            
            // Handle internal page links with smooth transition
            if (href.startsWith('/') && !href.includes('.')) {
                // Optional: Add page transition overlay
                showPageTransition();
            }
        });
    });
}

/**
 * Show page transition overlay
 */
function showPageTransition() {
    // Create transition overlay if it doesn't exist
    let overlay = document.querySelector('.page-transition');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'page-transition';
        overlay.innerHTML = '<div class="page-transition-spinner"></div>';
        document.body.appendChild(overlay);
    }
    
    overlay.classList.add('active');
    
    // Hide after a short delay (page should be loading)
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 300);
}

/**
 * Add internal cross-links to content
 */
function enhanceContentWithCrossLinks() {
    const content = document.querySelector('main, .main-content, .container, article');
    if (!content) return;

    // Define cross-link opportunities
    const crossLinks = {
        'pricing': { url: '/pricing', text: 'pricing', title: 'Learn about our pricing' },
        'faq': { url: '/faq', text: 'FAQ', title: 'Frequently asked questions' },
        'contact': { url: '/contact', text: 'contact us', title: 'Get in touch with our team' },
        'about': { url: '/about', text: 'about us', title: 'Learn more about our company' },
        'dashboard': { url: '/dashboard', text: 'dashboard', title: 'Access your dashboard' }
    };

    // Add cross-links where natural (this is a simplified approach)
    // In production, you'd want more sophisticated text analysis
    Object.keys(crossLinks).forEach(key => {
        const link = crossLinks[key];
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        
        // Only add links if we're not already on that page
        if (!window.location.pathname.includes(link.url)) {
            content.innerHTML = content.innerHTML.replace(regex, 
                `<a href="${link.url}" class="cross-link" title="${link.title}">${link.text}</a>`
            );
        }
    });
}

/**
 * Smooth scroll to top function
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Expose functions globally
window.scrollToTop = scrollToTop;
window.showPageTransition = showPageTransition;

// Initialize cross-links after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(enhanceContentWithCrossLinks, 100);
});