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

  // 2. Check if the query is a simple single/double word location name
  // Examples: "Koramangala", "HSR Layout", "Indiranagar", "Whitefield"
  const words = text.split(/\s+/).filter(Boolean);
  
  // Indicators of complex search terms (filters, budgets, requirements)
  const hasFilterKeywords = /\b(under|below|above|bhk|room|roommate|flat|pg|single|shared|sharing|furnished|female|male|boy|girl|women|men|budget|cheap|₹|\d+k|\d{4,})\b/i.test(text);

  if (words.length <= 2 && !hasFilterKeywords) {
    return {
      isSimple: true,
      isNearMe: false,
      location: text,
      filters: {}
    };
  }

  // 3. Mark as complex -> Hand over to Groq AI Parser
  return { isSimple: false };
}
