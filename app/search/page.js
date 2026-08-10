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
import { geocodeLocation } from "@/lib/mappls";
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

const TABS = ["Top", "Latest", "Single", "Shared", "Furnished", "Under ₹10k"];
const TRENDING_LOCATIONS = [
  "Koramangala",
  "Indiranagar",
  "HSR Layout",
  "Whitefield",
  "BTM Layout",
  "Jayanagar",
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
        .insert({ listing_id: listing.id, user_id: currentUserId });
    } else {
      await supabase
        .from("listing_likes")
        .delete()
        .eq("listing_id", listing.id)
        .eq("user_id", currentUserId);
    }
  };

  const handleShare = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onShare?.(listing);
  };

  const whatsappHref = listing.users?.phone_number
    ? `https://wa.me/${listing.users.phone_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I saw your listing "${listing.title}" on RoomFind. Is it still available?`)}`
    : null;

  return (
    <article
      onClick={() => router.push(`/listings/${listing.id}`)}
      className="bg-white rounded-2xl border border-black/[0.09] mb-3 overflow-hidden shadow-xs cursor-pointer active:scale-[0.995] transition-transform"
    >
      {/* Header Info */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0 overflow-hidden border border-black/5">
          {listing.users?.profile_photo ? (
            <img
              src={listing.users.profile_photo}
              alt=""
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span className="text-brand font-bold text-sm">
              {ownerInitials}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[14px] text-slate-900 truncate">
              {ownerName}
            </span>
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-brand bg-brand-light px-1.5 py-0.5 rounded-full shrink-0">
              <CheckCircle className="w-3 h-3" />
              Owner
            </span>
          </div>
          <span className="text-[12px] text-slate-400">
            {timeAgo(listing.created_at)}
          </span>
        </div>

        {/* Distance Badge if available */}
        {typeof listing.distance_km === "number" && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full shrink-0">
            <Navigation className="w-3 h-3 fill-emerald-600 text-emerald-600" />
            {listing.distance_km < 1
              ? `${Math.round(listing.distance_km * 1000)}m away`
              : `${listing.distance_km.toFixed(1)}km away`}
          </span>
        )}
      </div>

      {/* Media Display */}
      <div className="relative px-3" onClick={(e) => e.stopPropagation()}>
        <TwitterImageGrid
          photos={photos}
          onImageClick={(idx) => {
            setLightboxIndex(idx);
            setIsLightboxOpen(true);
          }}
        />
        <div className="absolute top-2.5 left-5 z-[1] flex gap-1.5 pointer-events-none">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${
              isTaken ? "bg-slate-700 text-white" : "bg-brand text-white"
            }`}
          >
            {isTaken ? "Taken" : "Available"}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm capitalize">
            {listing.room_type}
          </span>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <ImageLightboxModal
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}

      {/* Listing Details */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-[22px] font-bold text-slate-900">
            ₹{Number(listing.price).toLocaleString("en-IN")}
          </span>
          <span className="text-[13px] text-slate-400">/month</span>
        </div>
        <p className="text-[14px] text-slate-700 font-medium line-clamp-1 mb-1">
          {listing.title}
        </p>
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[12px] text-slate-500 truncate">
            {listing.area}, {listing.city}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {listing.furnished && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              Furnished
            </span>
          )}
          {listing.gender_preference && listing.gender_preference !== "any" && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium capitalize">
              {listing.gender_preference === "male"
                ? "Male only"
                : "Female preferred"}
            </span>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            No Brokerage
          </span>
        </div>
      </div>

      {/* Card Actions */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center px-3 py-1 border-t border-black/[0.05]"
      >
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors hover:bg-slate-50"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${liked ? "fill-coral text-coral" : "text-slate-400"}`}
          />
          <span
            className={`text-[13px] font-medium ${liked ? "text-coral" : "text-slate-500"}`}
          >
            {likeCount}
          </span>
        </button>
        <Link
          href={`/listings/${listing.id}#comments`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-slate-400" />
          <span className="text-[13px] font-medium text-slate-500">
            {listing._commentCount ?? 0}
          </span>
        </Link>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Share2 className="w-5 h-5 text-slate-400" />
          <span className="text-[13px] font-medium text-slate-500">Share</span>
        </button>
        <button
          onClick={() => setSaved((s) => !s)}
          className="ml-auto flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Bookmark
            className={`w-5 h-5 ${saved ? "fill-brand text-brand" : "text-slate-400"}`}
          />
        </button>
      </div>

      {/* Contact Owner WhatsApp CTA */}
      <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
        {isTaken ? (
          <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-medium text-[13px] select-none">
            Room no longer available
          </div>
        ) : whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand text-white font-semibold text-[13px] active:opacity-90 transition-opacity"
          >
            <svg
              className="w-4 h-4 fill-white"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contact on WhatsApp
          </a>
        ) : (
          <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-100 text-slate-500 font-semibold text-[13px] border border-black/[0.05] select-none">
            Available (No Contact Phone Listed)
          </div>
        )}
      </div>
    </article>
  );
}

