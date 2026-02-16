import { test, expect } from '@playwright/test';

const travelerEmail = `traveler_trips${Date.now()}@example.com`;
const testPassword = 'TestPassword123';
let sessionCookie = '';

// Helper to extract session cookie from response
function getSessionCookie(response) {
  const cookieHeader = response.headers()['set-cookie'];
  if (!cookieHeader) return '';
  const cookies = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  return cookies?.split(';')[0] || '';
}

test.describe('Trips Flow', () => {
  test.beforeAll(async ({ request }) => {
    // Register and login as traveler
    await request.post('/.netlify/functions/register', {
      data: {
        email: travelerEmail,
        password: testPassword,
        name: 'Trip Traveler',
        isTraveler: true,
      },
    });

    const loginResponse = await request.post('/.netlify/functions/login', {
      data: { email: travelerEmail, password: testPassword },
    });
    sessionCookie = getSessionCookie(loginResponse);
  });

  test('GET /trips returns list', async ({ request }) => {
    const response = await request.get('/.netlify/functions/trips');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.trips)).toBe(true);
  });

  test('POST /trips requires authentication', async ({ request }) => {
    const response = await request.post('/.netlify/functions/trips', {
      data: {
        fromAirport: 'JFK',
        fromCity: 'New York',
        toAirport: 'LHR',
        toCity: 'London',
        departureDate: '2025-06-01',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /trips creates a new trip', async ({ request }) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const departureDate = futureDate.toISOString().split('T')[0];

    const returnDate = new Date(futureDate);
    returnDate.setDate(returnDate.getDate() + 7);
    const returnDateStr = returnDate.toISOString().split('T')[0];

    const response = await request.post('/.netlify/functions/trips', {
      headers: { Cookie: sessionCookie },
      data: {
        fromAirport: 'WAW',
        fromCity: 'Warsaw',
        toAirport: 'BCN',
        toCity: 'Barcelona',
        departureDate,
        returnDate: returnDateStr,
        availableKg: 5,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.trip).toBeDefined();
    expect(body.trip.fromAirport).toBe('WAW');
    expect(body.trip.toAirport).toBe('BCN');
  });

  test('POST /trips validates required fields', async ({ request }) => {
    const response = await request.post('/.netlify/functions/trips', {
      headers: { Cookie: sessionCookie },
      data: {
        fromAirport: 'JFK',
        // Missing other required fields
      },
    });

    expect(response.status()).toBe(400);
  });

  test('GET /trips filters by traveler', async ({ request }) => {
    const response = await request.get('/.netlify/functions/trips?mine=true', {
      headers: { Cookie: sessionCookie },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('GET /trips filters by destination city', async ({ request }) => {
    const response = await request.get('/.netlify/functions/trips?toCity=Barcelona');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('PUT /trips updates trip', async ({ request }) => {
    // First create a trip
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45);

    const createResponse = await request.post('/.netlify/functions/trips', {
      headers: { Cookie: sessionCookie },
      data: {
        fromAirport: 'KRK',
        fromCity: 'Krakow',
        toAirport: 'AMS',
        toCity: 'Amsterdam',
        departureDate: futureDate.toISOString().split('T')[0],
      },
    });

    const { trip } = await createResponse.json();

    // Update the trip
    const updateResponse = await request.put('/.netlify/functions/trips', {
      headers: { Cookie: sessionCookie },
      data: {
        id: trip.id,
        availableKg: 10,
        note: 'Updated notes',
      },
    });

    expect(updateResponse.status()).toBe(200);
    const updateBody = await updateResponse.json();
    expect(updateBody.trip.availableKg).toBe(10);
  });

  test('DELETE /trips removes trip', async ({ request }) => {
    // Create a trip to delete
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);

    const createResponse = await request.post('/.netlify/functions/trips', {
      headers: { Cookie: sessionCookie },
      data: {
        fromAirport: 'GDN',
        fromCity: 'Gdansk',
        toAirport: 'OSL',
        toCity: 'Oslo',
        departureDate: futureDate.toISOString().split('T')[0],
      },
    });

    const { trip } = await createResponse.json();

    // Delete
    const deleteResponse = await request.delete(`/.netlify/functions/trips?id=${trip.id}`, {
      headers: { Cookie: sessionCookie },
    });

    expect(deleteResponse.status()).toBe(200);
    const body = await deleteResponse.json();
    expect(body.success).toBe(true);
  });
});
