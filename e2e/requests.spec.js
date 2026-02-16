import { test, expect } from '@playwright/test';

// Generate unique email for this test file
const buyerEmail = `buyer${Date.now()}@example.com`;
const travelerEmail = `traveler${Date.now()}@example.com`;
const testPassword = 'TestPassword123';

let buyerSessionCookie = '';
let travelerSessionCookie = '';

// Helper to extract session cookie from response
function getSessionCookie(response) {
  const cookieHeader = response.headers()['set-cookie'];
  if (!cookieHeader) return '';
  const cookies = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  return cookies?.split(';')[0] || '';
}

test.describe('Request Flow', () => {
  test.beforeAll(async ({ request }) => {
    // Register and login as buyer
    await request.post('/.netlify/functions/register', {
      data: {
        email: buyerEmail,
        password: testPassword,
        name: 'Test Buyer',
        isBuyer: true,
      },
    });

    const buyerLogin = await request.post('/.netlify/functions/login', {
      data: { email: buyerEmail, password: testPassword },
    });
    buyerSessionCookie = getSessionCookie(buyerLogin);

    // Register and login as traveler
    await request.post('/.netlify/functions/register', {
      data: {
        email: travelerEmail,
        password: testPassword,
        name: 'Test Traveler',
        isTraveler: true,
      },
    });

    const travelerLogin = await request.post('/.netlify/functions/login', {
      data: { email: travelerEmail, password: testPassword },
    });
    travelerSessionCookie = getSessionCookie(travelerLogin);
  });

  test('GET /requests returns empty list initially', async ({ request }) => {
    const response = await request.get('/.netlify/functions/requests');

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.requests).toBeDefined();
    expect(Array.isArray(body.requests)).toBe(true);
  });

  test('POST /requests requires authentication', async ({ request }) => {
    const response = await request.post('/.netlify/functions/requests', {
      data: {
        requestType: 'DUTY_FREE',
        items: [{ itemName: 'Test Item', quantity: 1 }],
        fromAirport: 'JFK',
        fromCity: 'New York',
        toAirport: 'LHR',
        toCity: 'London',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /requests creates a new request', async ({ request }) => {
    const response = await request.post('/.netlify/functions/requests', {
      headers: { Cookie: buyerSessionCookie },
      data: {
        requestType: 'DUTY_FREE',
        items: [
          {
            itemName: 'Chanel No. 5',
            quantity: 1,
            budgetPrice: 100,
            category: 'perfume',
          },
        ],
        fromAirport: 'CDG',
        fromCity: 'Paris',
        toAirport: 'WAW',
        toCity: 'Warsaw',
        currency: 'EUR',
        maxPrice: 120,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.request).toBeDefined();
    expect(body.request.id).toBeDefined();
    expect(body.request.requestType).toBe('DUTY_FREE');
    expect(body.request.maxPrice).toBe(120);
  });

  test('POST /requests validates required fields', async ({ request }) => {
    const response = await request.post('/.netlify/functions/requests', {
      headers: { Cookie: buyerSessionCookie },
      data: {
        requestType: 'DUTY_FREE',
        items: [{ itemName: 'Test', quantity: 1 }],
        // Missing fromAirport, toAirport
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('POST /requests validates item quantity', async ({ request }) => {
    const response = await request.post('/.netlify/functions/requests', {
      headers: { Cookie: buyerSessionCookie },
      data: {
        requestType: 'DUTY_FREE',
        items: [{ itemName: 'Test', quantity: 0 }], // Invalid quantity
        fromAirport: 'JFK',
        fromCity: 'New York',
        toAirport: 'LHR',
        toCity: 'London',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('GET /requests with filters', async ({ request }) => {
    // Filter by status
    const statusResponse = await request.get('/.netlify/functions/requests?status=OPEN');
    expect(statusResponse.status()).toBe(200);

    // Filter by city
    const cityResponse = await request.get('/.netlify/functions/requests?toCity=Warsaw');
    expect(cityResponse.status()).toBe(200);

    // Limit results
    const limitResponse = await request.get('/.netlify/functions/requests?limit=5');
    expect(limitResponse.status()).toBe(200);
    const body = await limitResponse.json();
    expect(body.requests.length).toBeLessThanOrEqual(5);
  });

  test('Traveler can make offer on request', async ({ request }) => {
    // First create a request as buyer
    const createResponse = await request.post('/.netlify/functions/requests', {
      headers: { Cookie: buyerSessionCookie },
      data: {
        requestType: 'DUTY_FREE',
        items: [{ itemName: 'Whisky', quantity: 1, budgetPrice: 50 }],
        fromAirport: 'DUB',
        fromCity: 'Dublin',
        toAirport: 'WAW',
        toCity: 'Warsaw',
      },
    });

    expect(createResponse.status()).toBe(201);
    const { request: createdRequest } = await createResponse.json();

    // Make offer as traveler
    const offerResponse = await request.put('/.netlify/functions/requests', {
      headers: { Cookie: travelerSessionCookie },
      data: {
        id: createdRequest.id,
        action: 'offer',
        message: 'I can deliver this!',
      },
    });

    expect(offerResponse.status()).toBe(201);
    const offerBody = await offerResponse.json();
    expect(offerBody.success).toBe(true);
    expect(offerBody.offer).toBeDefined();
  });

  test('Cannot make duplicate offer', async ({ request }) => {
    // Create a request
    const createResponse = await request.post('/.netlify/functions/requests', {
      headers: { Cookie: buyerSessionCookie },
      data: {
        requestType: 'DUTY_FREE',
        items: [{ itemName: 'Chocolate', quantity: 2, budgetPrice: 20 }],
        fromAirport: 'ZRH',
        fromCity: 'Zurich',
        toAirport: 'KRK',
        toCity: 'Krakow',
      },
    });

    const { request: createdRequest } = await createResponse.json();

    // First offer
    await request.put('/.netlify/functions/requests', {
      headers: { Cookie: travelerSessionCookie },
      data: {
        id: createdRequest.id,
        action: 'offer',
      },
    });

    // Duplicate offer should fail
    const duplicateResponse = await request.put('/.netlify/functions/requests', {
      headers: { Cookie: travelerSessionCookie },
      data: {
        id: createdRequest.id,
        action: 'offer',
      },
    });

    expect(duplicateResponse.status()).toBe(400);
    const body = await duplicateResponse.json();
    expect(body.error).toContain('already');
  });
});

test.describe('Request CRUD Operations', () => {
  let requestId = '';

  test.beforeAll(async ({ request }) => {
    // Register a new user for CRUD tests
    const crudEmail = `crud${Date.now()}@example.com`;
    await request.post('/.netlify/functions/register', {
      data: {
        email: crudEmail,
        password: testPassword,
        name: 'CRUD User',
        isBuyer: true,
      },
    });

    // Login as the new user
    const loginResponse = await request.post('/.netlify/functions/login', {
      data: { email: crudEmail, password: testPassword },
    });
    buyerSessionCookie = getSessionCookie(loginResponse);
  });

  test('Create request and verify it appears in list', async ({ request }) => {
    // Create
    const createResponse = await request.post('/.netlify/functions/requests', {
      headers: { Cookie: buyerSessionCookie },
      data: {
        requestType: 'OUTSIDE_DUTY_FREE',
        items: [
          {
            itemName: 'Special Item',
            quantity: 1,
            budgetPrice: 75,
            itemSource: 'OUTSIDE_DUTY_FREE',
            storeName: 'Amazon',
          },
        ],
        fromAirport: 'FRA',
        fromCity: 'Frankfurt',
        toAirport: 'GDN',
        toCity: 'Gdansk',
        generalNotes: 'Test request for CRUD',
      },
    });

    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json();
    requestId = createBody.request.id;

    // Verify in list
    const listResponse = await request.get(`/.netlify/functions/requests?buyerId=${createBody.request.buyerId}`);
    const listBody = await listResponse.json();
    const found = listBody.requests.find((r) => r.id === requestId);
    expect(found).toBeDefined();
  });

  test('Update request', async ({ request }) => {
    const updateResponse = await request.put('/.netlify/functions/requests', {
      headers: { Cookie: buyerSessionCookie },
      data: {
        id: requestId,
        generalNotes: 'Updated notes',
      },
    });

    expect(updateResponse.status()).toBe(200);
    const body = await updateResponse.json();
    expect(body.request.generalNotes).toBe('Updated notes');
  });

  test('Delete request', async ({ request }) => {
    const deleteResponse = await request.delete(`/.netlify/functions/requests?id=${requestId}`, {
      headers: { Cookie: buyerSessionCookie },
    });

    expect(deleteResponse.status()).toBe(200);
    const body = await deleteResponse.json();
    expect(body.success).toBe(true);
  });

  test('Cannot delete non-existent request', async ({ request }) => {
    const deleteResponse = await request.delete('/.netlify/functions/requests?id=nonexistent123', {
      headers: { Cookie: buyerSessionCookie },
    });

    expect(deleteResponse.status()).toBe(404);
  });
});
