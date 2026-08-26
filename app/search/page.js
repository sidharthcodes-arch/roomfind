"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import ShareModal from "@/components/ShareModal";
import { parseQueryLocally } from "@/lib/searchParser";
import { geocodeLocation } from "@/lib/geoapify";
import { fetchSuggestionsWithCache } from "@/lib/autosuggestCache";
import ListingCard from "@/components/ListingCard";
import {
  Search as SearchIcon,
  X,
  SlidersHorizontal,
  MapPin,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  CheckCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Navigation,
  ArrowLeft,
  ChevronRight,
  Flame,
  Building2,
} from "lucide-react";

const PAGE_SIZE = 10;

const TABS = [
  "Top",
  "Latest",
  "1BHK",
  "2BHK",
  "3BHK",
  "Single",
  "Shared",
  "Furnished",
  "Under ₹10k",
];

const TRENDING_LOCATIONS = [
  "Court More",
  "Darjeeling More",
  "Airview More",
  "Venus More",
  "Pradhan Nagar",
  "Koramangala",
  "Indiranagar",
  "HSR Layout",
];

function SearchCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.09] p-4 mb-3 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-3 bg-slate-200 rounded w-24" />
        </div>
      </div>
      <div className="aspect-[4/3] bg-slate-200 rounded-xl" />
      <div className="h-5 bg-slate-200 rounded w-28" />
      <div className="h-4 bg-slate-200 rounded w-3/4" />
    </div>
  );
}

