// Performance monitoring dashboard endpoint
const { withPerformance, withCache, withErrorHandling, CACHE_CONFIG, performanceOptimizer } = require('./lib/performance');

const handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const dashboardData = await generateDashboardData();
        
        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache' // Dashboard data should be fresh
            },
            body: JSON.stringify(dashboardData)
        };

    } catch (error) {
        console.error('Dashboard generation error:', error);
        throw error;
    }
};

async function generateDashboardData() {
    // Get current performance metrics
    const performanceMetrics = performanceOptimizer.getMetrics();
    
    // Simulate historical data (in production, load from database)
    const historicalMetrics = generateHistoricalData();
    
    // Calculate Core Web Vitals summary
    const coreWebVitals = calculateCoreWebVitalsSummary();
    
    // Get system information
    const systemInfo = getSystemInfo();
    
    // Calculate performance scores
    const performanceScore = calculateOverallScore(coreWebVitals);
    
    return {
        timestamp: new Date().toISOString(),
        summary: {
            performanceScore,
            status: getSystemStatus(performanceScore),
            totalRequests: performanceMetrics.requestCount,
            errorRate: performanceMetrics.errorRate,
            averageResponseTime: performanceMetrics.averageDuration
        },
        coreWebVitals,
        metrics: {
            current: performanceMetrics,
            historical: historicalMetrics
        },
        alerts: getActiveAlerts(),
        system: systemInfo,
        recommendations: generateRecommendations(performanceScore, coreWebVitals)
    };
}

function calculateCoreWebVitalsSummary() {
    // In production, these would come from actual measurements
    return {
        fcp: {
            value: 1200,
            score: calculateScore(1200, 1800, 3000),
            status: 'good',
            threshold: 1800
        },
        lcp: {
            value: 2100,
            score: calculateScore(2100, 2500, 4000),
            status: 'good',
            threshold: 2500
        },
        fid: {
            value: 85,
            score: calculateScore(85, 100, 300),
            status: 'good',
            threshold: 100
        },
        cls: {
            value: 0.08,
            score: calculateScore(0.08, 0.1, 0.25),
            status: 'good',
            threshold: 0.1
        },
        ttfb: {
            value: 180,
            score: calculateScore(180, 600, 1500),
            status: 'good',
            threshold: 600
        }
    };
}

function calculateScore(value, good, poor) {
    if (value <= good) return 100;
    if (value >= poor) return 0;
    return Math.round(100 - ((value - good) / (poor - good)) * 100);
}

function calculateOverallScore(coreWebVitals) {
    const scores = Object.values(coreWebVitals).map(metric => metric.score);
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function getSystemStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'needs_improvement';
    return 'poor';
}

function generateHistoricalData() {
    // Generate sample historical data (last 24 hours)
    const now = Date.now();
    const hourly = [];
    
    for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now - (i * 60 * 60 * 1000));
        hourly.push({
            timestamp: timestamp.toISOString(),
            responseTime: Math.round(200 + Math.random() * 300),
            errorRate: Math.random() * 2,
            requestCount: Math.round(50 + Math.random() * 200),
            cacheHitRate: 0.7 + Math.random() * 0.25,
            memoryUsage: 0.3 + Math.random() * 0.4
        });
    }
    
    return { hourly };
}

function getActiveAlerts() {
    // Return current active alerts
    return [
        {
            id: 'perf-001',
            type: 'performance',
            severity: 'warning',
            metric: 'response_time',
            message: 'Response time increased by 15% in the last hour',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            threshold: 2000,
            current: 2300
        }
    ];
}

function getSystemInfo() {
    return {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    };
}

function generateRecommendations(performanceScore, coreWebVitals) {
    const recommendations = [];
    
    // Analyze each metric and provide recommendations
    if (coreWebVitals.lcp.score < 75) {
        recommendations.push({
            priority: 'high',
            category: 'loading',
            title: 'Optimize Largest Contentful Paint',
            description: 'LCP is slower than recommended. Consider optimizing images and server response times.',
            actions: [
                'Optimize hero images with WebP format',
                'Implement image lazy loading',
                'Reduce server response time',
                'Use CDN for static assets'
            ],
            impact: 'High - Improves user perception of loading speed'
        });
    }
    
    if (coreWebVitals.fid.score < 75) {
        recommendations.push({
            priority: 'high',
            category: 'interactivity',
            title: 'Reduce First Input Delay',
            description: 'Users are experiencing delays when first interacting with the page.',
            actions: [
                'Reduce JavaScript bundle size',
                'Implement code splitting',
                'Defer non-critical JavaScript',
                'Use web workers for heavy computations'
            ],
            impact: 'High - Improves user interaction experience'
        });
    }
    
    if (coreWebVitals.cls.score < 75) {
        recommendations.push({
            priority: 'medium',
            category: 'visual_stability',
            title: 'Improve Cumulative Layout Shift',
            description: 'Page elements are shifting during load, affecting user experience.',
            actions: [
                'Set explicit dimensions for images and videos',
                'Reserve space for dynamic content',
                'Avoid inserting content above existing content',
                'Use CSS aspect-ratio for responsive images'
            ],
            impact: 'Medium - Prevents unexpected layout shifts'
        });
    }
    
    // General recommendations based on overall score
    if (performanceScore < 80) {
        recommendations.push({
            priority: 'medium',
            category: 'general',
            title: 'Overall Performance Optimization',
            description: 'Several areas for improvement detected.',
            actions: [
                'Enable Brotli compression',
                'Optimize font loading strategy',
                'Implement service worker caching',
                'Minimize third-party scripts'
            ],
            impact: 'Medium - General performance improvements'
        });
    }
    
    return recommendations;
}

// Apply performance middleware with short cache for dashboard
const optimizedHandler = withCache(
    withErrorHandling(
        withPerformance(handler)
    ),
    60 // 1 minute cache for dashboard data
);

module.exports = { handler: optimizedHandler };