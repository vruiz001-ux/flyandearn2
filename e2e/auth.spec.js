import { test, expect } from '@playwright/test';

// Generate unique email for each test run to avoid conflicts
const testEmail = `test${Date.now()}@example.com`;
const testPassword = 'TestPassword123';
const testName = 'Test User';

// Helper to extract session cookie from response
function getSessionCookie(response) {
  const cookieHeader = response.headers()['set-cookie'];
  if (!cookieHeader) return '';
  const cookies = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  return cookies?.split(';')[0] || '';
}

test.describe('Authentication Flow', () => {
  test('landing page loads correctly', async ({ page }) => {
    await page.goto('/');

    // Check that main elements are visible
    await expect(page.locator('body')).toBeVisible();

    // Check for FlyAndEarn branding
    const pageContent = await page.content();
    expect(pageContent).toContain('Fly');
    expect(pageContent).toContain('Earn');
  });

  test('dashboard page loads correctly', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Should see the dashboard layout - use first() to avoid strict mode
    await expect(page.locator('.sidebar').first()).toBeVisible();
  });

  test('registration via API', async ({ request }) => {
    const response = await request.post('/.netlify/functions/register', {
      data: {
        email: testEmail,
        password: testPassword,
        name: testName,
        isBuyer: true,
      },
    });

    // Should succeed or indicate user exists
    const status = response.status();
    expect([201, 409]).toContain(status);

    if (status === 201) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testEmail.toLowerCase());
    }
  });

  test('login via API with correct credentials', async ({ request }) => {
    // First register
    await request.post('/.netlify/functions/register', {
      data: {
        email: testEmail,
        password: testPassword,
        name: testName,
        isBuyer: true,
      },
    });

    // Then login
    const response = await request.post('/.netlify/functions/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();

    // Check for session cookie - headers might be string or array
    const cookieHeader = response.headers()['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
    expect(cookies).toContain('fae_session');
    expect(cookies).toContain('HttpOnly');
  });

  test('login fails with wrong password', async ({ request }) => {
    const response = await request.post('/.netlify/functions/login', {
      data: {
        email: testEmail,
        password: 'WrongPassword123',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('login fails with non-existent user', async ({ request }) => {
    const response = await request.post('/.netlify/functions/login', {
      data: {
        email: 'nonexistent@example.com',
        password: 'SomePassword123',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('registration validation - invalid email', async ({ request }) => {
    const response = await request.post('/.netlify/functions/register', {
      data: {
        email: 'invalid-email',
        password: testPassword,
        name: testName,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('registration validation - weak password', async ({ request }) => {
    const response = await request.post('/.netlify/functions/register', {
      data: {
        email: `weak${Date.now()}@example.com`,
        password: 'weak',
        name: testName,
        isBuyer: true,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('logout clears session', async ({ request }) => {
    // Login first
    const loginResponse = await request.post('/.netlify/functions/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    const sessionCookie = getSessionCookie(loginResponse);

    // Logout
    const logoutResponse = await request.post('/.netlify/functions/logout', {
      headers: {
        Cookie: sessionCookie,
      },
    });

    expect(logoutResponse.status()).toBe(200);

    // Check that cookie is cleared
    const logoutCookieHeader = logoutResponse.headers()['set-cookie'];
    const logoutCookies = Array.isArray(logoutCookieHeader) ? logoutCookieHeader.join('; ') : logoutCookieHeader;
    expect(logoutCookies).toContain('Max-Age=0');
  });

  test('protected endpoint returns 401 without auth', async ({ request }) => {
    const response = await request.get('/.netlify/functions/me');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('me endpoint returns user info when authenticated', async ({ request }) => {
    // Create a fresh user for this test
    const meTestEmail = `me${Date.now()}@example.com`;
    await request.post('/.netlify/functions/register', {
      data: {
        email: meTestEmail,
        password: testPassword,
        name: 'Me Test User',
        isBuyer: true,
      },
    });

    // Login
    const loginResponse = await request.post('/.netlify/functions/login', {
      data: {
        email: meTestEmail,
        password: testPassword,
      },
    });

    const sessionCookie = getSessionCookie(loginResponse);

    // Get user info
    const meResponse = await request.get('/.netlify/functions/me', {
      headers: {
        Cookie: sessionCookie,
      },
    });

    expect(meResponse.status()).toBe(200);
    const body = await meResponse.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(meTestEmail.toLowerCase());
  });
});
