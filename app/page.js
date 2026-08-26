"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { filterByDistance, filterBySearch } from "@/lib/utils";
import ShareModal from "@/components/ShareModal";
import TwitterImageGrid from "@/components/TwitterImageGrid";
import ImageLightboxModal from "@/components/ImageLightboxModal";
import { RoomFindLogo } from "@/components/Logo";
import {
  Bell,
  MapPin,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Plus,
  CheckCircle,
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";

const PAGE_SIZE = 10;

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
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

// ─── filter chips ────────────────────────────────────────────────────────────

const FILTERS = [
  "All",
  "Near you",
  "Single",
  "Shared",
  "Furnished",
  "Under ₹5k",
];

// ─── skeleton card ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-black/[0.09] animate-pulse mb-3">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-slate-200 rounded w-32" />
          <div className="h-3 bg-slate-200 rounded w-24" />
        </div>
      </div>
      <div className="aspect-[4/3] bg-slate-200" />
      <div className="px-4 py-3 space-y-2">
        <div className="h-5 bg-slate-200 rounded w-24" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
  );
}

async function copyTextToClipboard(text) {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    textArea.remove();
    return successful;
  } catch (_) {
    return false;
  }
}

import ListingCard from "@/components/ListingCard";

// ─── main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [hasNotif, setHasNotif] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shareListing, setShareListing] = useState(null);
  const pageRef = useRef(0);
  const sentinelRef = useRef(null);

  const displayListings = useMemo(() => {
    if (!searchQuery.trim()) return listings;
    return filterBySearch(listings, searchQuery.trim());
  }, [listings, searchQuery]);

  // Geolocation
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }
  }, []);

  const buildQuery = useCallback(
    (from, to) => {
      let q = supabase
        .from("listings")
        .select("*, users(full_name, phone_number, profile_photo)")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (activeFilter === "Single") q = q.eq("room_type", "single");
      if (activeFilter === "Shared") q = q.eq("room_type", "shared");
      if (activeFilter === "Furnished") q = q.eq("furnished", true);
      if (activeFilter === "Under ₹5k") q = q.lte("price", 5000);

      // Server-side geographic bounding box query for "Near you"
      if (activeFilter === "Near you" && userLat != null && userLng != null) {
        const deltaLat = radiusKm / 111.045;
        const deltaLng =
          radiusKm / (111.045 * Math.cos((userLat * Math.PI) / 180));

        q = q
          .gte("latitude", userLat - deltaLat)
          .lte("latitude", userLat + deltaLat)
          .gte("longitude", userLng - deltaLng)
          .lte("longitude", userLng + deltaLng);
      }

      return q;
    },
    [activeFilter, userLat, userLng, radiusKm],
  );

  const fetchPage = useCallback(
    async (page, replace = false) => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await buildQuery(from, to);

      if (error) {
        console.error("listings fetch error:", error);
        setFetchError(error.message);
        return;
      }
      if (!data || data.length === 0) {
        setHasMore(false);
        if (replace) setListings([]);
        return;
      }

      // Fetch like counts + user like status — failures here must NOT block listings
      const ids = data.map((l) => l.id);
      let likesData = [],
        userLikes = [],
        commentsData = [];
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
      } catch (_) {
        // likes/comments tables may not exist yet — show listings anyway
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

      let enriched = data.map((l) => ({
        ...l,
        _liked: userLikeSet.has(l.id),
        _likeCount: likeCountMap[l.id] ?? 0,
        _commentCount: commentCountMap[l.id] ?? 0,
      }));

      // Near you filter — Haversine distance calculation and sorting
      if (activeFilter === "Near you" && userLat != null && userLng != null) {
        enriched = filterByDistance(enriched, userLat, userLng, radiusKm);
      }

      setHasMore(data.length === PAGE_SIZE);
      setListings((prev) => (replace ? enriched : [...prev, ...enriched]));
    },
    [buildQuery, user, userLat, userLng, activeFilter, radiusKm],
  );

  const handleLikeToggle = (listingId, isLiked) => {
    setListings((prev) =>
      prev.map((item) =>
        item.id === listingId
          ? {
              ...item,
              _liked: isLiked,
              _likeCount: isLiked
                ? (item._likeCount ?? 0) + 1
                : Math.max(0, (item._likeCount ?? 1) - 1),
            }
          : item,
      ),
    );
  };

  // Initial load / filter change / user auth resolution
  useEffect(() => {
    if (authLoading) return;
    pageRef.current = 0;
    setListings([]);
    setHasMore(true);
    setFetchError(null);
    setLoading(true);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [activeFilter, radiusKm, user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
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

  return (
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.09] px-4 py-3 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <RoomFindLogo showText={true} />
        </Link>

        {/* Right: Rounded Square Action Buttons (Search Link + Notification Bell) */}
        <div className="flex items-center gap-2">
          {/* Rounded Square Search Icon button linking directly to /search page */}
          <Link
            href="/search"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 transition-all border border-black/[0.04]"
            title="Search listings"
            aria-label="Search listings"
          >
            <Search className="w-4.5 h-4.5 text-slate-700" />
          </Link>

          {/* Rounded Square Notification Bell button */}
          <button
            onClick={() => setHasNotif(false)}
            className="relative w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 transition-all border border-black/[0.04]"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-slate-700" />
            {hasNotif && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-coral border-2 border-white animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* ── Filter chips with Scroll Edge Affordance ── */}
      <div className="sticky top-[57px] z-30 bg-white/95 backdrop-blur-md border-b border-black/[0.09] relative">
        <div className="px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide relative z-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all active:scale-95 ${
                activeFilter === f
                  ? "bg-brand text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {/* Right-edge gradient fade cue for horizontal scroll affordance */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
      </div>

      {/* ── Radius selector sub-bar for Near You filter ── */}
      {activeFilter === "Near you" && (
        <div className="bg-slate-50 border-b border-black/[0.07] px-4 py-2 flex items-center justify-between text-[12px] text-slate-600">
          <span className="font-medium">Search Radius:</span>
          <div className="flex gap-1.5">
            {[2, 5, 10, 20, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[12px] transition-all ${
                  radiusKm === r
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Feed ── */}
      <div className="px-3 pt-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-slate-600 font-medium mb-1">
              Could not load listings
            </p>
            <p className="text-red-400 text-[12px] font-mono bg-red-50 px-3 py-2 rounded-lg mt-2 max-w-xs break-all">
              {fetchError}
            </p>
            <button
              onClick={() => {
                setFetchError(null);
                setLoading(true);
                fetchPage(0, true).finally(() => setLoading(false));
              }}
              className="mt-4 text-[13px] text-brand font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : displayListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl p-6 border border-slate-200/80 my-3 shadow-xs">
            <MapPin className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-800 font-bold text-[15px] mb-1">No listings found</p>
            <p className="text-slate-500 text-[13px] max-w-xs mb-4">
              {searchQuery ? `No rooms matched "${searchQuery}"` : "Try a different filter"}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-semibold text-[13px] transition-colors shadow-sm"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            {displayListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                currentUserId={user?.id ?? null}
                onLikeToggle={handleLikeToggle}
                onShare={(l) => setShareListing(l)}
              />
            ))}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && listings.length > 0 && (
              <p className="text-center text-slate-400 text-[13px] py-4">
                You've seen all listings
              </p>
            )}
          </>
        )}
      </div>

      {/* ── FAB (owners only) ── */}
      <Link
        href="/create-listing"
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-brand shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Post a listing"
      >
        <Plus className="w-7 h-7 text-white stroke-[2.5]" />
      </Link>

      {/* ── Share Modal ── */}
      <ShareModal
        isOpen={!!shareListing}
        listing={shareListing}
        onClose={() => setShareListing(null)}
      />
    </div>
  );
}
