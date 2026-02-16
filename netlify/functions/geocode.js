// Netlify Function: Geocode address using Nominatim (OpenStreetMap)
// Server-side geocoding to avoid API key exposure

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { address, street, city, postalCode, country } = JSON.parse(event.body || '{}');

    // Build address string
    let addressString = address;
    if (!addressString && (street || city || country)) {
      const parts = [street, postalCode, city, country].filter(Boolean);
      addressString = parts.join(', ');
    }

    if (!addressString) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Address is required' }),
      };
    }

    // Call Nominatim API (free, no API key needed)
    const encodedAddress = encodeURIComponent(addressString);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FlyAndEarn/1.0 (https://flyandearn.eu)',
      },
    });

    if (!response.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Geocoding service unavailable' }),
      };
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Address not found',
          address: addressString,
        }),
      };
    }

    const result = results[0];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        address: addressString,
      }),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
