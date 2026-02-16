import { test, expect } from '@playwright/test';

const userEmail = `profile${Date.now()}@example.com`;
const testPassword = 'TestPassword123';
let sessionCookie = '';

// Helper to extract session cookie from response
function getSessionCookie(response) {
  const cookieHeader = response.headers()['set-cookie'];
  if (!cookieHeader) return '';
  const cookies = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  return cookies?.split(';')[0] || '';
}

test.describe('Profile Flow', () => {
  test.beforeAll(async ({ request }) => {
    // Register and login
    await request.post('/.netlify/functions/register', {
      data: {
        email: userEmail,
        password: testPassword,
        name: 'Profile Test User',
        isBuyer: true,
      },
    });

    const loginResponse = await request.post('/.netlify/functions/login', {
      data: { email: userEmail, password: testPassword },
    });
    sessionCookie = getSessionCookie(loginResponse);
  });

  test('GET /me requires authentication', async ({ request }) => {
    const response = await request.get('/.netlify/functions/me');
    expect(response.status()).toBe(401);
  });

  test('GET /me returns user data', async ({ request }) => {
    const response = await request.get('/.netlify/functions/me', {
      headers: { Cookie: sessionCookie },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(userEmail.toLowerCase());
    expect(body.user.name).toBe('Profile Test User');
  });

  test('PUT /profile updates user info', async ({ request }) => {
    const response = await request.put('/.netlify/functions/profile', {
      headers: { Cookie: sessionCookie },
      data: {
        name: 'Updated Name',
        phone: '+48123456789',
        city: 'Warsaw',
        country: 'Poland',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user.name).toBe('Updated Name');
    expect(body.user.city).toBe('Warsaw');
    expect(body.user.country).toBe('Poland');
  });

  test('PUT /profile updates buyer/traveler roles', async ({ request }) => {
    const response = await request.put('/.netlify/functions/profile', {
      headers: { Cookie: sessionCookie },
      data: {
        isBuyer: true,
        isTraveler: true,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.isBuyer).toBe(true);
    expect(body.user.isTraveler).toBe(true);
  });

  test('PUT /profile validates data', async ({ request }) => {
    // Invalid email should be rejected or sanitized
    const response = await request.put('/.netlify/functions/profile', {
      headers: { Cookie: sessionCookie },
      data: {
        name: '<script>alert("xss")</script>',
      },
    });

    // Should either reject or sanitize
    expect([200, 400]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      // Name should not contain script tags
      expect(body.user.name).not.toContain('<script>');
    }
  });

  test('Profile preserves existing data when updating partial fields', async ({ request }) => {
    // Set initial data
    await request.put('/.netlify/functions/profile', {
      headers: { Cookie: sessionCookie },
      data: {
        name: 'Full Name',
        city: 'Krakow',
        phone: '+48111222333',
      },
    });

    // Update only city
    const response = await request.put('/.netlify/functions/profile', {
      headers: { Cookie: sessionCookie },
      data: {
        city: 'Gdansk',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.city).toBe('Gdansk');
    // Other fields should be preserved
    expect(body.user.name).toBe('Full Name');
  });
});
