/**
 * Client-side Session Cache for Mappls AutoSuggest
 * Caches partial query suggestions in-memory with a 5-minute TTL.
 * Eliminates redundant API calls during typing, editing, and backspacing.
 */

const suggestCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchSuggestionsWithCache(query) {
  if (!query || typeof query !== 'string') return [];
  
  const cleanKey = query.trim().toLowerCase();
  if (cleanKey.length < 3) return [];

  // Check in-memory session cache
  const cached = suggestCache.get(cleanKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results; // 0 API Calls
  }

  try {
    const res = await fetch(`/api/mappls/autosuggest?query=${encodeURIComponent(cleanKey)}`);
    if (res.ok) {
      const data = await res.json();
      const results = Array.isArray(data.suggestedLocations) ? data.suggestedLocations : [];
      suggestCache.set(cleanKey, { results, timestamp: Date.now() });
      return results;
    }
  } catch (err) {
    console.error('AutoSuggest cache fetch error:', err);
  }

  return [];
}