export default function SearchPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Top");

  const [maxPrice, setMaxPrice] = useState("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [genderFilter, setGenderFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // AutoSuggest Dropdown State
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const selectedSuggestionRef = useRef(null);

  const [listings, setListings] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [shareListing, setShareListing] = useState(null);

  const [resolvedLocationName, setResolvedLocationName] = useState(null);

  // Dynamic real-time database metrics & popular locations
  const [dbStats, setDbStats] = useState({
    totalCount: 0,
    singleCount: 0,
    sharedCount: 0,
    furnishedCount: 0,
    under5kCount: 0,
    popularLocations: [],
  });

  useEffect(() => {
    async function loadRealDbStats() {
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("id, price, room_type, furnished, location_name, city");

        if (!error && data) {
          const single = data.filter(
            (l) => (l.room_type || "").toLowerCase() === "single",
          ).length;
          const shared = data.filter(
            (l) => (l.room_type || "").toLowerCase() === "shared",
          ).length;
          const furnished = data.filter((l) => l.furnished === true).length;
          const under5k = data.filter(
            (l) => l.price && Number(l.price) <= 5000,
          ).length;

          const locationMap = {};
          data.forEach((l) => {
            const rawLoc = l.location_name || l.city || "";
            if (rawLoc.trim()) {
              const cleaned = rawLoc.split(",")[0].trim();
              if (cleaned.length >= 3) {
                locationMap[cleaned] = (locationMap[cleaned] || 0) + 1;
              }
            }
          });

          const sortedLocs = Object.entries(locationMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({ name, count }));

          setDbStats({
            totalCount: data.length,
            singleCount: single,
            sharedCount: shared,
            furnishedCount: furnished,
            under5kCount: under5k,
            popularLocations: sortedLocs,
          });
        }
      } catch (e) {
        console.error("Error loading real db stats:", e);
      }
    }
    loadRealDbStats();
  }, []);

  const pageRef = useRef(0);
  const sentinelRef = useRef(null);

  const searchQueryRef = useRef(searchQuery);
  const userGpsRef = useRef(null);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  // Mount-Time Non-Blocking Geolocation Prefetch & LocalStorage Cache with Coarse IP Fallback
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Instant hydration from localStorage (0 ms delay)
    try {
      const stored = localStorage.getItem("roomfind_user_gps");
      if (stored) {
        const parsed = JSON.parse(stored);
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours TTL
        if (
          parsed &&
          parsed.lat &&
          parsed.lng &&
          Date.now() - (parsed.timestamp || 0) < MAX_AGE
        ) {
          userGpsRef.current = { lat: parsed.lat, lng: parsed.lng };
        }
      }
    } catch (_) {}

    // Helper to fetch coarse IP location if GPS is unavailable/denied
    const fetchIpLocationFallback = async () => {
      if (userGpsRef.current) return;
      const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
      if (!geoapifyKey) return;
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/ipinfo?apiKey=${geoapifyKey}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (
            data &&
            data.location &&
            data.location.latitude &&
            data.location.longitude
          ) {
            const ipData = {
              lat: data.location.latitude,
              lng: data.location.longitude,
              isIpFallback: true,
              timestamp: Date.now(),
            };
            userGpsRef.current = { lat: ipData.lat, lng: ipData.lng };
            try {
              localStorage.setItem("roomfind_user_gps", JSON.stringify(ipData));
            } catch (_) {}
          }
        }
      } catch (_) {}
    };

    // 2. Non-blocking fresh GPS prefetch (decoupled from search execution)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords) {
            const gpsData = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              isIpFallback: false,
              timestamp: Date.now(),
            };
            userGpsRef.current = { lat: gpsData.lat, lng: gpsData.lng };
            try {
              localStorage.setItem(
                "roomfind_user_gps",
                JSON.stringify(gpsData),
              );
            } catch (_) {}
          }
        },
        () => {
          fetchIpLocationFallback();
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 },
      );
    } else {
      fetchIpLocationFallback();
    }
  }, []);

  // 350ms Debounced AutoSuggest Effect using Session Cache with Google-Style Hybrid Suggestions
  useEffect(() => {
    const term = searchQuery.trim();

    // Ignore suggestion search if query contains complex search keywords
    const isFilterQuery =
      /\b(1bhk|2bhk|3bhk|under|below|near me|furnished|single|shared|\d+k)\b/i.test(
        term,
      );

    if (term.length < 3 || isFilterQuery || selectedSuggestionRef.current) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      // Extract intent prefix (e.g. "rooms near" or "1bhk near") and location key (e.g. "courtmore")
      const matchIntent = term.match(/^(.*?\b(near|in|around|at)\b)\s*(.*)$/i);
      const intentPrefix = matchIntent ? matchIntent[1].trim() : "rooms near";
      const locationKey =
        matchIntent && matchIntent[3].trim() ? matchIntent[3].trim() : term;

      const rawResults = await fetchSuggestionsWithCache(
        locationKey,
        userGpsRef.current,
      );
      if (rawResults.length > 0) {
        const hybridList = [];
        rawResults.slice(0, 3).forEach((item) => {
          const name =
            item.placeName ||
            item.locationName ||
            item.placeAddress ||
            (typeof item === "string" ? item : "");
          if (!name) return;

          hybridList.push({
            type: "query",
            displayQuery: `${intentPrefix} ${name}`,
            locationName: name,
            placeName: name,
          });
          hybridList.push({
            type: "location",
            displayQuery: name,
            locationName: name,
            placeName: name,
          });
        });

        setSuggestions(hybridList);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSuggestion = (suggestion) => {
    const locName =
      typeof suggestion === "string"
        ? suggestion
        : suggestion.locationName || suggestion.placeName;
    const dispQuery =
      typeof suggestion === "string"
        ? suggestion
        : suggestion.displayQuery || locName;
    selectedSuggestionRef.current = locName;
    setSearchQuery(dispQuery);
    setShowDropdown(false);
    setSuggestions([]);
    fetchPage(0, true, locName);
  };

  const fetchPage = useCallback(
    async (page, replace = false, customQuery = null) => {
      setHasSearched(true);
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const from = page * PAGE_SIZE;

      let targetLat = null;
      let targetLng = null;
      let aiFilters = {};
      // Zero-delay instant GPS reading from pre-loaded ref or localStorage cache
      let userGps = userGpsRef.current;
      if (!userGps && typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("roomfind_user_gps");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.lat && parsed.lng) {
              userGps = { lat: parsed.lat, lng: parsed.lng };
              userGpsRef.current = userGps;
            }
          }
        } catch (_) {}
      }

      const term = (customQuery ?? searchQueryRef.current ?? "").trim();

      if (term) {
        // Path 1: Direct Suggestion Selected (Bypasses AI completely)
        if (selectedSuggestionRef.current) {
          const coords = await geocodeLocation(
            selectedSuggestionRef.current,
            userGps,
          );
          if (coords) {
            targetLat = coords.lat;
            targetLng = coords.lng;
            setResolvedLocationName(
              coords.formatted || selectedSuggestionRef.current,
            );
          }
          selectedSuggestionRef.current = null;
        } else {
          // Path 2: Check Local Pattern Parser
          const local = parseQueryLocally(term);

          if (local.isSimple) {
            if (local.isNearMe) {
              setResolvedLocationName("Your Current Location");
              if (userGps) {
                targetLat = userGps.lat;
                targetLng = userGps.lng;
              } else {
                try {
                  const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      timeout: 5000,
                    });
                  });
                  targetLat = pos.coords.latitude;
                  targetLng = pos.coords.longitude;
                } catch (err) {
                  targetLat = 12.9716;
                  targetLng = 77.5946;
                }
              }
            } else if (local.location) {
              const coords = await geocodeLocation(local.location, userGps);
              if (coords) {
                targetLat = coords.lat;
                targetLng = coords.lng;
                setResolvedLocationName(coords.formatted || local.location);
              }
            }
          } else {
            // Path 3: Groq AI Natural Language Parsing
            try {
              setIsAiParsing(true);
              const aiRes = await fetch("/api/search/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: term }),
              });

              if (aiRes.ok) {
                aiFilters = await aiRes.json();
                if (aiFilters.is_near_me) {
                  setResolvedLocationName("Your Current Location");
                  if (userGps) {
                    targetLat = userGps.lat;
                    targetLng = userGps.lng;
                  } else {
                    try {
                      const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(
                          resolve,
                          reject,
                          {
                            timeout: 5000,
                          },
                        );
                      });
                      targetLat = pos.coords.latitude;
                      targetLng = pos.coords.longitude;
                    } catch (_) {}
                  }
                } else if (aiFilters.location) {
                  const coords = await geocodeLocation(
                    aiFilters.location,
                    userGps,
                  );
                  if (coords) {
                    targetLat = coords.lat;
                    targetLng = coords.lng;
                    setResolvedLocationName(
                      coords.formatted || aiFilters.location,
                    );
                  }
                }
              }
            } catch (e) {
              console.error("AI parsing error:", e);
            } finally {
              setIsAiParsing(false);
            }
          }
        }
      } else {
        setResolvedLocationName(null);
      }

      const effectiveMaxPrice =
        activeTab === "Under ₹10k"
          ? 10000
          : maxPrice
            ? Number(maxPrice)
            : aiFilters.max_price || null;

      const effectiveBhkType =
        activeTab === "1BHK"
          ? "1BHK"
          : activeTab === "2BHK"
            ? "2BHK"
            : activeTab === "3BHK"
              ? "3BHK"
              : aiFilters.bhk_type || null;

      const effectiveRoomType =
        activeTab === "Single"
          ? "single"
          : activeTab === "Shared"
            ? "shared"
            : aiFilters.room_type || null;

      const effectiveFurnished =
        activeTab === "Furnished" || furnishedOnly
          ? true
          : (aiFilters.furnished ?? null);

      const effectiveGender =
        genderFilter !== "all"
          ? genderFilter
          : aiFilters.gender_preference || "all";

      let fetchedListings = [];
      try {
        if (targetLat && targetLng) {
          const { data, error } = await supabase.rpc("get_nearby_listings", {
            search_lat: targetLat,
            search_lng: targetLng,
            page_offset: from,
            page_size: PAGE_SIZE,
            max_price_filter: effectiveMaxPrice,
            room_type_filter: effectiveRoomType,
            bhk_type_filter: effectiveBhkType,
            furnished_filter: effectiveFurnished,
            gender_filter: effectiveGender,
          });
          if (!error && data && data.length > 0) {
            fetchedListings = data;
          } else {
            // Fallback retry: Call proximity RPC without restrictive filters so location matches always take precedence
            const { data: relaxedData } = await supabase.rpc(
              "get_nearby_listings",
              {
                search_lat: targetLat,
                search_lng: targetLng,
                page_offset: from,
                page_size: PAGE_SIZE,
                max_price_filter: null,
                room_type_filter: null,
                bhk_type_filter: null,
                furnished_filter: null,
                gender_filter: "all",
              },
            );
            if (relaxedData && relaxedData.length > 0) {
              fetchedListings = relaxedData;
            }
          }
        }

        if (fetchedListings.length === 0) {
          let q = supabase
            .from("listings")
            .select("*, users(full_name, phone_number, profile_photo)")
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (effectiveBhkType) q = q.ilike("bhk_type", effectiveBhkType);
          if (effectiveRoomType) q = q.eq("room_type", effectiveRoomType);
          if (effectiveFurnished) q = q.eq("furnished", true);
          if (effectiveMaxPrice) q = q.lte("price", effectiveMaxPrice);
          if (effectiveGender !== "all")
            q = q.eq("gender_preference", effectiveGender);

          const { data, error } = await q;
          if (!error && data) {
            fetchedListings = data;
          }
        }
      } catch (err) {
        console.error("Fetch page error:", err);
      }

      if (fetchedListings.length > 0) {
        const ids = fetchedListings.map((l) => l.id);
        let likesData = [],
          userLikes = [],
          commentsData = [];
        try {
          const [likesRes, userLikesRes, commentsRes] = await Promise.all([
            supabase
              .from("listing_likes")
              .select("listing_id")
              .in("listing_id", ids),
            user?.id
              ? supabase
                  .from("listing_likes")
                  .select("listing_id")
                  .in("listing_id", ids)
                  .eq("user_id", user.id)
              : Promise.resolve({ data: [] }),
            supabase
              .from("listing_comments")
              .select("listing_id")
              .in("listing_id", ids),
          ]);
          likesData = likesRes.data ?? [];
          userLikes = userLikesRes.data ?? [];
          commentsData = commentsRes.data ?? [];
        } catch (_) {}

        const likeCountMap = {};
        const userLikeSet = new Set(userLikes.map((l) => l.listing_id));
        const commentCountMap = {};
        likesData.forEach((l) => {
          likeCountMap[l.listing_id] = (likeCountMap[l.listing_id] ?? 0) + 1;
        });
        commentsData.forEach((l) => {
          commentCountMap[l.listing_id] =
            (commentCountMap[l.listing_id] ?? 0) + 1;
        });

        fetchedListings = fetchedListings.map((l) => ({
          ...l,
          _liked: userLikeSet.has(l.id),
          _likeCount: likeCountMap[l.id] ?? 0,
          _commentCount: commentCountMap[l.id] ?? 0,
        }));
      }

      if (replace) {
        setListings(fetchedListings);
      } else {
        setListings((prev) => [...prev, ...fetchedListings]);
      }

      setHasMore(fetchedListings.length === PAGE_SIZE);
      setLoading(false);
      setLoadingMore(false);
    },
    [activeTab, maxPrice, furnishedOnly, genderFilter, user?.id],
  );

  useEffect(() => {
    if (authLoading) return;
    if (
      hasSearched ||
      searchQuery.trim() ||
      activeTab !== "Top" ||
      activeFilterCount > 0
    ) {
      pageRef.current = 0;
      setLoading(true);
      fetchPage(0, true);
    } else {
      setLoading(false);
    }
  }, [activeTab, maxPrice, furnishedOnly, genderFilter, user?.id, authLoading]);

  const handleResetFilters = () => {
    setMaxPrice("");
    setFurnishedOnly(false);
    setGenderFilter("all");
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setShowDropdown(false);
    selectedSuggestionRef.current = null;
    setResolvedLocationName(null);
    if (activeTab === "Top" && activeFilterCount === 0) {
      setHasSearched(false);
      setListings([]);
    }
  };

  const handleTrendingClick = (locationName) => {
    selectedSuggestionRef.current = locationName;
    searchQueryRef.current = locationName;
    setSearchQuery(locationName);
    fetchPage(0, true, locationName);
  };

  const handleCategoryFilterClick = (tabName) => {
    selectedSuggestionRef.current = null;
    searchQueryRef.current = "";
    setSearchQuery("");
    setResolvedLocationName(null);
    setHasSearched(true);
    setActiveTab(tabName);
  };

  const handlePriceFilterClick = (priceLimit) => {
    selectedSuggestionRef.current = null;
    searchQueryRef.current = "";
    setSearchQuery("");
    setResolvedLocationName(null);
    setHasSearched(true);
    setMaxPrice(priceLimit.toString());
  };

  const activeFilterCount =
    (maxPrice ? 1 : 0) +
    (furnishedOnly ? 1 : 0) +
    (genderFilter !== "all" ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">
      <div className="sticky top-0 z-30 bg-white border-b border-black/[0.09] pt-3 pb-0 space-y-2">
        <div className="px-4 flex items-center gap-2">
          {/* Back button to Home */}
          <Link
            href="/"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 transition-all border border-black/[0.04] shrink-0"
            title="Back to feed"
            aria-label="Back to feed"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-slate-700" />
          </Link>

          {/* Search Input Bar with form submit & embedded search action button */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setShowDropdown(false);
              fetchPage(0, true);
            }}
            className="relative flex-1 flex items-center"
          >
            {isAiParsing ? (
              <Sparkles className="w-4 h-4 text-brand absolute left-3 top-1/2 -translate-y-1/2 animate-spin pointer-events-none z-10" />
            ) : (
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            )}
            <input
              type="text"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                selectedSuggestionRef.current = null;
                setSearchQuery(val);
                if (
                  !val.trim() &&
                  activeTab === "Top" &&
                  activeFilterCount === 0
                ) {
                  setHasSearched(false);
                  setListings([]);
                }
              }}
              placeholder={
                isAiParsing
                  ? "AI Understanding query..."
                  : "Type e.g. '1bhk in HSR under 15k'"
              }
              className="w-full pl-8 pr-16 py-2 bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-slate-900 text-[13.5px] font-medium placeholder:text-slate-400 rounded-xl border border-transparent focus:border-brand outline-none transition-all shadow-inner [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
              {(searchQuery || resolvedLocationName) && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={isAiParsing}
                className="w-7 h-7 rounded-lg bg-brand text-white flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs shrink-0 disabled:opacity-50"
                title="Execute search"
              >
                {isAiParsing ? (
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <SearchIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Google-Style AutoSuggest Location Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black/[0.1] rounded-2xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-black/[0.04]">
                {suggestions.map((item, idx) => {
                  const isQueryItem = item.type === "query";
                  const placeName =
                    item.placeName ||
                    item.locationName ||
                    item.placeAddress ||
                    (typeof item === "string" ? item : "");
                  const displayQuery = item.displayQuery || placeName;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full px-4 py-3 text-left text-[13px] text-slate-800 hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                    >
                      {isQueryItem ? (
                        <SearchIcon className="w-4 h-4 text-slate-400 group-hover:text-brand shrink-0 transition-colors" />
                      ) : (
                        <MapPin className="w-4 h-4 text-brand shrink-0" />
                      )}
                      <div className="flex-1 truncate">
                        {isQueryItem ? (
                          <span className="text-slate-900 font-medium">
                            {displayQuery}
                          </span>
                        ) : (
                          <span>
                            <strong className="font-semibold text-slate-900">
                              {placeName.split(",")[0]}
                            </strong>
                            <span className="text-slate-500 font-normal">
                              {placeName.includes(",")
                                ? placeName.substring(placeName.indexOf(","))
                                : ""}
                            </span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </form>

          {/* Filter Matrix Button (Squircle) */}
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={`relative w-9 h-9 rounded-xl border transition-all active:scale-95 flex items-center justify-center shrink-0 ${
              showFilters || activeFilterCount > 0
                ? "bg-brand text-white border-brand shadow-xs"
                : "bg-slate-100 border-black/[0.04] text-slate-700 hover:bg-slate-200"
            }`}
            title="Filter matrix"
            aria-label="Filter matrix"
          >
            <SlidersHorizontal className="w-4.5 h-4.5 text-current" />
            {activeFilterCount > 0 && !showFilters && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-coral text-white font-bold text-[10px] rounded-full flex items-center justify-center border border-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Resolved Location Banner */}
        {resolvedLocationName && (
          <div className="mx-4 mt-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200/70 rounded-2xl flex items-center justify-between text-[12.5px] text-emerald-900 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2 truncate pr-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">
                Showing rooms near{" "}
                <strong className="font-semibold text-emerald-950">
                  {resolvedLocationName}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-emerald-700 hover:text-emerald-950 p-0.5 shrink-0 transition-colors"
              title="Dismiss location banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Category Chips matching Home Feed Design System ── */}
        <div className="border-t border-black/[0.06] relative bg-white/95 backdrop-blur-md">
          <div className="px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide relative z-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all active:scale-95 ${
                  activeTab === tab
                    ? "bg-brand text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Scroll edge fade affordance */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
        </div>

        {showFilters && (
          <div className="mx-4 mb-3 bg-slate-50 rounded-2xl p-4 border border-black/[0.08] space-y-3 animate-fade-in text-[13px]">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
              <span className="font-bold text-slate-900">Custom Filters</span>
              <button
                onClick={handleResetFilters}
                className="text-brand text-xs font-semibold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Max Rent (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 15000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-black/[0.09] rounded-xl text-[13px] focus:outline-none focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Gender
                </label>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-black/[0.09] rounded-xl text-[12px] focus:outline-none focus:border-brand"
                >
                  <option value="all">Any Gender</option>
                  <option value="male">Male Only</option>
                  <option value="female">Female Preferred</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Furnishing
                </label>
                <button
                  onClick={() => setFurnishedOnly((prev) => !prev)}
                  className={`w-full py-2 px-3 rounded-xl border text-[12px] font-medium transition-colors ${
                    furnishedOnly
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-slate-700 border-black/[0.09]"
                  }`}
                >
                  {furnishedOnly ? "Furnished Only" : "Any Furnishing"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Trending Locations Chips from Database */}
      <div className="px-4 py-3 border-b border-black/[0.05] bg-white/50">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-brand" />
          <span>Trending Areas</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(dbStats.popularLocations.length > 0
            ? dbStats.popularLocations.map((loc) => loc.name)
            : TRENDING_LOCATIONS
          ).map((loc) => (
            <button
              key={loc}
              onClick={() => handleTrendingClick(loc)}
              className="px-3 py-1.5 bg-white border border-black/[0.08] rounded-xl text-[12.5px] font-medium text-slate-700 hover:border-brand hover:text-brand transition-all active:scale-95 shadow-2xs"
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4">
        {!hasSearched &&
        !searchQuery.trim() &&
        activeTab === "Top" &&
        activeFilterCount === 0 ? (
          <div className="space-y-5 -mx-4">
            {/* ── 1. Dynamic Horizontal Spotlight Cards Carousel (Real DB Counts) ── */}
            <div className="px-4">
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
                {/* Card 1: Top Dynamic Location */}
                <button
                  onClick={() =>
                    handleTrendingClick(
                      dbStats.popularLocations[0]?.name || "Court More",
                    )
                  }
                  className="shrink-0 w-64 bg-slate-900 text-white rounded-2xl p-3.5 relative overflow-hidden text-left hover:bg-slate-800 transition-all active:scale-[0.98] border border-slate-800 shadow-md group"
                >
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-brand" />
                  <div className="pl-1.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Top Location</span>
                      <span className="text-brand font-semibold">
                        Active Feed
                      </span>
                    </div>
                    <h4 className="font-bold text-[15px] text-white group-hover:text-brand transition-colors truncate">
                      {dbStats.popularLocations[0]?.name
                        ? `${dbStats.popularLocations[0].name} & Nearby`
                        : "Court More & Airview"}
                    </h4>
                    <p className="text-[12px] text-slate-400">
                      {dbStats.popularLocations[0]?.count
                        ? `${dbStats.popularLocations[0].count} rooms currently listed`
                        : `${dbStats.totalCount || 0} total active rooms`}
                    </p>
                  </div>
                </button>

                {/* Card 2: Furnished Rooms */}
                <button
                  onClick={() => handleCategoryFilterClick("Furnished")}
                  className="shrink-0 w-64 bg-slate-900 text-white rounded-2xl p-3.5 relative overflow-hidden text-left hover:bg-slate-800 transition-all active:scale-[0.98] border border-slate-800 shadow-md group"
                >
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-500" />
                  <div className="pl-1.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Furnished Rooms</span>
                      <span className="text-rose-400 font-semibold">
                        Verified
                      </span>
                    </div>
                    <h4 className="font-bold text-[15px] text-white group-hover:text-rose-400 transition-colors">
                      Fully Furnished Stays
                    </h4>
                    <p className="text-[12px] text-slate-400">
                      {dbStats.furnishedCount} verified listings in DB
                    </p>
                  </div>
                </button>

                {/* Card 3: Student Deals */}
                <button
                  onClick={() => handlePriceFilterClick(5000)}
                  className="shrink-0 w-64 bg-slate-900 text-white rounded-2xl p-3.5 relative overflow-hidden text-left hover:bg-slate-800 transition-all active:scale-[0.98] border border-slate-800 shadow-md group"
                >
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-blue-500" />
                  <div className="pl-1.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Budget Deals</span>
                      <span className="text-blue-400 font-semibold">
                        Low Price
                      </span>
                    </div>
                    <h4 className="font-bold text-[15px] text-white group-hover:text-blue-400 transition-colors">
                      Rooms Under ₹5,000/mo
                    </h4>
                    <p className="text-[12px] text-slate-400">
                      {dbStats.under5kCount} budget listings in DB
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── 2. Twitter-Style Section: Dynamic Database Feed ── */}
            <div className="bg-white border-y border-black/[0.08] divide-y divide-black/[0.05]">
              <div className="px-4 py-3 bg-slate-50/70">
                <h3 className="font-extrabold text-slate-900 text-[16px]">
                  Find what you're looking for
                </h3>
              </div>

              {/* Item 1 & 2: Top Locations from DB */}
              {dbStats.popularLocations.slice(0, 2).map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTrendingClick(loc.name)}
                  className="w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                >
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <span className="text-[11px] font-medium text-slate-400 block">
                      Popular Location #{idx + 1} · Live Database
                    </span>
                    <h4 className="font-bold text-slate-900 text-[14.5px] truncate group-hover:text-brand transition-colors">
                      Available rooms near {loc.name}
                    </h4>
                    <p className="text-[12px] text-slate-500">
                      {loc.count} active listing{loc.count > 1 ? "s" : ""} in
                      database
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
                </button>
              ))}

              {/* Item 3: Single Rooms */}
              <button
                onClick={() => handleCategoryFilterClick("Single")}
                className="w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
              >
                <div className="space-y-0.5 min-w-0 pr-3">
                  <span className="text-[11px] font-medium text-slate-400 block">
                    Occupancy · Single
                  </span>
                  <h4 className="font-bold text-slate-900 text-[14.5px] truncate group-hover:text-brand transition-colors">
                    Private Single Occupancy Rooms
                  </h4>
                  <p className="text-[12px] text-slate-500">
                    {dbStats.singleCount} active single room listing
                    {dbStats.singleCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
              </button>

              {/* Item 4: Shared Rooms */}
              <button
                onClick={() => handleCategoryFilterClick("Shared")}
                className="w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
              >
                <div className="space-y-0.5 min-w-0 pr-3">
                  <span className="text-[11px] font-medium text-slate-400 block">
                    Occupancy · Shared
                  </span>
                  <h4 className="font-bold text-slate-900 text-[14.5px] truncate group-hover:text-brand transition-colors">
                    Budget Shared Rooms & PGs
                  </h4>
                  <p className="text-[12px] text-slate-500">
                    {dbStats.sharedCount} active shared room listing
                    {dbStats.sharedCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
              </button>

              {/* Item 5: Budget Deals */}
              <button
                onClick={() => handlePriceFilterClick(5000)}
                className="w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
              >
                <div className="space-y-0.5 min-w-0 pr-3">
                  <span className="text-[11px] font-medium text-slate-400 block">
                    Budget Filter · Under ₹5,000
                  </span>
                  <h4 className="font-bold text-slate-900 text-[14.5px] truncate group-hover:text-brand transition-colors">
                    Affordable Stays under ₹5,000/month
                  </h4>
                  <p className="text-[12px] text-slate-500">
                    {dbStats.under5kCount} active budget listing
                    {dbStats.under5kCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
              </button>
            </div>
          </div>
        ) : loading ? (
          <>
            <SearchCardSkeleton />
            <SearchCardSkeleton />
            <SearchCardSkeleton />
          </>
        ) : listings.length > 0 ? (
          <div>
            {listings.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                currentUserId={user?.id}
                onLikeToggle={(id, liked) => {
                  setListings((prev) =>
                    prev.map((l) =>
                      l.id === id
                        ? {
                            ...l,
                            _liked: liked,
                            _likeCount: (l._likeCount ?? 0) + (liked ? 1 : -1),
                          }
                        : l,
                    ),
                  );
                }}
                onShare={(l) => setShareListing(l)}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center space-y-3 bg-white rounded-2xl border border-black/[0.09] p-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <SearchIcon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-[15px]">
              No listings found
            </h3>
            <p className="text-[13px] text-slate-500 max-w-xs mx-auto">
              Try adjusting your search filters or searching for another
              location.
            </p>
          </div>
        )}
      </main>

      {shareListing && (
        <ShareModal
          isOpen={!!shareListing}
          onClose={() => setShareListing(null)}
          title={shareListing.title}
          url={typeof window !== "undefined" ? window.location.href : ""}
        />
      )}
    </div>
  );
}
