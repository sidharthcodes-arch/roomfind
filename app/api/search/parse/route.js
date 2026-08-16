import { NextResponse } from 'next/server';

export async function POST(req) {
  let query = '';
  try {
    const body = await req.json();
    query = body.query || '';

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;

    // Fallback if GROQ_API_KEY is not configured
    if (!apiKey) {
      console.warn('GROQ_API_KEY is missing. Using fallback parser.');
      return NextResponse.json(fallbackParse(query));
    }

    const systemPrompt = `You are a smart search assistant for RoomFind, a rental housing mobile app in India.
Extract structured search parameters from the user's natural language search input.

CRITICAL INSTRUCTIONS FOR LOCATION & BHK EXTRACTION:
1. Extract "location": The complete specific place, landmark, neighborhood, colony, or area name mentioned. For local landmarks (e.g. "Court More", "Darjeeling More", "Airview More", "Venus More"), preserve the location name fully as "Court More Siliguri" or "Court More" so geocoding finds the correct neighborhood.
2. Strip filler words like "room", "rooms", "flat", "looking for", "under", "place", "accommodation", "near". Generic words like "room" or "rooms" should NOT trigger a specific bhk_type filter unless explicitly specified.
3. Extract "bhk_type": 
   - "1BHK" if user mentions 1bhk / 1 bhk / one bhk
   - "2BHK" if user mentions 2bhk / 2 bhk / two bhk
   - "3BHK" if user mentions 3bhk / 3 bhk
   - "1RK" if user mentions 1rk / 1 rk
   - "Single Room" if user mentions single room / private room
   - Otherwise set to null if not specified.
4. Extract "room_type": "single" if private/single occupancy requested, "shared" if sharing/roommate/flatmate. Set to null if not specified.
5. Extract "max_price": Number in INR (e.g. "15k" or "under 15000" -> 15000, "under 10k" -> 10000). Set to null if not mentioned.
6. Extract "furnished": boolean true if "furnished" or "fully furnished" mentioned, else null.
7. Extract "gender_preference": "female" if girl/female/women, "male" if boy/male/men, "all" if specified or null.
8. Extract "is_near_me": boolean true if query explicitly asks for places "near me" or "around me".

Return ONLY a single valid JSON object matching this schema EXACTLY:
{
  "location": string | null,
  "bhk_type": "1BHK" | "2BHK" | "3BHK" | "1RK" | "Single Room" | null,
  "room_type": "single" | "shared" | null,
  "max_price": number | null,
  "furnished": boolean | null,
  "gender_preference": "female" | "male" | "all" | null,
  "is_near_me": boolean
}`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
      }),
    });

    if (!groqResponse.ok) {
      console.error('Groq API HTTP error:', groqResponse.status);
      return NextResponse.json(fallbackParse(query));
    }

    const data = await groqResponse.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    // Fallback Check: If AI missed a multi-word location in original query, fall back to regex parser
    const fallback = fallbackParse(query);
    if (!parsed.location && fallback.location) {
      parsed.location = fallback.location;
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Search parse API route error:', error);
    return NextResponse.json(fallbackParse(query));
  }
}

// Fallback Regex Parser in case AI API key is not set or network fails
function fallbackParse(query) {
  const text = query.toLowerCase();

  const isNearMe = /\b(near me|around me|my location)\b/.test(text);

  let maxPrice = null;
  const priceMatch = text.match(/(?:under|below|max|<=)?\s*₹?\s*(\d+)(k)?/i);
  if (priceMatch) {
    let val = parseInt(priceMatch[1], 10);
    if (priceMatch[2]) val *= 1000;
    if (val >= 1000) maxPrice = val;
  }

  let roomType = null;
  if (/\b(shared|sharing|flatmate|roommate)\b/.test(text)) roomType = 'shared';
  else if (/\b(single|private|1bhk|1rk)\b/.test(text)) roomType = 'single';

  let gender = null;
  if (/\b(female|girl|girls|women)\b/.test(text)) gender = 'female';
  else if (/\b(male|boy|boys|men)\b/.test(text)) gender = 'male';

  const furnished = /\bfurnished\b/.test(text) ? true : null;

  // Clean location string
  let location = text
    .replace(/(?:under|below|max|<=)?\s*₹?\s*\d+(?:k)?/gi, '')
    .replace(/\b(room|rooms|flat|pg|near|in|around|me|female|male|girl|girls|boy|boys|furnished|single|shared|sharing|1bhk|2bhk|3bhk|under|looking for)\b/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();

  return {
    location: location || null,
    max_price: maxPrice,
    room_type: roomType,
    furnished: furnished,
    gender_preference: gender,
    is_near_me: isNearMe,
  };
}
