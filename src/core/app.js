// Core application module - loads immediately
import { performanceMonitor, LazyLoader, ResourcePreloader } from './performance.js';
import { Router } from './router.js';
import { Store } from './store.js';

class FlyAndEarnApp {
    constructor() {
        this.initialized = false;
        this.router = new Router();
        this.loadedModules = new Set();
        this.criticalCSSLoaded = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            // Start performance monitoring
            performanceMonitor.init();

            // Load critical CSS first
            await this.loadCriticalCSS();

            // Initialize core systems
            await this.initializeCore();

            // Set up routing
            this.setupRouting();

            // Load initial route
            await this.router.handleRoute(window.location.pathname);

            // Initialize lazy loading
            LazyLoader.images();

            // Preload critical resources
            ResourcePreloader.preloadCriticalResources();

            // Mark as initialized
            this.initialized = true;

            console.log('FlyAndEarn App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize FlyAndEarn App:', error);
            this.showErrorMessage('Application failed to load. Please refresh the page.');
        }
    }

    async loadCriticalCSS() {
        if (this.criticalCSSLoaded) return;
        
        const criticalCSS = `
        /* Critical CSS - Above the fold styles */
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 12px;
            border-radius: 4px;
            margin: 16px;
            border: 1px solid #f5c6cb;
        }
        
        .hidden { display: none !important; }
        .loading { opacity: 0.6; pointer-events: none; }
        
        /* Hero section critical styles */
        .hero {
            min-height: 400px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        `;

        const style = document.createElement('style');
        style.textContent = criticalCSS;
        document.head.appendChild(style);
        
        this.criticalCSSLoaded = true;
    }

    async initializeCore() {
        // Initialize user session
        const user = Store.get('user');
        if (user) {
            this.currentUser = user;
        }

        // Set up global error handling
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            performanceMonitor.reportMetric('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno
            });
        });

        // Set up unhandled promise rejection handling
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            performanceMonitor.reportMetric('Promise Rejection', {
                reason: event.reason.toString()
            });
        });

        // Initialize service worker
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    setupRouting() {
        // Define route handlers
        this.router.addRoutes({
            '/': () => this.loadModule('home'),
            '/calculator': () => this.loadModule('calculator'),
            '/dashboard': () => this.loadModule('dashboard'),
            '/profile': () => this.loadModule('profile'),
            '/browse': () => this.loadModule('browse'),
            '/messages': () => this.loadModule('messages'),
            '/admin': () => this.loadModule('admin'),
            '/login': () => this.loadModule('auth'),
            '/register': () => this.loadModule('auth')
        });

        // Handle navigation
        window.addEventListener('popstate', () => {
            this.router.handleRoute(window.location.pathname);
        });

        // Intercept link clicks for SPA navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="/"]');
            if (link && !link.hasAttribute('data-external')) {
                e.preventDefault();
                this.navigate(link.href);
            }
        });
    }

    async loadModule(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return;
        }

        try {
            this.showLoading();
            
            const moduleLoader = LazyLoader.modules();
            const module = await moduleLoader.loadForRoute(`/${moduleName}`);
            
            if (module && module.default) {
                await module.default.init();
                this.loadedModules.add(moduleName);
            }
            
            this.hideLoading();
        } catch (error) {
            console.error(`Failed to load module ${moduleName}:`, error);
            this.showErrorMessage(`Failed to load ${moduleName}. Please try again.`);
            this.hideLoading();
        }
    }

    navigate(url) {
        history.pushState(null, '', url);
        this.router.handleRoute(url);
    }

    showLoading() {
        let loader = document.getElementById('global-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.innerHTML = '<div class="loading-spinner"></div> Loading...';
            loader.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 255, 255, 0.9);
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            document.body.appendChild(loader);
        }
        loader.classList.remove('hidden');
    }

    hideLoading() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Insert at the top of the page
        const main = document.querySelector('main') || document.body;
        main.insertBefore(errorDiv, main.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    // Public API
    getUser() {
        return this.currentUser;
    }

    setUser(user) {
        this.currentUser = user;
        Store.set('user', user);
    }

    logout() {
        this.currentUser = null;
        Store.remove('user');
        this.navigate('/');
    }
}

// Export singleton instance
export const app = new FlyAndEarnApp();