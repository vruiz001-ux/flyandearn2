// Performance utilities for Netlify Functions
const crypto = require('crypto');

// Cache configuration
const CACHE_CONFIG = {
    short: 5 * 60, // 5 minutes
    medium: 30 * 60, // 30 minutes
    long: 60 * 60, // 1 hour
    static: 24 * 60 * 60 // 24 hours
};

// In-memory cache for serverless functions
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class PerformanceOptimizer {
    constructor() {
        this.metrics = {
            requestCount: 0,
            totalDuration: 0,
            errors: 0
        };
    }

    // Middleware for performance tracking
    trackPerformance(handler) {
        return async (event, context) => {
            const startTime = Date.now();
            this.metrics.requestCount++;

            try {
                const result = await handler(event, context);
                const duration = Date.now() - startTime;
                this.metrics.totalDuration += duration;

                // Add performance headers
                const headers = {
                    ...result.headers,
                    'X-Response-Time': `${duration}ms`,
                    'X-Request-ID': context.awsRequestId
                };

                // Log slow requests
                if (duration > 3000) {
                    console.warn(`Slow request detected: ${event.path} took ${duration}ms`);
                }

                return { ...result, headers };
            } catch (error) {
                this.metrics.errors++;
                const duration = Date.now() - startTime;
                
                console.error(`Request failed in ${duration}ms:`, error);
                throw error;
            }
        };
    }

    // Smart caching with ETags
    withCache(handler, ttl = CACHE_CONFIG.medium) {
        return async (event, context) => {
            const cacheKey = this.generateCacheKey(event);
            const cached = this.getFromCache(cacheKey);

            // Check if cached response is still valid
            if (cached && cached.expires > Date.now()) {
                // Check ETag
                const ifNoneMatch = event.headers['if-none-match'];
                if (ifNoneMatch && ifNoneMatch === cached.etag) {
                    return {
                        statusCode: 304,
                        headers: {
                            'ETag': cached.etag,
                            'Cache-Control': `max-age=${ttl}`
                        }
                    };
                }

                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'ETag': cached.etag,
                        'Cache-Control': `max-age=${ttl}`,
                        'X-Cache': 'HIT'
                    },
                    body: cached.body
                };
            }

            // Execute handler
            const result = await handler(event, context);
            
            // Cache successful responses
            if (result.statusCode === 200) {
                const etag = this.generateETag(result.body);
                const cacheEntry = {
                    body: result.body,
                    etag,
                    expires: Date.now() + (ttl * 1000)
                };

                this.setCache(cacheKey, cacheEntry);

                return {
                    ...result,
                    headers: {
                        ...result.headers,
                        'ETag': etag,
                        'Cache-Control': `max-age=${ttl}`,
                        'X-Cache': 'MISS'
                    }
                };
            }

            return result;
        };
    }

    // Connection pooling for database connections
    getConnection() {
        // Reuse connection from previous invocation if still warm
        if (global.dbConnection && global.dbConnection.isConnected()) {
            return global.dbConnection;
        }

        // Create new connection (implement specific to your DB)
        global.dbConnection = this.createNewConnection();
        return global.dbConnection;
    }

    createNewConnection() {
        // Implement database-specific connection logic
        // This is a placeholder
        return {
            isConnected: () => true,
            query: async (sql, params) => {
                // Implement actual query logic
                return [];
            }
        };
    }

    // Request deduplication
    withDeduplication(handler) {
        const pendingRequests = new Map();

        return async (event, context) => {
            const key = this.generateCacheKey(event);
            
            // If same request is already in progress, wait for it
            if (pendingRequests.has(key)) {
                return await pendingRequests.get(key);
            }

            // Start new request
            const promise = handler(event, context);
            pendingRequests.set(key, promise);

            try {
                const result = await promise;
                return result;
            } finally {
                pendingRequests.delete(key);
            }
        };
    }

    // Batch processing optimization
    async batchProcess(items, processor, batchSize = 10) {
        const results = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(processor)
            );
            
            results.push(...batchResults.map(result => 
                result.status === 'fulfilled' ? result.value : null
            ));
        }
        
        return results;
    }

    // Compression for large responses
    compress(data) {
        if (typeof data === 'object') {
            data = JSON.stringify(data);
        }

        // Simple compression (in production, use gzip/brotli)
        if (data.length > 1000) {
            return {
                compressed: true,
                data: Buffer.from(data).toString('base64')
            };
        }

        return { compressed: false, data };
    }

    // Rate limiting
    withRateLimit(handler, maxRequests = 100, windowMs = 60000) {
        const requests = new Map();

        return async (event, context) => {
            const clientIP = event.headers['x-forwarded-for'] || 
                           event.headers['client-ip'] || 
                           'unknown';
            
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Clean old entries
            const clientRequests = requests.get(clientIP) || [];
            const recentRequests = clientRequests.filter(time => time > windowStart);
            
            if (recentRequests.length >= maxRequests) {
                return {
                    statusCode: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': Math.ceil(windowMs / 1000)
                    },
                    body: JSON.stringify({
                        error: 'Rate limit exceeded',
                        retryAfter: Math.ceil(windowMs / 1000)
                    })
                };
            }

            // Record request
            recentRequests.push(now);
            requests.set(clientIP, recentRequests);

            return await handler(event, context);
        };
    }

    // Cache utilities
    generateCacheKey(event) {
        const keyData = {
            path: event.path,
            method: event.httpMethod,
            query: event.queryStringParameters || {},
            // Include user-specific data if needed
            user: event.headers.authorization ? 
                  crypto.createHash('md5').update(event.headers.authorization).digest('hex').substring(0, 8) : 
                  'anonymous'
        };

        return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
    }

    generateETag(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    getFromCache(key) {
        return memoryCache.get(key);
    }

    setCache(key, value) {
        memoryCache.set(key, value);
        
        // Clean up expired entries periodically
        if (memoryCache.size > 1000) {
            this.cleanupCache();
        }
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of memoryCache.entries()) {
            if (value.expires && value.expires < now) {
                memoryCache.delete(key);
            }
        }
    }

    // Error handling and monitoring
    withErrorHandling(handler) {
        return async (event, context) => {
            try {
                return await handler(event, context);
            } catch (error) {
                // Log error with context
                console.error('Function error:', {
                    error: error.message,
                    stack: error.stack,
                    event: {
                        path: event.path,
                        method: event.httpMethod,
                        headers: event.headers
                    },
                    context: {
                        functionName: context.functionName,
                        requestId: context.awsRequestId
                    }
                });

                // Send error to monitoring service
                await this.reportError(error, event, context);

                // Return appropriate error response
                const isDevelopment = process.env.NODE_ENV === 'development';
                
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: 'Internal Server Error',
                        requestId: context.awsRequestId,
                        ...(isDevelopment && { 
                            details: error.message,
                            stack: error.stack 
                        })
                    })
                };
            }
        };
    }

    async reportError(error, event, context) {
        // Send to monitoring service (e.g., Sentry, DataDog)
        try {
            const errorReport = {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                function: context.functionName,
                requestId: context.awsRequestId,
                path: event.path,
                method: event.httpMethod,
                userAgent: event.headers['user-agent'],
                ip: event.headers['x-forwarded-for']
            };

            // In production, send to actual monitoring service
            if (process.env.MONITORING_ENDPOINT) {
                await fetch(process.env.MONITORING_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(errorReport)
                });
            }
        } catch (monitoringError) {
            console.error('Failed to report error:', monitoringError);
        }
    }

    // Get performance metrics
    getMetrics() {
        const avgDuration = this.metrics.requestCount > 0 ? 
                          this.metrics.totalDuration / this.metrics.requestCount : 0;
        
        return {
            ...this.metrics,
            averageDuration: Math.round(avgDuration),
            errorRate: this.metrics.requestCount > 0 ? 
                      (this.metrics.errors / this.metrics.requestCount) * 100 : 0,
            cacheSize: memoryCache.size
        };
    }
}

// Export singleton instance
const performanceOptimizer = new PerformanceOptimizer();

module.exports = {
    performanceOptimizer,
    CACHE_CONFIG,
    // Helper functions for common patterns
    withPerformance: (handler) => performanceOptimizer.trackPerformance(handler),
    withCache: (handler, ttl) => performanceOptimizer.withCache(handler, ttl),
    withRateLimit: (handler, max, window) => performanceOptimizer.withRateLimit(handler, max, window),
    withErrorHandling: (handler) => performanceOptimizer.withErrorHandling(handler),
    withDeduplication: (handler) => performanceOptimizer.withDeduplication(handler)
};