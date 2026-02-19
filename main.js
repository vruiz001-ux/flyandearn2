// Optimized main entry point - replaces app.js and main-app.js
import { app } from './src/core/app.js';
import { performanceMonitor } from './src/core/performance.js';

// Critical CSS loading with preload hints
const criticalCSS = `
<link rel="preload" href="/assets/core.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<link rel="preload" href="/assets/fonts.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript>
    <link rel="stylesheet" href="/assets/core.css">
    <link rel="stylesheet" href="/assets/fonts.css">
</noscript>
`;

// Insert critical CSS
document.head.insertAdjacentHTML('beforeend', criticalCSS);

// Feature detection and polyfill loading
const loadPolyfills = async () => {
    const polyfills = [];
    
    // Intersection Observer for lazy loading
    if (!('IntersectionObserver' in window)) {
        polyfills.push(import('intersection-observer'));
    }
    
    // Web Animations API for smooth animations
    if (!('animate' in Element.prototype)) {
        polyfills.push(import('web-animations-js'));
    }
    
    // ResizeObserver for responsive components
    if (!('ResizeObserver' in window)) {
        polyfills.push(import('@juggle/resize-observer'));
    }
    
    if (polyfills.length > 0) {
        await Promise.all(polyfills);
        console.log(`Loaded ${polyfills.length} polyfills`);
    }
};

// Progressive enhancement strategy
const enhanceInterface = () => {
    // Add loading states
    document.body.classList.add('loading');
    
    // Show basic content immediately
    const main = document.querySelector('main');
    if (!main.innerHTML.trim()) {
        main.innerHTML = `
            <div class="hero">
                <div class="hero-content">
                    <h1>FlyAndEarn</h1>
                    <p>Save money on flights while helping others get what they need</p>
                    <div class="loading-spinner"></div>
                </div>
            </div>
        `;
    }
    
    // Add basic interactivity
    document.addEventListener('click', (e) => {
        const button = e.target.closest('button, .btn');
        if (button && !button.disabled) {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 200);
        }
    });
};

// Connection-aware loading
const getConnectionSpeed = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return 'fast';
    
    const slowConnections = ['slow-2g', '2g', '3g'];
    return slowConnections.includes(connection.effectiveType) ? 'slow' : 'fast';
};

// Adaptive loading based on connection speed
const adaptiveLoad = async () => {
    const connectionSpeed = getConnectionSpeed();
    const isSlowConnection = connectionSpeed === 'slow';
    
    if (isSlowConnection) {
        // Load minimal features for slow connections
        console.log('Slow connection detected, loading minimal features');
        
        // Defer non-critical features
        setTimeout(() => {
            import('./src/features/animations.js').then(module => {
                if (module.default) module.default.init();
            });
        }, 5000);
        
        // Reduce image quality
        document.documentElement.setAttribute('data-connection', 'slow');
    } else {
        // Load all features for fast connections
        console.log('Fast connection detected, loading all features');
        document.documentElement.setAttribute('data-connection', 'fast');
    }
};

// Battery-aware optimizations
const batteryAwareOptimizations = async () => {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            const isLowBattery = !battery.charging && battery.level < 0.2;
            
            if (isLowBattery) {
                console.log('Low battery detected, enabling power-saving mode');
                document.documentElement.setAttribute('data-battery', 'low');
                
                // Disable heavy animations
                document.body.classList.add('reduce-motion');
                
                // Reduce update frequency
                performanceMonitor.reduceFrequency();
            }
        } catch (error) {
            console.log('Battery API not available');
        }
    }
};

