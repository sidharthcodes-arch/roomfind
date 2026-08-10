/**
 * Geocoding Helper for Mappls API (MapmyIndia)
 * Converts location/address strings to { lat, lng } coordinates.
 */

// Local coordinate dictionary for instant (0ms) lookup of popular locations
const KNOWN_LOCATIONS = {
  'koramangala': { lat: 12.9352, lng: 77.6245 },
  'hsr layout': { lat: 12.9121, lng: 77.6446 },
  'hsr': { lat: 12.9121, lng: 77.6446 },
  'indiranagar': { lat: 12.9784, lng: 77.6408 },
  'whitefield': { lat: 12.9698, lng: 77.7500 },
  'btm layout': { lat: 12.9166, lng: 77.6101 },
  'btm': { lat: 12.9166, lng: 77.6101 },
  'jayanagar': { lat: 12.9308, lng: 77.5838 },
  'jp nagar': { lat: 12.9077, lng: 77.5854 },
  'bellandur': { lat: 12.9260, lng: 77.6762 },
  'marathahalli': { lat: 12.9591, lng: 77.6974 },
  'electronic city': { lat: 12.8399, lng: 77.6770 },
  'courtmore': { lat: 26.7082, lng: 88.4289 },
  'court more': { lat: 26.7082, lng: 88.4289 },
  'siliguri': { lat: 26.7271, lng: 88.3953 },
  'darjeeling': { lat: 27.0410, lng: 88.2663 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 }
};

export async function geocodeLocation(locationName) {
  if (!locationName || typeof locationName !== 'string') return null;

  const normalized = locationName.toLowerCase().trim();

  // 1. Check local lookup dictionary first (0ms instant match)
  if (KNOWN_LOCATIONS[normalized]) {
    return KNOWN_LOCATIONS[normalized];
  }

  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }

  // 2. Call Mappls / Geocoding API if key configured
  const apiKey = process.env.NEXT_PUBLIC_MAPPLS_API_KEY;
  if (apiKey) {
    try {
      const url = `https://atlas.mappls.com/api/places/geocode?address=${encodeURIComponent(locationName)}&itemCount=1`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.copResults && data.copResults.length > 0) {
          const { latitude, longitude } = data.copResults[0];
          return {
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
          };
        }
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  }

  // Fallback to Bangalore center
  return { lat: 12.9716, lng: 77.5946 };
}
