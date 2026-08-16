# 🔍 RoomFind Search Engine — Detailed Technical Architecture

This document provides a comprehensive, step-by-step breakdown of how the **Search Engine & Search Button Execution Flow** works in RoomFind.

---

## 🏗️ High-Level System Architecture

```mermaid
graph TD
    A[User Enters Query & Taps Dedicated Search Button] --> B[Capture Device GPS for Proximity Bias]
    B --> C{Query Decision Router}
    
    C -->|Google-Style Suggestion Clicked| D[Path 1: Direct Suggestion Geocode]
    C -->|Simple Location Query| E[Path 2: Fast Local Regex Parser - 0ms]
    C -->|Complex Query / Filters| F[Path 3: Groq AI LLM Parser]
    
    D --> G[Geocoding & Disambiguation Engine]
    E --> G
    F --> G
    
    G --> H{In-Memory GeoCache Hit?}
    H -->|Yes| K[Target Coordinates {lat, lng}]
    H -->|No| I[Geoapify Primary Search + India Country Filter + GPS Bias]
    
    I -->|Match Found| K
    I -->|0 Matches / Typo Landmark| J[Silent Mappls AutoSuggest Disambiguation]
    J --> K
    
    K --> L[Display Resolved Location Banner Badge]
    L --> M[Supabase RPC: get_nearby_listings]
    M --> N[PostgreSQL Haversine Distance Calculation]
    N --> O[Results Ranked by Distance ASC]
    O --> P[Render Mobile Search Cards with Distance & BHK Badges]
```

---

## 🔄 Step-by-Step Execution Sequence

### Step 1: User Action & Google-Style AutoSuggest (`app/search/page.js`)
1. **Google-Style Hybrid AutoSuggest Dropdown**:
   * As the user types (e.g. `"rooms near courtmore"`), Mappls returns resolved place objects (`Court More, Kachari Road, Siliguri`).
   * Dropdown formats Google-style hybrid options:
     * 🔍 **rooms** near Court More, Kachari Road, Siliguri
     * 📍 **Court More**, Kachari Road, Siliguri
2. **Explicit Search Action**:
   * Search execution is explicitly triggered **ONLY when the user selects a suggestion, taps Search, or hits Enter**.
3. **GPS Proximity Bias Check**:
   * App attempts a fast (max 2000ms) browser geolocation check: `navigator.geolocation.getCurrentPosition()`.
   * If available, `userGps = { lat, lng }` is captured to weight map search results towards the user's current physical position.

---

### Step 2: Query Decision Router

#### 🟢 Path 1: Direct Suggestion Selected
* If the user selected a location from the autosuggest dropdown (`selectedSuggestionRef.current`), the app bypasses all regex and AI parsing.
* Passes the selected address directly to the Geocoding Engine.

#### ⚡ Path 2: Fast Local Regex Parser (`lib/searchParser.js`) — 0ms Execution
* Checks if query contains `'near me'`, `'around me'`, or `'current location'`.
* Scans for **strict filter keywords** (`1bhk`, `2bhk`, `3bhk`, `1rk`, `under 10k`, `furnished`, `female`).
* **If no strict filter keywords are present**:
  * Strips filler words (`"rooms"`, `"flats"`, `"places"`, `"near"`, `"in"`).
  * Extracts clean location string (e.g. `"rooms near court more"` $\rightarrow$ `location: "court more"`).
  * Sends extracted location directly to the Geocoding Engine.

#### 🤖 Path 3: Groq AI Natural Language Parser (`app/api/search/parse/route.js`)
* If query contains complex requirements (e.g. *"1bhk furnished under 8k in Siliguri"*), it sends an HTTP POST request to Groq AI (`llama-3.1-8b-instant`).
* Groq AI extracts structured JSON:
  ```json
  {
    "location": "Court More Siliguri",
    "bhk_type": "1BHK",
    "room_type": "single",
    "max_price": 8000,
    "furnished": true,
    "gender_preference": "any"
  }
  ```
* Extracted `location` is passed to the Geocoding Engine, while filter parameters (`bhk_type`, `max_price`, etc.) are prepared for the database query.

---

### Step 3: Geocoding & Silent Disambiguation Layer (`lib/geoapify.js`)

1. **Session Cache Check**:
   * Checks in-memory `geoCache` Map using key `${cleanKey}_${lat}_${lng}`.
   * If cached: Returns `{ lat, lng }` in **0ms with 0 API calls**.

