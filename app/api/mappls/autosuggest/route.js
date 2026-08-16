import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!query || query.trim().length < 3) {
    return NextResponse.json({ suggestedLocations: [] });
  }

  const apiKey = process.env.NEXT_PUBLIC_MAPPLS_API_KEY;
  const cleanQuery = query.trim();
  const hasCoords = lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng));

  // Primary Endpoint: Mappls Atlas AutoSuggest with Location Bias
  if (apiKey) {
    try {
      let atlasUrl = `https://atlas.mappls.com/api/places/autosuggest/json?query=${encodeURIComponent(cleanQuery)}&access_token=${apiKey}`;
      if (hasCoords) {
        atlasUrl += `&location=${lat},${lng}`;
      }

      const res = await fetch(atlasUrl, {
        headers: {
          'Referer': 'https://roomfind.vercel.app',
          'Origin': 'https://roomfind.vercel.app',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const suggestions = data.suggestedLocations || data.autosuggest || [];
        if (suggestions.length > 0) {
          return NextResponse.json({ suggestedLocations: suggestions });
        }
      }
    } catch (e) {
      console.warn('Mappls fetch failed, switching to Geoapify fallback:', e.message);
    }
  }

  // Resilient Fallback Endpoint: Geoapify AutoSuggest with Proximity Bias
  const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
  if (geoapifyKey) {
    try {
      let geoUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(cleanQuery)}&apiKey=${geoapifyKey}&filter=countrycode:in`;
      if (hasCoords) {
        geoUrl += `&bias=proximity:${lng},${lat}`;
      }

      const res = await fetch(geoUrl);
      if (res.ok) {
        const geoData = await res.json();
        const suggestions = (geoData.features || []).map(f => ({
          placeName: f.properties.formatted || f.properties.address_line1,
          placeAddress: f.properties.formatted
        }));
        return NextResponse.json({ suggestedLocations: suggestions });
      }
    } catch (e) {
      console.error('Geoapify fallback error:', e.message);
    }
  }

  return NextResponse.json({ suggestedLocations: [] });
}
