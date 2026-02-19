// Optimized browse function with performance enhancements
import prisma from './lib/prisma.js';
import { jsonResponse } from './lib/auth.js';
import { 
    withPerformance, 
    withCache, 
    withErrorHandling, 
    CACHE_CONFIG,
    performanceOptimizer 
} from './lib/performance.js';

export const config = { path: ['/api/browse-optimized', '/.netlify/functions/browse-optimized'] };

const handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        // Parse query parameters for filtering and pagination
        const params = event.queryStringParameters || {};
        const page = parseInt(params.page) || 1;
        const limit = Math.min(parseInt(params.limit) || 10, 50); // Max 50 items
        const category = params.category;
        const fromCity = params.from;
        const toCity = params.to;
        const dateFrom = params.dateFrom;
        const dateTo = params.dateTo;
        
        const skip = (page - 1) * limit;

        // Build optimized queries with specific indices
        const tripsWhere = {
            status: 'upcoming',
            departureDate: { gte: new Date() },
            ...(fromCity && { fromCity: { contains: fromCity, mode: 'insensitive' } }),
            ...(toCity && { toCity: { contains: toCity, mode: 'insensitive' } }),
            ...(dateFrom && { departureDate: { gte: new Date(dateFrom) } }),
            ...(dateTo && { departureDate: { lte: new Date(dateTo) } })
        };

        const requestsWhere = {
            status: 'OPEN',
            ...(category && { 
                items: { 
                    some: { 
                        category: { contains: category, mode: 'insensitive' } 
                    } 
                } 
            }),
            ...(fromCity && { fromCity: { contains: fromCity, mode: 'insensitive' } }),
            ...(toCity && { toCity: { contains: toCity, mode: 'insensitive' } }),
            ...(dateFrom && { neededBy: { gte: new Date(dateFrom) } }),
            ...(dateTo && { neededBy: { lte: new Date(dateTo) } })
        };

        // Batch queries for better performance
        const [trips, requests, categoryCounts, tripCount, requestCount] = await Promise.all([
            // Trips with optimized selection
            prisma.trip.findMany({
                where: tripsWhere,
                select: {
                    id: true,
                    fromAirport: true,
                    fromCity: true,
                    toAirport: true,
                    toCity: true,
                    departureDate: true,
                    returnDate: true,
                    availableKg: true,
                    categories: true,
                    outsideDutyFreeOptIn: true,
                    createdAt: true,
                    traveller: {
                        select: {
                            id: true,
                            name: true,
                            city: true,
                            country: true,
                            // Only include coordinates if within 50km of major cities
                            ...(shouldIncludeCoordinates(fromCity, toCity) && {
                                latitude: true,
                                longitude: true
                            })
                        }
                    }
                },
                orderBy: [
                    { departureDate: 'asc' },
                    { createdAt: 'desc' }
                ],
                skip,
                take: limit
            }),

            // Requests with optimized selection
            prisma.request.findMany({
                where: requestsWhere,
                select: {
                    id: true,
                    requestType: true,
                    fromAirport: true,
                    fromCity: true,
                    toAirport: true,
                    toCity: true,
                    currency: true,
                    totalBudget: true,
                    totalItems: true,
                    neededBy: true,
                    createdAt: true,
                    buyer: {
                        select: {
                            id: true,
                            name: true,
                            city: true
                        }
                    },
                    // Load items with aggregation
                    _count: {
                        select: { items: true }
                    },
                    items: {
                        select: {
                            itemName: true,
                            quantity: true,
                            budgetPrice: true,
                            category: true,
                            itemSource: true
                        },
                        take: 5 // Limit items per request for performance
                    }
                },
                orderBy: [
                    { neededBy: 'asc' },
                    { createdAt: 'desc' }
                ],
                skip,
                take: limit
            }),

            // Category counts with better aggregation
            getCachedCategoryCounts(),
            
            // Total counts for pagination
            prisma.trip.count({ where: tripsWhere }),
            prisma.request.count({ where: requestsWhere })
        ]);

        // Process and enhance data
        const enhancedTrips = await enhanceTripData(trips);
        const enhancedRequests = await enhanceRequestData(requests);
        
        // Calculate pagination metadata
        const totalPages = Math.ceil(Math.max(tripCount, requestCount) / limit);
        const hasMore = page < totalPages;

        const response = {
            success: true,
            data: {
                trips: enhancedTrips,
                requests: enhancedRequests,
                categories: categoryCounts
            },
            pagination: {
                page,
                limit,
                totalTrips: tripCount,
                totalRequests: requestCount,
                totalPages,
                hasMore,
                ...(hasMore && { nextPage: page + 1 })
            },
            filters: {
                category,
                fromCity,
                toCity,
                dateFrom,
                dateTo
            }
        };

        return jsonResponse(200, response);

    } catch (error) {
        console.error('Error fetching optimized browse data:', error);
        
        // Fallback to basic data if main query fails
        try {
            const fallbackData = await getFallbackData();
            return jsonResponse(200, {
                success: true,
                data: fallbackData,
                fallback: true,
                message: 'Returned cached data due to temporary issue'
            });
        } catch (fallbackError) {
            throw error; // Original error
        }
    }
};