2. **Primary Geoapify Lookup**:
   * API Request: `https://api.geoapify.com/v1/geocode/search?text=${cleanKey}&filter=countrycode:in`
   * Appends Proximity Bias: `&bias=proximity:${userGps.lng},${userGps.lat}` if GPS is available.

3. **Silent Mappls Disambiguation Fallback**:
   * If Geoapify returns 0 matches or fails to match a concatenated Indian landmark typo (e.g. `"darjeelingmore"`):
   * App silently invokes internal `/api/mappls/autosuggest?query=${cleanKey}`.
   * Mappls Atlas fuzzy-matches Indian place names $\rightarrow$ returns `"Darjeeling More, Siliguri, West Bengal"`.
   * Re-geocodes refined address, caches result in `geoCache`, and returns exact coordinates (`Lat 26.7344, Lng 88.4134`).

---

### Step 4: Database Proximity Query Engine (`Supabase RPC`)

App invokes Supabase PostgreSQL RPC function `get_nearby_listings`:

```sql
get_nearby_listings(
  search_lat := targetLat,
  search_lng := targetLng,
  page_offset := 0,
  page_size := 10,
  max_price_filter := maxPrice,
  room_type_filter := roomType,
  bhk_type_filter := bhkType,
  furnished_filter := furnished,
  gender_filter := gender
)
```

#### RPC Execution Inside PostgreSQL:
1. Calculates Haversine distance from target coordinates:
   $$\text{dist\_meters} = 6371000 \times \text{acos}(\cos(\text{lat}_1) \cos(\text{lat}_2) \cos(\text{lng}_2 - \text{lng}_1) + \sin(\text{lat}_1) \sin(\text{lat}_2))$$
2. Joins `listings` table with `users` table to fetch landlord details (`full_name`, `phone_number`, `profile_photo`).
3. Applies SQL `WHERE` clause filters (`price <= max_price`, `LOWER(bhk_type) = LOWER(bhk_type_filter)`, `furnished`, `gender_preference`).
4. Orders output strictly by `dist_meters ASC` (closest rooms first).

---

### Step 5: UI Rendering & Resolved Location Banner (`app/search/page.js`)

1. **Resolved Location Banner Badge**:
   * Displays an emerald location badge confirming exact resolved place name:
     > ✨ *Showing rooms near **Court More, Kachari Road, Siliguri***
2. **Card Rendering**:
   * Displays listing cards in mobile-first feed layout.
   * Highlights distance badge (e.g. `0.4 km away`).
   * Renders `BHK` badge (`1BHK`, `2BHK`, `3BHK`, `1RK`) in emerald theme.
3. **Zero-Result Prevention Fallback**:
   * If proximity RPC returns 0 results for remote queries, app falls back to date-sorted query (`order("created_at", { ascending: false })`) so users never see a blank dead-end screen.

---

## ⚡ Quota & Performance Protection Rules

| Protection Mechanism | Purpose | Benefit |
| :--- | :--- | :--- |
| **Google-Style Hybrid AutoSuggest** | Formats intent + Mappls landmarks live | Premium UX matching Google Maps |
| **Resolved Location Banner** | Displays clean resolved address | Confirms exact resolved location |
| **Dedicated Search Action Button** | Requires user click to execute search | Eliminates ~95% accidental typing API calls |
| **In-Memory Cache (`geoCache`)** | Stores previously geocoded locations | **0 API calls** for repeated queries |
| **Country Filter (`filter=countrycode:in`)** | Restricts geocoding bounds to India | Eliminates international false positive matches |
| **Dynamic Proximity Bias (`bias=proximity:lng,lat`)** | Prioritizes local landmarks based on user GPS | Resolves ambiguous landmarks (e.g. *Court More Siliguri* vs *Court More Chandannagar*) |

---

## 📁 Key File References

* **Search Page UI & Controller**: `app/search/page.js`
* **Geocoding & Disambiguation Layer**: `lib/geoapify.js`
* **Fast Local Pattern Parser**: `lib/searchParser.js`
* **Groq AI System Prompt & Parser**: `app/api/search/parse/route.js`
* **Mappls AutoSuggest Proxy**: `app/api/mappls/autosuggest/route.js`
* **Supabase RPC Migration SQL**: `docs/schema_migration.sql`
