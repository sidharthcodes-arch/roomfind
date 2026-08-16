"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import ShareModal from "@/components/ShareModal";
import TwitterImageGrid from "@/components/TwitterImageGrid";
import ImageLightboxModal from "@/components/ImageLightboxModal";
import { parseQueryLocally } from "@/lib/searchParser";
import { geocodeLocation } from "@/lib/geoapify";
import { fetchSuggestionsWithCache } from "@/lib/autosuggestCache";
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
} from "lucide-react";

const PAGE_SIZE = 10;

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

function SearchResultCard({ listing, currentUserId, onLikeToggle, onShare }) {
  const router = useRouter();
  const [liked, setLiked] = useState(listing._liked ?? false);
  const [likeCount, setLikeCount] = useState(listing._likeCount ?? 0);
  const [saved, setSaved] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isTaken =
    listing.status === "taken" ||
    listing.status === "booked" ||
    listing.is_available === false;
  const photos = listing.photos ?? [];
  const ownerName = listing.users?.full_name ?? "Owner";
  const ownerInitials = initials(ownerName);

  useEffect(() => {
    setLiked(listing._liked ?? false);
    setLikeCount(listing._likeCount ?? 0);
  }, [listing._liked, listing._likeCount]);

  const handleLike = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    onLikeToggle?.(listing.id, next);
    if (next) {
      await supabase
        .from("listing_likes")
        .insert({ user_id: currentUserId, listing_id: listing.id });
    } else {
      await supabase
        .from("listing_likes")
        .delete()
        .eq("user_id", currentUserId)
        .eq("listing_id", listing.id);
    }
  };

  const handleSave = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSaved((s) => !s);
  };

  const handleImageClick = (index) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const whatsappPhone = listing.users?.phone_number
    ? listing.users.phone_number.replace(/\D/g, "")
    : "";
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
        `Hi, I'm interested in your room listing "${listing.title}" on RoomFind.`,
      )}`
    : null;

  return (
    <article
      onClick={() => router.push(`/listings/${listing.id}`)}
      className="bg-white rounded-2xl border border-black/[0.09] p-4 mb-3 transition-shadow hover:shadow-md cursor-pointer relative"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {listing.users?.profile_photo ? (
            <img
              src={listing.users.profile_photo}
              alt={ownerName}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-black/[0.08]"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-brand text-white font-bold text-[12px] flex items-center justify-center shrink-0">
              {ownerInitials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-900 text-[13.5px] truncate">
                {ownerName}
              </span>
              <CheckCircle className="w-3.5 h-3.5 text-brand shrink-0 fill-brand/10" />
            </div>
            <span className="text-[11px] text-slate-400 block">
              {timeAgo(listing.created_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              isTaken
                ? "bg-slate-100 text-slate-500 border-slate-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {isTaken ? "Taken" : "Available"}
          </span>

          <button
            onClick={handleSave}
            className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${
              saved ? "text-brand" : "text-slate-400"
            }`}
          >
            <Bookmark
              className="w-4 h-4"
              fill={saved ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="mb-3 rounded-xl overflow-hidden">
          <TwitterImageGrid photos={photos} onImageClick={handleImageClick} />
        </div>
      ) : (
        <div className="w-full h-48 bg-slate-100 rounded-xl mb-3 flex items-center justify-center text-slate-400 text-[13px]">
          No photos available
        </div>
      )}

      {isLightboxOpen && (
        <ImageLightboxModal
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}

      <div className="space-y-1 mb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-slate-900 text-[16px] truncate">
            {listing.title}
          </h3>
          <div className="text-right shrink-0">
            <span className="text-[17px] font-extrabold text-brand">
              ₹{Number(listing.price).toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">/mo</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[12px] text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{listing.address}</span>
        </div>

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {listing.bhk_type && (
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-bold">
              {listing.bhk_type}
            </span>
          )}
          {listing.room_type && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium capitalize">
              {listing.room_type} Occupancy
            </span>
          )}
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium">
            {listing.furnished ? "Furnished" : "Unfurnished"}
          </span>
          {listing.gender_preference && listing.gender_preference !== "all" && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium capitalize">
              {listing.gender_preference} Preferred
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 mt-2">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 text-slate-500 hover:text-rose-500 transition-colors text-[12.5px] font-medium"
          >
            <Heart
              className={`w-4 h-4 ${
                liked ? "fill-rose-500 text-rose-500" : ""
              }`}
            />
            <span>{likeCount}</span>
          </button>

          <Link
            href={`/listings/${listing.id}#comments`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-[12.5px] font-medium"
          >
            <MessageCircle className="w-4 h-4 text-slate-400" />
            <span>{listing._commentCount ?? 0}</span>
          </Link>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShare?.(listing);
            }}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-[12.5px] font-medium"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white font-semibold text-[12px] hover:bg-emerald-600 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-white" />
            <span>WhatsApp</span>
          </a>
        ) : (
          <span className="text-[11px] text-slate-400 italic">No contact</span>
        )}
      </div>
    </article>
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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [shareListing, setShareListing] = useState(null);

  const [resolvedLocationName, setResolvedLocationName] = useState(null);

  const pageRef = useRef(0);
  const sentinelRef = useRef(null);

  const searchQueryRef = useRef(searchQuery);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

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

      const rawResults = await fetchSuggestionsWithCache(locationKey);
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
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const from = page * PAGE_SIZE;

      let targetLat = null;
      let targetLng = null;
      let aiFilters = {};
      let userGps = null;

      // Try quick device GPS check to power Proximity Bias
      if (typeof window !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              () => resolve(null),
              { timeout: 2000 },
            );
          });
          if (pos && pos.coords) {
            userGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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
        let likesData = [], userLikes = [], commentsData = [];
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
    pageRef.current = 0;
    setLoading(true);
    fetchPage(0, true);
  }, [activeTab, maxPrice, furnishedOnly, genderFilter, user?.id, authLoading]);

  const handleResetFilters = () => {
    setMaxPrice("");
    setFurnishedOnly(false);
    setGenderFilter("all");
  };

  const handleTrendingClick = (locationName) => {
    selectedSuggestionRef.current = locationName;
    setSearchQuery(locationName);
    fetchPage(0, true);
  };

  const activeFilterCount =
    (maxPrice ? 1 : 0) +
    (furnishedOnly ? 1 : 0) +
    (genderFilter !== "all" ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">
      <div className="sticky top-0 z-30 bg-white border-b border-black/[0.09] pt-3 pb-0 space-y-2">
        <div className="px-4 flex items-center gap-2">
          <div className="relative flex-1">
            {isAiParsing ? (
              <Sparkles className="w-4 h-4 text-brand absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin" />
            ) : (
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                selectedSuggestionRef.current = null;
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowDropdown(false);
                  fetchPage(0, true);
                }
              }}
              placeholder={
                isAiParsing
                  ? "AI Understanding query..."
                  : "Type naturally e.g. '1bhk in HSR under 15k'"
              }
              className="w-full pl-10 pr-9 py-2.5 bg-slate-100 border border-transparent rounded-full text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowDropdown(false);
                  selectedSuggestionRef.current = null;
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}

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
          </div>

          {/* Dedicated Search Action Button */}
          <button
            onClick={() => {
              setShowDropdown(false);
              fetchPage(0, true);
            }}
            disabled={isAiParsing}
            className="px-3.5 py-2.5 bg-brand text-white text-[13px] font-semibold rounded-full hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-sm disabled:opacity-50"
          >
            {isAiParsing ? (
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SearchIcon className="w-3.5 h-3.5" />
            )}
            <span className="text-[13px]">Search</span>
          </button>

          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={`relative p-2.5 rounded-full border transition-colors flex items-center justify-center shrink-0 ${
              showFilters || activeFilterCount > 0
                ? "bg-brand text-white border-brand"
                : "bg-white border-black/[0.09] text-slate-600 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
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
              onClick={() => setResolvedLocationName(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex border-t border-black/[0.06] overflow-x-auto scrollbar-hide px-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[75px] py-3 text-[13.5px] font-semibold text-center relative transition-colors shrink-0 ${
                activeTab === tab
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{tab}</span>
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand rounded-full" />
              )}
            </button>
          ))}
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

      {/* Trending Locations Chips */}
      <div className="px-4 py-3 border-b border-black/[0.05] bg-white/50">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-brand" />
          <span>Trending Areas</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TRENDING_LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => handleTrendingClick(loc)}
              className="px-2.5 py-1 bg-white border border-black/[0.08] rounded-full text-[12px] font-medium text-slate-700 hover:border-brand hover:text-brand transition-colors shadow-2xs"
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4">
        {loading ? (
          <>
            <SearchCardSkeleton />
            <SearchCardSkeleton />
            <SearchCardSkeleton />
          </>
        ) : listings.length > 0 ? (
          <div>
            {listings.map((item) => (
              <SearchResultCard
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
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto">
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
