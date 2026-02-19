// Performance monitoring and alerting endpoint
const { withPerformance, withErrorHandling, withRateLimit } = require('./lib/performance');

const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const alert = JSON.parse(event.body);
        
        // Validate alert structure
        if (!alert.type || !alert.metric || !alert.value) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid alert format' })
            };
        }

        // Log the performance alert
        console.log('Performance Alert:', {
            type: alert.type,
            metric: alert.metric,
            value: alert.value,
            budget: alert.budget,
            timestamp: alert.timestamp || Date.now(),
            userAgent: event.headers['user-agent'],
            url: event.headers.referer
        });

        // Process different types of alerts
        switch (alert.type) {
            case 'performance_budget_exceeded':
                await handleBudgetExceeded(alert);
                break;
            case 'core_web_vital':
                await handleCoreWebVital(alert);
                break;
            case 'slow_interaction':
                await handleSlowInteraction(alert);
                break;
            case 'javascript_error':
                await handleJavaScriptError(alert);
                break;
            default:
                console.warn('Unknown alert type:', alert.type);
        }

        // Send alert to monitoring service if configured
        if (process.env.MONITORING_WEBHOOK_URL) {
            await sendToMonitoringService(alert, event.headers);
        }

        // Store metric for dashboard
        await storeMetric(alert);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                message: 'Alert processed successfully' 
            })
        };

    } catch (error) {
        console.error('Failed to process performance alert:', error);
        throw error;
    }
};

async function handleBudgetExceeded(alert) {
    const criticalMetrics = ['LCP', 'FID', 'CLS'];
    const isCritical = criticalMetrics.includes(alert.metric);
    
    if (isCritical) {
        console.warn(`CRITICAL: Core Web Vital ${alert.metric} budget exceeded`, {
            value: alert.value,
            budget: alert.budget,
            severity: 'high'
        });
        
        // Send immediate notification for critical metrics
        await sendCriticalAlert(alert);
    }
}

async function handleCoreWebVital(alert) {
    // Track Core Web Vitals trends
    const thresholds = {
        'FCP': { good: 1800, needs_improvement: 3000 },
        'LCP': { good: 2500, needs_improvement: 4000 },
        'FID': { good: 100, needs_improvement: 300 },
        'CLS': { good: 0.1, needs_improvement: 0.25 }
    };

    const threshold = thresholds[alert.metric];
    if (threshold) {
        const status = alert.value <= threshold.good ? 'good' : 
                      alert.value <= threshold.needs_improvement ? 'needs_improvement' : 'poor';
        
        console.log(`Core Web Vital ${alert.metric}: ${alert.value} (${status})`);
    }
}

async function handleSlowInteraction(alert) {
    if (alert.value && alert.value.duration > 1000) {
        console.warn('Very slow interaction detected:', {
            type: alert.value.type,
            duration: alert.value.duration,
            severity: 'medium'
        });
    }
}

async function handleJavaScriptError(alert) {
    console.error('JavaScript error reported:', {
        message: alert.value.message,
        filename: alert.value.filename,
        lineno: alert.value.lineno,
        severity: 'high'
    });
}

async function sendCriticalAlert(alert) {
    // In production, send to Slack, email, or other notification service
    const notification = {
        title: 'FlyAndEarn Performance Alert',
        message: `${alert.metric} budget exceeded: ${alert.value} > ${alert.budget}`,
        severity: 'critical',
        timestamp: new Date().toISOString()
    };

    console.log('Critical alert notification:', notification);
    
    // Example: Send to Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
        try {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🚨 ${notification.title}`,
                    attachments: [{
                        color: 'danger',
                        fields: [{
                            title: 'Metric',
                            value: alert.metric,
                            short: true
                        }, {
                            title: 'Value',
                            value: alert.value,
                            short: true
                        }, {
                            title: 'Budget',
                            value: alert.budget,
                            short: true
                        }]
                    }]
                })
            });
        } catch (error) {
            console.error('Failed to send Slack notification:', error);
        }
    }
}

async function sendToMonitoringService(alert, headers) {
    try {
        const monitoringData = {
            ...alert,
            source: 'flyandearn-frontend',
            environment: process.env.NODE_ENV || 'production',
            userAgent: headers['user-agent'],
            referer: headers.referer,
            timestamp: new Date().toISOString()
        };

        const response = await fetch(process.env.MONITORING_WEBHOOK_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': process.env.MONITORING_API_KEY ? 
                    `Bearer ${process.env.MONITORING_API_KEY}` : undefined
            },
            body: JSON.stringify(monitoringData)
        });

        if (!response.ok) {
            throw new Error(`Monitoring service responded with ${response.status}`);
        }
    } catch (error) {
        console.error('Failed to send to monitoring service:', error);
    }
}

async function storeMetric(alert) {
    // Store metrics in database for dashboard
    // This would connect to your actual database
    const metric = {
        type: alert.type,
        metric_name: alert.metric,
        value: alert.value,
        budget: alert.budget,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production'
    };

    // Example: Store in simple file for demo
    console.log('Storing metric for dashboard:', metric);
    
    // In production, use proper database:
    /*
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.performanceMetric.create({
        data: metric
    });
    */
}

// Apply middleware
const optimizedHandler = withRateLimit(
    withErrorHandling(
        withPerformance(handler)
    ),
    200, // 200 requests per minute
    60 * 1000
);

module.exports = { handler: optimizedHandler };