// Helper functions
function shouldIncludeCoordinates(fromCity, toCity) {
    // Only include coordinates for location-based filtering
    return !!(fromCity || toCity);
}

async function getCachedCategoryCounts() {
    // Cache category counts for 10 minutes since they don't change frequently
    const cacheKey = 'category-counts';
    const cached = performanceOptimizer.getFromCache(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }

    const categoryCounts = await prisma.requestItem.groupBy({
        by: ['category'],
        _count: { id: true },
        where: {
            request: { status: 'OPEN' },
            category: { not: null }
        }
    });

    const categories = {};
    for (const c of categoryCounts) {
        if (c.category) {
            categories[c.category] = c._count.id;
        }
    }

    // Cache for 10 minutes
    performanceOptimizer.setCache(cacheKey, {
        data: categories,
        expires: Date.now() + (10 * 60 * 1000)
    });

    return categories;
}

async function enhanceTripData(trips) {
    return performanceOptimizer.batchProcess(trips, async (trip) => {
        // Add calculated fields
        const daysUntilDeparture = Math.ceil(
            (new Date(trip.departureDate) - new Date()) / (1000 * 60 * 60 * 24)
        );

        return {
            ...trip,
            daysUntilDeparture,
            isUrgent: daysUntilDeparture <= 7,
            route: `${trip.fromCity} → ${trip.toCity}`,
            // Add traveller rating if available
            travellerRating: await getTravellerRating(trip.traveller.id)
        };
    }, 5); // Process 5 trips at a time
}

async function enhanceRequestData(requests) {
    return performanceOptimizer.batchProcess(requests, async (request) => {
        const daysUntilNeeded = Math.ceil(
            (new Date(request.neededBy) - new Date()) / (1000 * 60 * 60 * 24)
        );

        // Calculate average item value
        const avgItemValue = request.items.length > 0 ? 
            request.items.reduce((sum, item) => sum + (item.budgetPrice || 0), 0) / request.items.length :
            0;

        return {
            ...request,
            daysUntilNeeded,
            isUrgent: daysUntilNeeded <= 14,
            route: `${request.fromCity} → ${request.toCity}`,
            avgItemValue,
            hasMoreItems: request._count.items > 5,
            // Add buyer rating if available
            buyerRating: await getBuyerRating(request.buyer.id)
        };
    }, 5); // Process 5 requests at a time
}

async function getTravellerRating(travellerId) {
    // Cache ratings for 30 minutes
    const cacheKey = `traveller-rating-${travellerId}`;
    const cached = performanceOptimizer.getFromCache(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }

    try {
        // Simplified rating calculation
        const rating = await prisma.tripReview.aggregate({
            where: { tripId: { in: await prisma.trip.findMany({ 
                where: { travellerId }, 
                select: { id: true } 
            }).then(trips => trips.map(t => t.id)) } },
            _avg: { rating: true },
            _count: { rating: true }
        });

        const result = {
            average: rating._avg.rating || 0,
            count: rating._count.rating || 0
        };

        performanceOptimizer.setCache(cacheKey, {
            data: result,
            expires: Date.now() + (30 * 60 * 1000)
        });

        return result;
    } catch (error) {
        console.error('Error getting traveller rating:', error);
        return { average: 0, count: 0 };
    }
}

async function getBuyerRating(buyerId) {
    // Similar caching strategy for buyer ratings
    const cacheKey = `buyer-rating-${buyerId}`;
    const cached = performanceOptimizer.getFromCache(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }

    try {
        const rating = await prisma.requestReview.aggregate({
            where: { requestId: { in: await prisma.request.findMany({ 
                where: { buyerId }, 
                select: { id: true } 
            }).then(requests => requests.map(r => r.id)) } },
            _avg: { rating: true },
            _count: { rating: true }
        });

        const result = {
            average: rating._avg.rating || 0,
            count: rating._count.rating || 0
        };

        performanceOptimizer.setCache(cacheKey, {
            data: result,
            expires: Date.now() + (30 * 60 * 1000)
        });

        return result;
    } catch (error) {
        console.error('Error getting buyer rating:', error);
        return { average: 0, count: 0 };
    }
}

async function getFallbackData() {
    // Return minimal cached data if main query fails
    return {
        trips: [],
        requests: [],
        categories: await getCachedCategoryCounts()
    };
}

// Apply performance middleware with longer cache for browse data
export const optimizedHandler = withCache(
    withErrorHandling(
        withPerformance(handler)
    ),
    CACHE_CONFIG.medium // 30 minutes cache
);

export { optimizedHandler as handler };