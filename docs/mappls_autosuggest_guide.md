# Mappls AutoSuggest API Implementation Guide

This guide documents the exact architecture, API endpoints, backend proxy route, and frontend UI component code required to re-integrate **Mappls Location AutoSuggest** into the RoomFind application.

---

## 1. Overview & Architecture

Calling Mappls APIs directly from client-side browser code causes two primary issues:

1. **CORS Restrictions**: Browsers block direct client-side fetch requests to `search.mappls.com`.
2. **Localhost Origin Header**: Browsers automatically attach `Referer: http://localhost:3000`, which Mappls security filters block unless proxies are used.

To solve this, use a **Next.js Server Proxy API Route** (`/api/mappls/autosuggest/route.js`). The client fetches from the same origin, while the Next.js server forwards requests to Mappls with the whitelisted `Referer: https://roomfind.vercel.app` header.

---

## 2. API Endpoint Specification

- **Official Mappls Endpoint**:
  `https://search.mappls.com/search/places/autosuggest/json?query={LOCATION_QUERY}&access_token={MAPPLS_API_KEY}`
- **Required Request Headers**:
  ```http
  Referer: https://roomfind.vercel.app
  Origin: https://roomfind.vercel.app
  User-Agent: Mozilla/5.0
  ```
- **Sample Response Payload**:
  ```json
  {
    "suggestedLocations": [
      {
        "type": "LOCALITY",
        "placeName": "Court More",
        "placeAddress": "Siliguri, West Bengal, 734001",
        "eLoc": "GBCGEZ"
      },
      {
        "type": "SUB_LOCALITY",
        "placeName": "Court More",
        "placeAddress": "Rabindra Nagar, Asansol, West Bengal, 713304",
        "eLoc": "UHL6EK"
      }
    ]
  }
  ```

---

## 3. Step-by-Step Code Implementation

### Step A: Create Next.js Server Proxy Route

File: `app/api/mappls/autosuggest/route.js`

```javascript
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.NEXT_PUBLIC_MAPPLS_API_KEY;
  if (!apiKey) {
    return NextResponse.json([]);
  }

  try {
    const url = `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(query.trim())}&access_token=${apiKey}`;
    const res = await fetch(url, {
      headers: {
        Referer: "https://roomfind.vercel.app",
        Origin: "https://roomfind.vercel.app",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.suggestedLocations && Array.isArray(data.suggestedLocations)) {
        const results = data.suggestedLocations.map((item) => ({
          placeName: item.placeName || "",
          placeAddress: item.placeAddress || "",
          eLoc: item.eLoc || "",
          type: item.type || "Location",
        }));
        return NextResponse.json(results);
      }
    }
  } catch (err) {
    console.error("Mappls AutoSuggest proxy error:", err);
  }

  return NextResponse.json([]);
}
```

---

### Step B: Helper Function in `lib/mappls.js`

```javascript
export async function fetchMapplsAutoSuggest(query) {
  if (!query || typeof query !== "string" || query.trim().length < 2) return [];

  try {
    const res = await fetch(
      `/api/mappls/autosuggest?query=${encodeURIComponent(query.trim())}`,
    );
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error("AutoSuggest fetch error:", err);
  }

  return [];
}
```

---

### Step C: UI Integration in `app/search/page.js`

1. **State & Effect**:

   ```javascript
   const [autoSuggestions, setAutoSuggestions] = useState([]);
   const [showAutoSuggest, setShowAutoSuggest] = useState(false);
   const [isSuggesting, setIsSuggesting] = useState(false);

   useEffect(() => {
     if (!searchQuery || searchQuery.trim().length < 2) {
       setAutoSuggestions([]);
       setShowAutoSuggest(false);
       return;
     }

     const timer = setTimeout(async () => {
       setIsSuggesting(true);
       const results = await fetchMapplsAutoSuggest(searchQuery);
       setAutoSuggestions(results);
       setShowAutoSuggest(results.length > 0);
       setIsSuggesting(false);
     }, 250);

     return () => clearTimeout(timer);
   }, [searchQuery]);
   ```

2. **Dropdown JSX**:
   ```jsx
   {
     showAutoSuggest && autoSuggestions.length > 0 && (
       <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-black/[0.1] shadow-xl overflow-hidden z-50 animate-fade-in">
         <div className="px-3.5 py-2 bg-slate-50 border-b border-black/[0.05] flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
           <span className="flex items-center gap-1.5">
             <MapPin className="w-3 h-3 text-brand" /> Mappls Location
             Suggestions
           </span>
           {isSuggesting && (
             <Loader2 className="w-3 h-3 animate-spin text-brand" />
           )}
         </div>
         <div className="max-h-60 overflow-y-auto divide-y divide-black/[0.04]">
           {autoSuggestions.map((item, idx) => (
             <button
               key={idx}
               onClick={() => {
                 setSearchQuery(item.placeName);
                 setShowAutoSuggest(false);
               }}
               className="w-full px-3.5 py-2.5 text-left hover:bg-brand-light transition-colors flex items-start gap-2.5 group"
             >
               <MapPin className="w-4 h-4 text-brand shrink-0 mt-0.5" />
               <div className="min-w-0 flex-1">
                 <p className="text-[13px] font-semibold text-slate-800 group-hover:text-brand transition-colors truncate">
                   {item.placeName}
                 </p>
                 {item.placeAddress && (
                   <p className="text-[11px] text-slate-400 truncate">
                     {item.placeAddress}
                   </p>
                 )}
               </div>
             </button>
           ))}
         </div>
       </div>
     );
   }
   ```
