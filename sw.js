// Service Worker for FlyAndEarn
const CACHE_VERSION = 'flyandearn-v1.0.0';
const CACHE_PREFIX = 'flyandearn';

// Cache names
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/assets/core.js',
    '/assets/app.css',
    '/assets/critical.css',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/manifest.json'
];

// API endpoints to cache
const CACHEABLE_APIS = [
    '/.netlify/functions/airports',
    '/.netlify/functions/currencies',
    '/.netlify/functions/stats',
    '/.netlify/functions/me'
];

// Network timeout
const NETWORK_TIMEOUT = 3000;

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker');
    
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then(cache => {
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.error('[SW] Failed to cache static assets:', err);
                });
            }),
            caches.open(API_CACHE),
            caches.open(DYNAMIC_CACHE),
            caches.open(IMAGE_CACHE)
        ]).then(() => {
            console.log('[SW] Static assets cached');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => 
                        cacheName.startsWith(CACHE_PREFIX) && 
                        !cacheName.includes(CACHE_VERSION)
                    )
                    .map(cacheName => {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('[SW] Service worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle different types of requests
    if (isApiRequest(url)) {
        event.respondWith(handleApiRequest(request));
    } else if (isImageRequest(url)) {
        event.respondWith(handleImageRequest(request));
    } else if (isStaticAsset(url)) {
        event.respondWith(handleStaticAsset(request));
    } else {
        event.respondWith(handleNavigationRequest(request));
    }
});

// Check if request is for API
function isApiRequest(url) {
    return url.pathname.includes('/.netlify/functions/') || 
           url.hostname.includes('api.');
}

// Check if request is for image
function isImageRequest(url) {
    return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
}

// Check if request is for static asset
function isStaticAsset(url) {
    return /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
           url.pathname.startsWith('/assets/') ||
           url.pathname.startsWith('/icons/');
}

// Handle API requests with cache-first for GET requests
async function handleApiRequest(request) {
    const url = new URL(request.url);
    
    // Use different strategies based on endpoint
    if (CACHEABLE_APIS.some(api => url.pathname.includes(api))) {
        return cacheFirst(request, API_CACHE);
    } else if (url.pathname.includes('/stats') || 
               url.pathname.includes('/browse') || 
               url.pathname.includes('/requests')) {
        return staleWhileRevalidate(request, API_CACHE);
    } else {
        return networkFirst(request, API_CACHE);
    }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
    return cacheFirst(request, IMAGE_CACHE);
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
    return cacheFirst(request, STATIC_CACHE);
}

// Handle navigation requests
async function handleNavigationRequest(request) {
    return networkFirst(request, DYNAMIC_CACHE, '/index.html');
}

// Cache-first strategy
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // Return cached version immediately
        return cachedResponse;
    }
    
    try {
        // Fetch from network with timeout
        const networkResponse = await fetchWithTimeout(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Cache-first fetch failed:', error);
        
        // Return offline fallback if available
        if (request.destination === 'image') {
            return caches.match('/icons/placeholder.svg');
        }
        
        throw error;
    }
}

// Network-first strategy
async function networkFirst(request, cacheName, fallbackUrl = null) {
    const cache = await caches.open(cacheName);
    
    try {
        // Try network first with timeout
        const networkResponse = await fetchWithTimeout(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.warn('[SW] Network-first fetch failed, trying cache:', error);
        
        // Fall back to cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fall back to offline page
        if (fallbackUrl) {
            const fallbackResponse = await cache.match(fallbackUrl);
            if (fallbackResponse) {
                return fallbackResponse;
            }
        }
        
        throw error;
    }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Start network request in background
    const networkResponsePromise = fetchWithTimeout(request).then(response => {
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(error => {
        console.warn('[SW] Stale-while-revalidate network update failed:', error);
        return null;
    });
    
    // Return cached version immediately if available
    if (cachedResponse) {
        // Don't await the network request
        networkResponsePromise.catch(() => {});
        return cachedResponse;
    }
    
    // If no cache, wait for network
    try {
        return await networkResponsePromise;
    } catch (error) {
        console.error('[SW] Stale-while-revalidate failed:', error);
        throw error;
    }
}

// Fetch with timeout
async function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(request, { 
            signal: controller.signal,
            headers: {
                ...request.headers,
                'Cache-Control': 'no-cache'
            }
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Get pending offline actions from IndexedDB
        const pendingActions = await getPendingActions();
        
        for (const action of pendingActions) {
            try {
                await fetch(action.url, {
                    method: action.method,
                    headers: action.headers,
                    body: action.body
                });
                
                // Remove successful action
                await removePendingAction(action.id);
                
                // Notify client
                await notifyClient('sync-success', { action: action.type });
            } catch (error) {
                console.error('[SW] Background sync failed for action:', action, error);
            }
        }
    } catch (error) {
        console.error('[SW] Background sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'New notification from FlyAndEarn',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        image: data.image,
        data: data.data || {},
        actions: data.actions || [],
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        tag: data.tag || 'default'
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'FlyAndEarn', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const data = event.notification.data || {};
    let url = data.url || '/';
    
    // Handle action buttons
    if (event.action) {
        switch (event.action) {
            case 'open-messages':
                url = '/messages';
                break;
            case 'open-dashboard':
                url = '/dashboard';
                break;
            case 'view-request':
                url = `/requests/${data.requestId}`;
                break;
        }
    }
    
    event.waitUntil(
        clients.openWindow(url)
    );
});

// Utility functions for IndexedDB operations
async function getPendingActions() {
    // Implement IndexedDB operations for offline sync
    return [];
}

async function removePendingAction(actionId) {
    // Implement IndexedDB operations
}

async function notifyClient(type, data) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type, data });
    });
}

// Cache management
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_UPDATE') {
        event.waitUntil(updateCache(event.data.urls));
    }
});

async function updateCache(urls = []) {
    const cache = await caches.open(DYNAMIC_CACHE);
    return Promise.all(
        urls.map(url => 
            fetch(url).then(response => {
                if (response.ok) {
                    return cache.put(url, response);
                }
            }).catch(error => {
                console.warn('[SW] Failed to update cache for:', url, error);
            })
        )
    );
}