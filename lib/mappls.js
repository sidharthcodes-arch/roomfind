/**
 * Pure Mappls Geocoding Helper (MapmyIndia)
 * Uses Mappls Geocode API for location validation and address extraction.
 */

export async function geocodeLocation(locationName) {
  if (!locationName || typeof locationName !== 'string') return null;

  const apiKey = process.env.NEXT_PUBLIC_MAPPLS_API_KEY;
  const cleanQuery = locationName.trim();

  if (!apiKey) return null;

  try {
    const url = `https://search.mappls.com/search/address/geocode?address=${encodeURIComponent(cleanQuery)}&access_token=${apiKey}`;
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://roomfind.vercel.app',
        'Origin': 'https://roomfind.vercel.app',
        'User-Agent': 'Mozilla/5.0'
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.copResults) {
        const result = Array.isArray(data.copResults) ? data.copResults[0] : data.copResults;

        if (result && result.latitude && result.longitude) {
          return {
            lat: parseFloat(result.latitude),
            lng: parseFloat(result.longitude),
            eLoc: result.eLoc || null,
            formattedAddress: result.formattedAddress || null
          };
        }

        return {
          eLoc: result?.eLoc || null,
          formattedAddress: result?.formattedAddress || result?.locality || cleanQuery
        };
      }
    }
  } catch (err) {
    console.error('Mappls Geocoding error:', err);
  }

  return null;
}
