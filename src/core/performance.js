// Performance monitoring and optimization utilities
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadTime: 0,
            renderTime: 0,
            interactionTime: 0,
            bundleSize: 0
        };
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Core Web Vitals tracking
        this.trackCoreWebVitals();
        
        // Bundle size tracking
        this.trackBundleSize();
        
        // Interaction tracking
        this.trackInteractions();
        
        // Resource loading tracking
        this.trackResourceLoading();
    }

    trackCoreWebVitals() {
        // First Contentful Paint (FCP)
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                    this.metrics.fcp = entry.startTime;
                    this.reportMetric('FCP', entry.startTime);
                }
            }
        }).observe({ type: 'paint', buffered: true });

        // Largest Contentful Paint (LCP)
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.metrics.lcp = lastEntry.startTime;
            this.reportMetric('LCP', lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // First Input Delay (FID)
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                this.metrics.fid = entry.processingStart - entry.startTime;
                this.reportMetric('FID', this.metrics.fid);
            }
        }).observe({ type: 'first-input', buffered: true });

        // Cumulative Layout Shift (CLS)
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                    this.metrics.cls = (this.metrics.cls || 0) + entry.value;
                    this.reportMetric('CLS', this.metrics.cls);
                }
            }
        }).observe({ type: 'layout-shift', buffered: true });
    }

    trackBundleSize() {
        // Track loaded resources
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name.includes('.js')) {
                    this.metrics.bundleSize += entry.transferSize || 0;
                }
            }
            this.reportMetric('Bundle Size', this.metrics.bundleSize);
        });
        observer.observe({ entryTypes: ['navigation', 'resource'] });
    }

    trackInteractions() {
        ['click', 'keydown', 'scroll'].forEach(eventType => {
            document.addEventListener(eventType, (e) => {
                const start = performance.now();
                requestIdleCallback(() => {
                    const duration = performance.now() - start;
                    if (duration > 50) { // Report slow interactions
                        this.reportMetric('Slow Interaction', { type: eventType, duration });
                    }
                });
            }, { passive: true });
        });
    }

    trackResourceLoading() {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            this.metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
            this.reportMetric('Load Time', this.metrics.loadTime);
        });
    }

    reportMetric(name, value) {
        // Report to analytics service
        if (window.gtag) {
            window.gtag('event', 'performance_metric', {
                metric_name: name,
                metric_value: typeof value === 'object' ? JSON.stringify(value) : value,
                custom_parameter: true
            });
        }

        // Console logging in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`Performance Metric - ${name}:`, value);
        }

        // Store for performance budget checks
        this.checkPerformanceBudgets(name, value);
    }

    checkPerformanceBudgets(metricName, value) {
        const budgets = {
            'FCP': 1800,  // 1.8s
            'LCP': 2500,  // 2.5s
            'FID': 100,   // 100ms
            'CLS': 0.1,   // 0.1
            'Load Time': 3000, // 3s
            'Bundle Size': 500000 // 500KB
        };

        const budget = budgets[metricName];
        if (budget && value > budget) {
            console.warn(`Performance budget exceeded for ${metricName}: ${value} > ${budget}`);
            
            // Send alert to monitoring service
            this.sendAlert({
                type: 'performance_budget_exceeded',
                metric: metricName,
                value,
                budget,
                timestamp: Date.now()
            });
        }
    }

    sendAlert(alert) {
        // Send to monitoring endpoint
        fetch('/.netlify/functions/performance-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert)
        }).catch(err => console.error('Failed to send performance alert:', err));
    }
}

// Lazy loading utilities
export class LazyLoader {
    static images() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    static modules() {
        // Dynamic module loading based on route
        const moduleMap = {
            '/calculator': () => import('../features/calculator.js'),
            '/dashboard': () => import('../features/dashboard.js'),
            '/profile': () => import('../features/profile.js'),
            '/browse': () => import('../features/browse.js'),
            '/messages': () => import('../features/messages.js')
        };

        return {
            loadForRoute: (route) => {
                const loader = moduleMap[route];
                return loader ? loader() : Promise.resolve(null);
            }
        };
    }
}

// Resource preloading
export class ResourcePreloader {
    static preloadCriticalResources() {
        // Preload critical CSS
        this.preloadCSS([
            '/assets/critical.css',
            '/assets/fonts.css'
        ]);

        // Preload critical JavaScript modules
        this.preloadJS([
            '/assets/core.js',
            '/assets/nav.js'
        ]);

        // Preload critical images
        this.preloadImages([
            '/icons/logo.webp',
            '/images/hero-bg.webp'
        ]);
    }

    static preloadCSS(urls) {
        urls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = url;
            document.head.appendChild(link);
        });
    }

    static preloadJS(urls) {
        urls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'modulepreload';
            link.href = url;
            document.head.appendChild(link);
        });
    }

    static preloadImages(urls) {
        urls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
        });
    }
}

// Image optimization
export class ImageOptimizer {
    static generateResponsiveImage(src, alt, sizes = '(max-width: 768px) 100vw, 50vw') {
        const img = document.createElement('img');
        
        // Generate WebP sources
        const webpSrc = src.replace(/\.(jpg|jpeg|png)$/, '.webp');
        
        // Create picture element with WebP support
        const picture = document.createElement('picture');
        
        // WebP source
        const webpSource = document.createElement('source');
        webpSource.type = 'image/webp';
        webpSource.srcset = `
            ${webpSrc.replace('.webp', '-320w.webp')} 320w,
            ${webpSrc.replace('.webp', '-640w.webp')} 640w,
            ${webpSrc.replace('.webp', '-1024w.webp')} 1024w
        `;
        webpSource.sizes = sizes;
        
        // Fallback JPEG/PNG source
        const fallbackSource = document.createElement('source');
        fallbackSource.srcset = `
            ${src.replace(/\.(jpg|jpeg|png)$/, '-320w.$1')} 320w,
            ${src.replace(/\.(jpg|jpeg|png)$/, '-640w.$1')} 640w,
            ${src.replace(/\.(jpg|jpeg|png)$/, '-1024w.$1')} 1024w
        `;
        fallbackSource.sizes = sizes;
        
        // Fallback img
        img.src = src;
        img.alt = alt;
        img.loading = 'lazy';
        
        picture.appendChild(webpSource);
        picture.appendChild(fallbackSource);
        picture.appendChild(img);
        
        return picture;
    }
}

// Initialize performance monitoring
const performanceMonitor = new PerformanceMonitor();
export { performanceMonitor };