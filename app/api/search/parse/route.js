import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { query } = await req.json();

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

CRITICAL INSTRUCTIONS:
1. Extract "location": The specific place, landmark, neighborhood, or area name (e.g. "Koramangala", "HSR Layout", "Christ University"). Strip filler words like "near", "in", "around", "room", "flat", "looking for". If the user says "near me", set location to null and "is_near_me" to true.
2. Extract "max_price": Number in INR (e.g. "15k" or "under 15000" -> 15000, "under 10k" -> 10000). Set to null if not mentioned.
3. Extract "room_type": "single" if 1bhk/private/single, "shared" if sharing/roommate/flatmate/2bhk shared. Set to null if not specified.
4. Extract "furnished": boolean true if "furnished" or "fully furnished" mentioned, else null.
5. Extract "gender_preference": "female" if girl/female/women, "male" if boy/male/men, "all" if specified or null.
6. Extract "is_near_me": boolean true if query explicitly asks for places "near me" or "around me".

Return ONLY a single valid JSON object matching this schema EXACTLY:
{
  "location": string | null,
  "max_price": number | null,
  "room_type": "single" | "shared" | null,
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
      const errText = await groqResponse.text();
      console.error('Groq API error:', errText);
      return NextResponse.json(fallbackParse(query));
    }

    const data = await groqResponse.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

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
    .replace(/\b(room|rooms|flat|pg|near|in|around|me|female|male|girl|girls|boy|boys|furnished|single|shared|sharing|1bhk|2bhk|under|looking for)\b/gi, '')
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
