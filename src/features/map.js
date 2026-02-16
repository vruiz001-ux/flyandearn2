/**
 * FlyAndEarn - Map Feature (Lazy Loaded)
 * Loads Leaflet map library and CSS only when needed
 */

let leafletLoaded = false;
let mapInstance = null;

async function loadLeafletCSS() {
  if (document.querySelector('link[href*="leaflet"]')) return;

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/leaflet.min.css';
    link.onload = resolve;
    document.head.appendChild(link);
  });
}

async function loadLeafletJS() {
  if (window.L) return window.L;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/leaflet.min.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function loadLeaflet() {
  if (leafletLoaded && window.L) return window.L;

  await Promise.all([loadLeafletCSS(), loadLeafletJS()]);
  leafletLoaded = true;
  return window.L;
}

export async function initMap(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const L = await loadLeaflet();

  const defaultOptions = {
    center: [51.505, -0.09],
    zoom: 13,
    ...options,
  };

  mapInstance = L.map(containerId, defaultOptions);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance);

  return mapInstance;
}

export function getMapInstance() {
  return mapInstance;
}

export function initMapLazyLoad() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  // Use IntersectionObserver to load map when visible
  const observer = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();

          // Initialize map with default options
          await initMap('map', {
            center: [52.2297, 21.0122], // Warsaw
            zoom: 5,
          });

          // Dispatch event for app to handle
          window.dispatchEvent(new CustomEvent('mapLoaded', { detail: { map: mapInstance } }));
          break;
        }
      }
    },
    {
      rootMargin: '100px',
      threshold: 0,
    }
  );

  observer.observe(mapContainer);
}

// Expose for backward compatibility
if (typeof window !== 'undefined') {
  window.loadLeaflet = loadLeaflet;
  window.initMap = initMap;
}

export default { loadLeaflet, initMap, initMapLazyLoad };
