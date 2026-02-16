// Proxy to FlyAndEarn API to avoid CORS issues
export default async (request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const currency = url.searchParams.get('currency') || 'EUR';
  const region = url.searchParams.get('region') || 'all';
  const includeRetail = url.searchParams.get('includeRetail') || 'true';

  try {
    const apiUrl = `https://flyandearn-api.fly.dev/api/v1/research/prices?q=${encodeURIComponent(q)}&currency=${currency}&region=${region}&includeRetail=${includeRetail}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const config = {
  path: ["/api/prices", "/.netlify/functions/prices"]
};