export default function SearchPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Top");

  const [maxPrice, setMaxPrice] = useState("");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [genderFilter, setGenderFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [shareListing, setShareListing] = useState(null);

  const pageRef = useRef(0);
  const sentinelRef = useRef(null);

  const fetchPage = useCallback(
    async (page, replace = false) => {
      const from = page * PAGE_SIZE;

      let targetLat = null;
      let targetLng = null;
      let aiFilters = {};

      const term = searchQuery.trim();

      if (term) {
        const local = parseQueryLocally(term);

        if (local.isSimple) {
          if (local.isNearMe) {
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
          } else if (local.location) {
            const coords = await geocodeLocation(local.location);
            if (coords) {
              targetLat = coords.lat;
              targetLng = coords.lng;
            }
          }
        } else {
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
                try {
                  const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                      timeout: 5000,
                    });
                  });
                  targetLat = pos.coords.latitude;
                  targetLng = pos.coords.longitude;
                } catch (_) {
                  // Geolocation error
                }
              } else if (aiFilters.location) {
                const coords = await geocodeLocation(aiFilters.location);
                if (coords) {
                  targetLat = coords.lat;
                  targetLng = coords.lng;
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

      const effectiveMaxPrice =
        activeTab === "Under ₹10k"
          ? 10000
          : maxPrice
            ? Number(maxPrice)
            : aiFilters.max_price || null;

      const effectiveRoomType =
        activeTab === "Single"
          ? "single"
          : activeTab === "Shared"
            ? "shared"
            : aiFilters.room_type || null;

      const effectiveFurnished =
        activeTab === "Furnished" || furnishedOnly
          ? true
          : aiFilters.furnished ?? null;

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
            furnished_filter: effectiveFurnished,
            gender_filter: effectiveGender,
          });
          if (!error && data) {
            fetchedListings = data;
          }
        }

        if (fetchedListings.length === 0) {
          let q = supabase
            .from("listings")
            .select("*, users(full_name, phone_number, profile_photo)")
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (effectiveRoomType) q = q.eq("room_type", effectiveRoomType);
          if (effectiveFurnished) q = q.eq("furnished", true);
          if (effectiveMaxPrice) q = q.lte("price", effectiveMaxPrice);
          if (effectiveGender !== "all")
            q = q.eq("gender_preference", effectiveGender);

          const { data: fallbackData } = await q;
          fetchedListings = fallbackData ?? [];
        }
      } catch (err) {
        console.error("RPC search query error:", err);
      }

      const ids = fetchedListings.map((l) => l.id);
      let likesData = [],
        userLikes = [],
        commentsData = [];
      if (ids.length > 0) {
        try {
          const [likesRes, userLikesRes, commentsRes] = await Promise.all([
            supabase
              .from("listing_likes")
              .select("listing_id")
              .in("listing_id", ids),
            user
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
      }

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

      const enriched = fetchedListings.map((l) => ({
        ...l,
        _liked: userLikeSet.has(l.id),
        _likeCount: likeCountMap[l.id] ?? 0,
        _commentCount: commentCountMap[l.id] ?? 0,
      }));

      setHasMore(fetchedListings.length === PAGE_SIZE);
      setListings((prev) => (replace ? enriched : [...prev, ...enriched]));
    },
    [searchQuery, activeTab, maxPrice, furnishedOnly, genderFilter, user],
  );

  useEffect(() => {
    pageRef.current = 0;
    setListings([]);
    setHasMore(true);
    setLoading(true);

    const timer = setTimeout(() => {
      fetchPage(0, true).finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [
    searchQuery,
    activeTab,
    maxPrice,
    furnishedOnly,
    genderFilter,
    fetchPage,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true);
          pageRef.current += 1;
          await fetchPage(pageRef.current);
          setLoadingMore(false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchPage]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setActiveTab("Top");
    setMaxPrice("");
    setFurnishedOnly(false);
    setGenderFilter("all");
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAiParsing
                  ? "AI Understanding query..."
                  : "Type naturally e.g. '1bhk in HSR under 15k'"
              }
              className="w-full pl-10 pr-9 py-2.5 bg-slate-100 border border-transparent rounded-full text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
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

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border border-black/[0.09] rounded-xl w-full">
                  <input
                    type="checkbox"
                    checked={furnishedOnly}
                    onChange={(e) => setFurnishedOnly(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand"
                  />
                  <span className="text-[12px] font-medium text-slate-700">
                    Furnished
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 bg-white border-b border-black/[0.06] flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-brand" /> Trending:
        </span>
        {TRENDING_LOCATIONS.map((loc) => (
          <button
            key={loc}
            onClick={() => setSearchQuery(loc)}
            className="shrink-0 text-[12px] px-3 py-1 rounded-full bg-slate-100 hover:bg-brand-light hover:text-brand text-slate-600 transition-colors font-medium"
          >
            {loc}
          </button>
        ))}
      </div>

      <div className="px-3 pt-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <SearchCardSkeleton key={i} />
          ))
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/[0.09] p-8 text-center my-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <SearchIcon className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-slate-900 text-[16px]">
              No rooms found
            </h2>
            <p className="text-slate-500 text-[13px] max-w-xs mx-auto">
              We couldn't find any rooms matching your search parameters. Try
              adjusting your search query or filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-[13px] font-semibold hover:bg-brand/90 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Clear Search & Filters
            </button>
          </div>
        ) : (
          <>
            {listings.map((listing) => (
              <SearchResultCard
                key={listing.id}
                listing={listing}
                currentUserId={user?.id ?? null}
                onShare={(l) => setShareListing(l)}
              />
            ))}

            <div ref={sentinelRef} className="h-4" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && listings.length > 0 && (
              <p className="text-center text-slate-400 text-[13px] py-4">
                You've reached the end of search results
              </p>
            )}
          </>
        )}
      </div>

      <ShareModal
        isOpen={!!shareListing}
        listing={shareListing}
        onClose={() => setShareListing(null)}
      />
    </div>
  );
}