// Preload critical routes based on user behavior
const preloadCriticalRoutes = () => {
    const criticalRoutes = ['/', '/calculator', '/dashboard'];
    const router = app.router;
    
    // Preload on mouse hover with debouncing
    let preloadTimeout;
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (link) {
            const href = link.getAttribute('href');
            if (criticalRoutes.includes(href)) {
                clearTimeout(preloadTimeout);
                preloadTimeout = setTimeout(() => {
                    router.preloadRoute(href);
                }, 100);
            }
        }
    });
    
    // Preload on focus for keyboard users
    document.addEventListener('focus', (e) => {
        const link = e.target.closest('a[href^="/"]');
        if (link) {
            const href = link.getAttribute('href');
            if (criticalRoutes.includes(href)) {
                router.preloadRoute(href);
            }
        }
    }, true);
};

// Error boundary for unhandled errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-boundary';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h3>Something went wrong</h3>
            <p>We're sorry, but something unexpected happened. Please refresh the page to continue.</p>
            <button onclick="location.reload()" class="btn-primary">Refresh Page</button>
        </div>
    `;
    
    // Show error overlay
    document.body.appendChild(errorDiv);
    
    // Report error for monitoring
    performanceMonitor.reportMetric('Unhandled Error', {
        message: event.error.message,
        filename: event.filename,
        lineno: event.lineno,
        stack: event.error.stack
    });
});

// Unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    performanceMonitor.reportMetric('Promise Rejection', {
        reason: event.reason.toString()
    });
});

// Visibility change optimization
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, reduce activity
        performanceMonitor.pause();
    } else {
        // Page is visible again, resume activity
        performanceMonitor.resume();
    }
});

// Memory management
const cleanupOnUnload = () => {
    // Clear caches
    if (app.router) {
        app.router.clearCache();
    }
    
    // Clear timers
    performanceMonitor.cleanup();
    
    // Clear event listeners
    document.removeEventListener('click', null);
    document.removeEventListener('mouseover', null);
    document.removeEventListener('focus', null);
};

window.addEventListener('beforeunload', cleanupOnUnload);

// Main initialization function
const initializeApp = async () => {
    try {
        const startTime = performance.now();
        
        // 1. Enhance interface immediately
        enhanceInterface();
        
        // 2. Load polyfills if needed
        await loadPolyfills();
        
        // 3. Apply adaptive optimizations
        adaptiveLoad();
        batteryAwareOptimizations();
        
        // 4. Initialize core app
        await app.init();
        
        // 5. Set up route preloading
        preloadCriticalRoutes();
        
        // 6. Remove loading state
        document.body.classList.remove('loading');
        
        const initTime = performance.now() - startTime;
        console.log(`App initialized in ${initTime.toFixed(2)}ms`);
        
        // Report initialization performance
        performanceMonitor.reportMetric('App Initialization', initTime);
        
        // Mark app as ready
        document.documentElement.setAttribute('data-app-ready', 'true');
        
        // Dispatch ready event for any listening components
        window.dispatchEvent(new CustomEvent('app:ready', {
            detail: { initTime }
        }));
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        
        // Show fallback content
        document.body.innerHTML = `
            <div class="app-error">
                <h1>Unable to Load FlyAndEarn</h1>
                <p>We're experiencing technical difficulties. Please try refreshing the page.</p>
                <button onclick="location.reload()" class="btn-primary">Refresh</button>
            </div>
        `;
        
        // Report initialization error
        performanceMonitor.reportMetric('App Initialization Error', {
            message: error.message,
            stack: error.stack
        });
    }
};

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Service worker registration with update handling
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            
            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New content available, prompt user to update
                            showUpdateNotification();
                        }
                    }
                });
            });
            
            console.log('Service Worker registered successfully');
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    });
}

// Show update notification
const showUpdateNotification = () => {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span>A new version is available</span>
            <button id="update-app" class="btn-primary">Update</button>
            <button id="dismiss-update" class="btn-secondary">Later</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Handle update
    document.getElementById('update-app').addEventListener('click', () => {
        // Tell service worker to skip waiting
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        location.reload();
    });
    
    // Handle dismiss
    document.getElementById('dismiss-update').addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
};

// Export app for global access (for debugging and external integrations)
window.FlyAndEarn = app;