/**
 * Client-side Session Cache for Mappls AutoSuggest
 * Caches partial query suggestions in-memory with a 5-minute TTL.
 * Eliminates redundant API calls during typing, editing, and backspacing.
 */

const suggestCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchSuggestionsWithCache(query, userCoords = null) {
  if (!query || typeof query !== 'string') return [];
  
  const cleanKey = query.trim().toLowerCase();
  if (cleanKey.length < 3) return [];

  // Read from localStorage if userCoords was not explicitly passed
  let coords = userCoords;
  if ((!coords || !coords.lat || !coords.lng) && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('roomfind_user_gps');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.lat && parsed.lng) {
          coords = { lat: parsed.lat, lng: parsed.lng };
        }
      }
    } catch (_) {}
  }

  const cacheKey = coords && coords.lat && coords.lng
    ? `${cleanKey}_${coords.lat.toFixed(2)}_${coords.lng.toFixed(2)}`
    : cleanKey;

  // Check in-memory session cache
  const cached = suggestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results; // 0 API Calls
  }

  try {
    let url = `/api/mappls/autosuggest?query=${encodeURIComponent(cleanKey)}`;
    if (coords && coords.lat && coords.lng) {
      url += `&lat=${coords.lat}&lng=${coords.lng}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const results = Array.isArray(data.suggestedLocations) ? data.suggestedLocations : [];
      suggestCache.set(cacheKey, { results, timestamp: Date.now() });
      return results;
    }
  } catch (err) {
    console.error('AutoSuggest cache fetch error:', err);
  }

  return [];
}
