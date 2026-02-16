// Simple in-memory rate limiter for Netlify Functions
// Note: In serverless, each function instance has its own memory,
// so this provides per-instance limiting. For production, use Redis/Upstash.
const store = new Map();

const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function rateLimit(ip, { maxRequests = 10, windowMs = 60000 } = {}) {
  cleanup();
  const now = Date.now();
  const key = ip;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

export function getRateLimitHeaders(result) {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    ...(result.retryAfter && { 'Retry-After': String(result.retryAfter) }),
  };
}

export function getClientIp(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || event.headers['x-real-ip'] 
    || event.headers['client-ip']
    || '0.0.0.0';
}
