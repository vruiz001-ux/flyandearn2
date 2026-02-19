/**
 * Mobile UX Enhancements for FlyAndEarn
 * Handles touch interactions, gestures, and mobile-specific functionality
 */

(function() {
    'use strict';

    // Mobile detection
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Touch interaction enhancements
    class MobileEnhancements {
        constructor() {
            this.init();
        }

        init() {
            this.setupTouchFeedback();
            this.setupPullToRefresh();
            this.setupSwipeGestures();
            this.setupLongPress();
            this.setupKeyboardOptimizations();
            this.setupNavigationEnhancements();
        }

        // Enhanced touch feedback for buttons
        setupTouchFeedback() {
            if (!isTouchDevice) return;

            const touchElements = document.querySelectorAll('.btn, .category-card, .request-card, .mobile-nav-link');
            
            touchElements.forEach(element => {
                element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
                element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
                element.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: true });
            });
        }

        handleTouchStart(event) {
            const element = event.currentTarget;
            element.classList.add('touch-active');
            
            // Add ripple effect
            const ripple = document.createElement('div');
            ripple.className = 'touch-ripple';
            
            const rect = element.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = event.touches[0].clientX - rect.left - size / 2;
            const y = event.touches[0].clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(212, 168, 83, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple-animation 0.6s ease-out;
                pointer-events: none;
                z-index: 1;
            `;
            
            element.style.position = 'relative';
            element.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        }

        handleTouchEnd(event) {
            const element = event.currentTarget;
            element.classList.remove('touch-active');
        }

        // Pull-to-refresh functionality
        setupPullToRefresh() {
            if (!isMobile) return;

            let startY = 0;
            let currentY = 0;
            let isPulling = false;
            const threshold = 80;
            
            const refreshContainer = document.querySelector('.main-content') || document.body;
            const indicator = this.createPullIndicator();
            
            refreshContainer.addEventListener('touchstart', (e) => {
                if (window.scrollY === 0) {
                    startY = e.touches[0].pageY;
                    isPulling = true;
                }
            }, { passive: true });
            
            refreshContainer.addEventListener('touchmove', (e) => {
                if (!isPulling) return;
                
                currentY = e.touches[0].pageY;
                const pullDistance = Math.max(0, currentY - startY);
                
                if (pullDistance > 0 && window.scrollY === 0) {
                    e.preventDefault();
                    const progress = Math.min(pullDistance / threshold, 1);
                    this.updatePullIndicator(indicator, progress, pullDistance >= threshold);
                }
            }, { passive: false });
            
            refreshContainer.addEventListener('touchend', (e) => {
                if (!isPulling) return;
                
                const pullDistance = currentY - startY;
                if (pullDistance >= threshold) {
                    this.triggerRefresh();
                }
                
                this.resetPullIndicator(indicator);
                isPulling = false;
            }, { passive: true });
        }

        createPullIndicator() {
            const indicator = document.createElement('div');
            indicator.className = 'pull-refresh-indicator';
            indicator.innerHTML = `
                <div class="pull-spinner">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="60" />
                    </svg>
                </div>
            `;
            indicator.style.cssText = `
                position: fixed;
                top: -60px;
                left: 50%;
                transform: translateX(-50%);
                width: 40px;
                height: 40px;
                background: var(--accent-gold);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                transition: all 0.2s ease;
                color: #000;
            `;
            
            document.body.appendChild(indicator);
            return indicator;
        }

        updatePullIndicator(indicator, progress, shouldRefresh) {
            const translateY = Math.min(progress * 60, 60);
            indicator.style.transform = `translateX(-50%) translateY(${translateY}px)`;
            indicator.style.opacity = progress;
            
            if (shouldRefresh) {
                indicator.classList.add('ready-to-refresh');
                indicator.querySelector('.pull-spinner svg circle').style.strokeDashoffset = '0';
            } else {
                indicator.classList.remove('ready-to-refresh');
                indicator.querySelector('.pull-spinner svg circle').style.strokeDashoffset = `${60 - (progress * 60)}`;
            }
        }

        resetPullIndicator(indicator) {
            indicator.style.transform = 'translateX(-50%) translateY(-60px)';
            indicator.style.opacity = '0';
            indicator.classList.remove('ready-to-refresh');
        }

        triggerRefresh() {
            // Trigger page refresh or data reload
            console.log('Pull-to-refresh triggered');
            window.location.reload();
        }

        // Swipe gesture handling
        setupSwipeGestures() {
            if (!isTouchDevice) return;

            const swipeElements = document.querySelectorAll('.categories-scroll, .requests-grid');
            
            swipeElements.forEach(element => {
                let startX = 0;
                let startY = 0;
                let isScrolling = false;
                
                element.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].pageX;
                    startY = e.touches[0].pageY;
                    isScrolling = false;
                }, { passive: true });
                
                element.addEventListener('touchmove', (e) => {
                    if (!startX || !startY) return;
                    
                    const diffX = Math.abs(e.touches[0].pageX - startX);
                    const diffY = Math.abs(e.touches[0].pageY - startY);
                    
                    if (diffX > diffY && diffX > 10) {
                        isScrolling = true;
                        // Horizontal scroll - allow default behavior
                    }
                }, { passive: true });
                
                element.addEventListener('touchend', () => {
                    startX = 0;
                    startY = 0;
                    isScrolling = false;
                }, { passive: true });
            });
        }

        // Long press functionality
        setupLongPress() {
            if (!isTouchDevice) return;

            const longPressElements = document.querySelectorAll('.category-card, .request-card');
            
            longPressElements.forEach(element => {
                let pressTimer = null;
                
                element.addEventListener('touchstart', (e) => {
                    pressTimer = setTimeout(() => {
                        this.showLongPressMenu(element, e.touches[0]);
                    }, 500);
                }, { passive: true });
                
                element.addEventListener('touchend', () => {
                    clearTimeout(pressTimer);
                }, { passive: true });
                
                element.addEventListener('touchmove', () => {
                    clearTimeout(pressTimer);
                }, { passive: true });
            });
        }

        showLongPressMenu(element, touch) {
            // Provide haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            const menu = document.createElement('div');
            menu.className = 'long-press-menu show';
            menu.innerHTML = `
                <div class="long-press-item" data-action="favorite">
                    <span>⭐</span> Add to Favorites
                </div>
                <div class="long-press-item" data-action="share">
                    <span>📤</span> Share
                </div>
                <div class="long-press-item" data-action="details">
                    <span>ℹ️</span> View Details
                </div>
            `;
            
            menu.style.left = `${touch.pageX}px`;
            menu.style.top = `${touch.pageY}px`;
            
            document.body.appendChild(menu);
            
            // Handle menu item clicks
            menu.addEventListener('click', (e) => {
                const action = e.target.closest('.long-press-item')?.dataset.action;
                if (action) {
                    this.handleLongPressAction(element, action);
                }
                menu.remove();
            });
            
            // Remove menu on outside click/touch
            setTimeout(() => {
                document.addEventListener('touchstart', function onTouch() {
                    menu.remove();
                    document.removeEventListener('touchstart', onTouch);
                }, { once: true });
            }, 100);
        }

        handleLongPressAction(element, action) {
            console.log('Long press action:', action, 'on element:', element);
            // Implement specific actions based on the element and action
        }

        // Keyboard optimizations for mobile
        setupKeyboardOptimizations() {
            if (!isMobile) return;

            const inputs = document.querySelectorAll('input, textarea');
            
            inputs.forEach(input => {
                input.addEventListener('focus', () => {
                    // Prevent layout jumping when keyboard appears
                    setTimeout(() => {
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                });
                
                // Add appropriate keyboard types
                if (input.type === 'email') {
                    input.setAttribute('inputmode', 'email');
                    input.setAttribute('autocomplete', 'email');
                }
                
                if (input.type === 'tel') {
                    input.setAttribute('inputmode', 'tel');
                    input.setAttribute('autocomplete', 'tel');
                }
                
                if (input.name && input.name.includes('price') || input.name.includes('amount')) {
                    input.setAttribute('inputmode', 'decimal');
                }
            });

            // Handle viewport changes when keyboard appears/disappears
            window.addEventListener('resize', this.handleViewportChange);
        }

        handleViewportChange() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }

        // Enhanced mobile navigation
        setupNavigationEnhancements() {
            const mobileToggle = document.querySelector('.mobile-menu-toggle');
            const mobileNav = document.querySelector('.mobile-nav');
            const mobileOverlay = document.querySelector('.mobile-nav-overlay');
            
            if (!mobileToggle || !mobileNav) return;

            // Enhanced toggle animation
            mobileToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const isOpen = mobileNav.classList.contains('show');
                
                if (isOpen) {
                    this.closeMobileNav();
                } else {
                    this.openMobileNav();
                }
            });

            // Close on overlay click
            if (mobileOverlay) {
                mobileOverlay.addEventListener('click', () => {
                    this.closeMobileNav();
                });
            }

            // Close on swipe right
            if (mobileNav) {
                let startX = 0;
                
                mobileNav.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].pageX;
                }, { passive: true });
                
                mobileNav.addEventListener('touchmove', (e) => {
                    const currentX = e.touches[0].pageX;
                    const diffX = currentX - startX;
                    
                    if (diffX > 100) {
                        this.closeMobileNav();
                    }
                }, { passive: true });
            }
        }

        openMobileNav() {
            const mobileToggle = document.querySelector('.mobile-menu-toggle');
            const mobileNav = document.querySelector('.mobile-nav');
            const mobileOverlay = document.querySelector('.mobile-nav-overlay');
            
            mobileToggle?.setAttribute('aria-expanded', 'true');
            mobileNav?.classList.add('show');
            mobileOverlay?.classList.add('show');
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        }

        closeMobileNav() {
            const mobileToggle = document.querySelector('.mobile-menu-toggle');
            const mobileNav = document.querySelector('.mobile-nav');
            const mobileOverlay = document.querySelector('.mobile-nav-overlay');
            
            mobileToggle?.setAttribute('aria-expanded', 'false');
            mobileNav?.classList.remove('show');
            mobileOverlay?.classList.remove('show');
            
            // Restore body scroll
            document.body.style.overflow = '';
            
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        }
    }

    // CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple-animation {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
        
        .touch-active {
            transform: scale(0.98);
        }
        
        .ready-to-refresh .pull-spinner svg circle {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        /* CSS custom properties for dynamic viewport height */
        :root {
            --vh: 1vh;
        }
        
        .full-height {
            height: calc(var(--vh, 1vh) * 100);
        }
    `;
    document.head.appendChild(style);

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new MobileEnhancements());
    } else {
        new MobileEnhancements();
    }

})();