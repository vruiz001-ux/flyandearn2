// Lightweight client-side router
export class Router {
    constructor() {
        this.routes = new Map();
        this.middlewares = [];
        this.currentRoute = null;
        this.cache = new Map(); // Route result cache
    }

    addRoute(path, handler) {
        this.routes.set(path, handler);
    }

    addRoutes(routeMap) {
        Object.entries(routeMap).forEach(([path, handler]) => {
            this.addRoute(path, handler);
        });
    }

    addMiddleware(middleware) {
        this.middlewares.push(middleware);
    }

    async handleRoute(path) {
        try {
            // Normalize path
            const normalizedPath = path.split('?')[0].split('#')[0];
            
            // Skip if already on this route
            if (this.currentRoute === normalizedPath) {
                return;
            }

            // Check cache first
            if (this.cache.has(normalizedPath)) {
                const cachedResult = this.cache.get(normalizedPath);
                if (cachedResult && Date.now() - cachedResult.timestamp < 5 * 60 * 1000) {
                    // Use cached result if less than 5 minutes old
                    this.currentRoute = normalizedPath;
                    return cachedResult.result;
                }
            }

            // Run middlewares
            for (const middleware of this.middlewares) {
                const result = await middleware(normalizedPath);
                if (result === false) {
                    // Middleware blocked navigation
                    return;
                }
            }

            // Find matching route
            const handler = this.routes.get(normalizedPath) || this.routes.get('*');
            
            if (handler) {
                const startTime = performance.now();
                const result = await handler();
                const endTime = performance.now();

                // Cache result
                this.cache.set(normalizedPath, {
                    result,
                    timestamp: Date.now()
                });

                // Update current route
                this.currentRoute = normalizedPath;

                // Track route performance
                console.log(`Route ${normalizedPath} loaded in ${(endTime - startTime).toFixed(2)}ms`);

                return result;
            } else {
                console.warn(`No handler found for route: ${normalizedPath}`);
                this.handleNotFound(normalizedPath);
            }
        } catch (error) {
            console.error('Router error:', error);
            this.handleError(error, path);
        }
    }

    handleNotFound(path) {
        // Show 404 page or redirect to home
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div class="error-page">
                    <h2>Page Not Found</h2>
                    <p>The page "${path}" was not found.</p>
                    <a href="/" class="btn-primary">Go Home</a>
                </div>
            `;
        }
    }

    handleError(error, path) {
        console.error(`Error handling route ${path}:`, error);
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div class="error-page">
                    <h2>Something went wrong</h2>
                    <p>An error occurred while loading this page.</p>
                    <button onclick="location.reload()" class="btn-primary">Refresh</button>
                </div>
            `;
        }
    }

    // Clear route cache
    clearCache() {
        this.cache.clear();
    }

    // Get current route
    getCurrentRoute() {
        return this.currentRoute;
    }

    // Preload route
    async preloadRoute(path) {
        const handler = this.routes.get(path);
        if (handler && !this.cache.has(path)) {
            try {
                const result = await handler();
                this.cache.set(path, {
                    result,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error(`Failed to preload route ${path}:`, error);
            }
        }
    }
}

// Authentication middleware
export const authMiddleware = (requiredRole = null) => {
    return async (path) => {
        // Check if user is authenticated
        const user = JSON.parse(localStorage.getItem('flyandearn_user') || 'null');
        
        const protectedRoutes = ['/dashboard', '/profile', '/messages', '/admin'];
        const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
        
        if (isProtectedRoute && !user) {
            // Redirect to login
            history.replaceState(null, '', `/login?redirect=${encodeURIComponent(path)}`);
            return false;
        }

        // Check role-based access
        if (requiredRole && (!user || user.role !== requiredRole)) {
            console.warn(`Access denied: User role ${user?.role} does not match required role ${requiredRole}`);
            history.replaceState(null, '', '/');
            return false;
        }

        return true;
    };
};

// Loading middleware
export const loadingMiddleware = () => {
    return async (path) => {
        // Show loading indicator for slow routes
        const slowRoutes = ['/dashboard', '/admin'];
        if (slowRoutes.includes(path)) {
            document.body.classList.add('loading');
        }
        return true;
    };
};