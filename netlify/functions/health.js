import prisma from './lib/prisma.js';

export async function handler(event) {
  const checks = { db: 'unknown', env: {} };
  
  // Check env vars
  checks.env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'not set',
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
  };

  // Check DB
  try {
    const count = await prisma.user.count();
    checks.db = `ok (${count} users)`;
  } catch (e) {
    checks.db = `error: ${e.message}`;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ok', checks, timestamp: new Date().toISOString() }),
  };
}

export const config = {
  path: ['/api/health', '/.netlify/functions/health'],
};
