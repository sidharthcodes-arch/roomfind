/**
 * Fast Local Regex Search Parser
 * Classifies simple queries (0ms) before handing off to AI if complex.
 */

export function parseQueryLocally(query) {
  if (!query || typeof query !== 'string') {
    return { isSimple: true, isNearMe: false, location: '', filters: {} };
  }

  const text = query.toLowerCase().trim();

  // 1. Detect 'near me' / 'around me' / 'current location'
  const isNearMe = /\b(near me|around me|my location|current location|nearby)\b/i.test(text);

  if (isNearMe) {
    return {
      isSimple: true,
      isNearMe: true,
      location: '',
      filters: {}
    };
  }

  // 2. Indicators of strict filters (budgets, bhk layout, roommate requirements)
  const hasFilterKeywords = /\b(under|below|above|1bhk|2bhk|3bhk|1rk|roommate|flatmate|pg|single|shared|sharing|furnished|unfurnished|female|male|boy|girl|women|men|budget|cheap|₹|\d+k)\b/i.test(text);

  // 3. If there are no strict filter keywords, extract clean location phrase
  if (!hasFilterKeywords) {
    let cleanLocation = query
      .replace(/\b(rooms?|flats?|places?|spaces?|rentals?)\b/gi, '')
      .replace(/\b(near|in|around|at)\b/gi, '')
      .trim();

    // Auto-fix concatenated landmark typos (e.g. "darjeelingmore" -> "darjeeling more", "courtmore" -> "court more")
    cleanLocation = cleanLocation.replace(/([a-z]+)more\b/gi, '$1 more');

    return {
      isSimple: true,
      isNearMe: false,
      location: cleanLocation || query.trim(),
      filters: {}
    };
  }

  // 4. Mark as complex -> Hand over to Groq AI Parser
  return { isSimple: false };
}
