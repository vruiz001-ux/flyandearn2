import prisma from './db';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const defaultConfig: RateLimitConfig = {
  maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  totalAttempts: number;
}

/**
 * Check rate limit for login attempts based on IP address
 */
export async function checkLoginRateLimit(
  ipAddress: string,
  config: RateLimitConfig = defaultConfig
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - config.windowMs);

  // Count failed attempts in the window
  const recentAttempts = await prisma.loginAttempt.count({
    where: {
      ipAddress,
      success: false,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  const remaining = Math.max(0, config.maxAttempts - recentAttempts);
  const allowed = remaining > 0;
  const resetAt = new Date(Date.now() + config.windowMs);

  return {
    allowed,
    remaining,
    resetAt,
    totalAttempts: recentAttempts,
  };
}

/**
 * Check rate limit for username-based attempts
 */
export async function checkUsernameRateLimit(
  username: string,
  config: RateLimitConfig = defaultConfig
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - config.windowMs);

  // Count failed attempts in the window
  const recentAttempts = await prisma.loginAttempt.count({
    where: {
      username,
      success: false,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  const remaining = Math.max(0, config.maxAttempts - recentAttempts);
  const allowed = remaining > 0;
  const resetAt = new Date(Date.now() + config.windowMs);

  return {
    allowed,
    remaining,
    resetAt,
    totalAttempts: recentAttempts,
  };
}

/**
 * Combined rate limit check (IP + username)
 */
export async function checkCombinedRateLimit(
  ipAddress: string,
  username: string,
  config: RateLimitConfig = defaultConfig
): Promise<{
  allowed: boolean;
  reason?: string;
  ipLimit: RateLimitResult;
  usernameLimit: RateLimitResult;
}> {
  const [ipLimit, usernameLimit] = await Promise.all([
    checkLoginRateLimit(ipAddress, config),
    checkUsernameRateLimit(username, config),
  ]);

  if (!ipLimit.allowed) {
    return {
      allowed: false,
      reason: 'Too many login attempts from this IP address. Please try again later.',
      ipLimit,
      usernameLimit,
    };
  }

  if (!usernameLimit.allowed) {
    return {
      allowed: false,
      reason: 'Too many login attempts for this username. Please try again later.',
      ipLimit,
      usernameLimit,
    };
  }

  return {
    allowed: true,
    ipLimit,
    usernameLimit,
  };
}

/**
 * Reset rate limit on successful login (optional - can be used to reward good behavior)
 * This doesn't actually delete records, just marks the context as successful
 */
export async function recordSuccessfulLogin(
  ipAddress: string,
  username: string
): Promise<void> {
  // The successful login is already recorded in loginAttempt table
  // Rate limiting only counts failed attempts, so this is informational
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': defaultConfig.maxAttempts.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
  };
}

/**
 * Clean up old login attempts (for maintenance)
 */
export async function cleanupOldLoginAttempts(olderThanDays: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const result = await prisma.loginAttempt.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
