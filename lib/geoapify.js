/**
 * Geoapify Geocoding Helper
 * Converts location/address strings to precise { lat, lng } coordinates.
 * Includes in-memory geoCache to avoid redundant API calls for repeated locations.
 */

const geoCache = new Map();

export async function geocodeLocationWithGeoapify(locationName, userCoords = null) {
  if (!locationName || typeof locationName !== 'string') return null;

  const cleanKey = locationName.trim().toLowerCase();
  if (!cleanKey) return null;

  const cacheKey = userCoords && userCoords.lat && userCoords.lng
    ? `${cleanKey}_${userCoords.lat.toFixed(2)}_${userCoords.lng.toFixed(2)}`
    : cleanKey;

  // 1. Check in-memory coordinate cache
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey); // 0 Geoapify API Calls!
  }

  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
  if (!apiKey) {
    console.warn('Geoapify API key missing.');
    return null;
  }

  try {
    let url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cleanKey)}&filter=countrycode:in&apiKey=${apiKey}`;

    // Dynamic Proximity Bias: Biases search to landmarks closest to user's live GPS position
    if (userCoords && userCoords.lat && userCoords.lng) {
      url += `&bias=proximity:${userCoords.lng},${userCoords.lat}`;
    }

    const res = await fetch(url);

    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const firstMatch = data.features[0];
        const [lng, lat] = firstMatch.geometry.coordinates;
        const result = {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          formatted: firstMatch.properties.formatted || locationName
        };

        // Cache coordinates for future lookups
        geoCache.set(cacheKey, result);
        return result;
      }
    }

    // 2. Silent Mappls/Geoapify AutoSuggest Disambiguation Fallback for Indian Typo Landmarks (e.g. "darjeelingmore")
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const mapRes = await fetch(`${baseUrl}/api/mappls/autosuggest?query=${encodeURIComponent(cleanKey)}`);

      if (mapRes.ok) {
        const mapData = await mapRes.json();
        const suggestions = mapData.suggestedLocations || [];
        if (suggestions.length > 0) {
          const topMatch = suggestions[0];
          const refinedText = topMatch.placeAddress || topMatch.placeName;
          if (refinedText) {
            const refUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(refinedText)}&filter=countrycode:in&apiKey=${apiKey}`;
            const refRes = await fetch(refUrl);
            if (refRes.ok) {
              const refData = await refRes.json();
              if (refData.features && refData.features.length > 0) {
                const fMatch = refData.features[0];
                const [rLng, rLat] = fMatch.geometry.coordinates;
                const result = {
                  lat: parseFloat(rLat),
                  lng: parseFloat(rLng),
                  formatted: fMatch.properties.formatted || refinedText
                };
                geoCache.set(cacheKey, result);
                return result;
              }
            }
          }
        }
      }
    } catch (_) {}
  } catch (err) {
    console.error('Geoapify Geocoding error:', err);
  }

  return null;
}

export async function geocodeLocation(locationName, userCoords = null) {
  return geocodeLocationWithGeoapify(locationName, userCoords);
}
