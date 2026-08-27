"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import ShareModal from "@/components/ShareModal";
import {
  Bookmark,
  ArrowLeft,
  RotateCcw,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Compass,
} from "lucide-react";

function Toast({ message, onUndo, onDismiss }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[13px] font-medium px-4 py-3 rounded-2xl shadow-xl max-w-sm w-full mx-4 flex items-center justify-between gap-3 animate-fade-in border border-slate-700">
      <span className="truncate">{message}</span>
      <div className="flex items-center gap-2 shrink-0">
        {onUndo && (
          <button
            onClick={onUndo}
            className="text-brand font-bold hover:underline flex items-center gap-1 text-[12px]"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Undo
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function HorizontalCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-3 border border-black/[0.09] animate-pulse flex items-center gap-3">
      <div className="w-24 h-24 sm:w-26 sm:h-26 rounded-xl bg-slate-200 shrink-0" />
      <div className="flex-1 space-y-2 py-1 min-w-0">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-5 bg-slate-200 rounded w-20 pt-1" />
      </div>
      <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0 self-center" />
    </div>
  );
}

const FILTER_CHIPS = ["All", "Recently added", "Price"];

export default function SavedPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState("All");
  const [shareListing, setShareListing] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, onUndo = null) => {
    setToast({ message, onUndo });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchSavedListings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Query user's bookmarks joined with listings and landlord profile
      const { data: bookmarkRows, error } = await supabase
        .from("bookmarks")
        .select(`
          id,
          created_at,
          listing:listings (
            *,
            users (
              full_name,
              phone_number,
              profile_photo
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rawListings = (bookmarkRows ?? [])
        .map((b) => ({
          ...b.listing,
          _bookmark_id: b.id,
          _bookmarked_at: b.created_at,
        }))
        .filter((l) => l && l.id);

      setSavedItems(rawListings);
    } catch (err) {
      console.error("Error fetching saved rooms:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchSavedListings();
    }
  }, [authLoading, fetchSavedListings]);

  // Tap to unsave
  const handleUnsave = async (e, listing) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    const targetId = listing.id;

    // Optimistically remove from state
    setSavedItems((prev) => prev.filter((item) => item.id !== targetId));

    showToast("Removed from saved rooms", async () => {
      // Undo action callback
      setSavedItems((prev) => [listing, ...prev]);
      setToast(null);
      await supabase
        .from("bookmarks")
        .insert({ user_id: user.id, listing_id: targetId });
    });

    try {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", targetId);

      if (error) {
        console.error("Failed to delete bookmark:", error);
      }
    } catch (err) {
      console.error("Error unsaving listing:", err);
    }
  };

  // Filter chips sorting/filtering
  const filteredListings = useMemo(() => {
    let result = [...savedItems];

    if (activeChip === "Recently added") {
      result.sort(
        (a, b) =>
          new Date(b._bookmarked_at || b.created_at) -
          new Date(a._bookmarked_at || a.created_at),
      );
    } else if (activeChip === "Price") {
      result.sort((a, b) => Number(a.price) - Number(b.price));
    }

    return result;
  }, [savedItems, activeChip]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">
        <header className="sticky top-0 z-30 bg-white border-b border-black/[0.09] px-4 py-3.5 flex items-center justify-between">
          <h1 className="font-extrabold text-slate-900 text-lg">Saved rooms</h1>
          <span className="text-xs text-slate-400 font-medium">Loading...</span>
        </header>
        <div className="p-3 space-y-3">
          <HorizontalCardSkeleton />
          <HorizontalCardSkeleton />
          <HorizontalCardSkeleton />
        </div>
      </div>
    );
  }

  // Guest state if user is logged out
  if (!user) {
    return (
      <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05] flex flex-col justify-center items-center px-4 py-12">
        <div className="bg-white rounded-3xl p-8 border border-black/[0.09] text-center max-w-sm w-full shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-light text-brand flex items-center justify-center mx-auto shadow-2xs border border-brand/20">
            <Bookmark className="w-8 h-8 fill-brand text-brand" />
          </div>
          <h2 className="font-extrabold text-slate-900 text-xl">Saved rooms</h2>
          <p className="text-slate-500 text-[13.5px] leading-relaxed">
            Sign in to bookmark listings and access your saved rooms anytime, on any device.
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="w-full py-3 rounded-2xl bg-brand text-white font-bold text-[14px] hover:bg-brand/90 active:scale-98 transition-all shadow-sm"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">
      {toast && (
        <Toast
          message={toast.message}
          onUndo={toast.onUndo}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* ── Page Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.09] px-4 py-3.5 flex items-center justify-between shadow-2xs">
        <h1 className="font-extrabold text-slate-900 text-lg leading-snug">
          Saved rooms
        </h1>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-black/[0.05]">
          {savedItems.length} {savedItems.length === 1 ? "saved" : "saved"}
        </span>
      </header>

      {/* ── Filter Chips Row below Header ── */}
      {savedItems.length > 0 && (
        <div className="sticky top-[57px] z-20 bg-white/95 backdrop-blur-md border-b border-black/[0.09] relative">
          <div className="px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide relative z-0">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => setActiveChip(chip)}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all active:scale-95 ${
                  activeChip === chip
                    ? "bg-brand text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
          {/* Scroll edge affordance */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />
        </div>
      )}

      {/* ── Listing Rows / Content ── */}
      <main className="px-3 pt-3">
        {loading ? (
          <div className="space-y-3">
            <HorizontalCardSkeleton />
            <HorizontalCardSkeleton />
            <HorizontalCardSkeleton />
          </div>
        ) : savedItems.length === 0 ? (
          /* Empty State (no saves) */
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-3xl p-6 border border-slate-200/80 my-4 shadow-xs space-y-3.5">
            <div className="w-16 h-16 rounded-2xl bg-brand-light text-brand flex items-center justify-center shadow-2xs border border-brand/20">
              <Bookmark className="w-8 h-8 fill-brand text-brand" />
            </div>
            <div className="space-y-1">
              <h2 className="text-slate-900 font-extrabold text-lg">
                No saved rooms yet
              </h2>
              <p className="text-slate-500 text-[13px] max-w-xs leading-relaxed">
                Tap the bookmark icon on any room listing to save it here for quick access.
              </p>
            </div>
            <Link
              href="/"
              className="mt-2 px-6 py-2.5 rounded-2xl bg-brand hover:bg-brand/90 text-white font-bold text-[13.5px] transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
            >
              <Compass className="w-4 h-4" />
              Browse rooms
            </Link>
          </div>
        ) : (
          /* Horizontal Listing Cards */
          <div className="space-y-2.5">
            {filteredListings.map((listing) => {
              const photoUrl =
                listing.photos?.[0] ||
                "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80";

              const locationText = [listing.area, listing.city]
                .filter(Boolean)
                .join(", ");

              const isTaken =
                listing.status === "taken" ||
                listing.status === "booked" ||
                listing.is_available === false;

              return (
                <div
                  key={listing.id}
                  onClick={() => router.push(`/listings/${listing.id}`)}
                  className="bg-white rounded-2xl p-3 border border-black/[0.09] shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  {/* Square thumbnail left */}
                  <div className="relative w-24 h-24 sm:w-26 sm:h-26 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    <img
                      src={photoUrl}
                      alt={listing.title || "Room thumbnail"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {isTaken && (
                      <span className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider">
                        Taken
                      </span>
                    )}
                    {listing.room_type && (
                      <span className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-md text-white text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md capitalize">
                        {listing.room_type}
                      </span>
                    )}
                  </div>

                  {/* Middle Content Stack */}
                  <div className="flex-1 min-w-0 py-0.5 space-y-1">
                    {/* Title */}
                    <h3 className="font-bold text-slate-900 text-[14px] leading-snug truncate group-hover:text-brand transition-colors">
                      {listing.title}
                    </h3>

                    {/* Distance / Location + Tag */}
                    <div className="flex items-center gap-1.5 text-[12px] text-slate-500 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{locationText || "Location"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/50 flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        No Brokerage
                      </span>
                      {listing.furnished && (
                        <span className="text-slate-500 font-medium">
                          • Furnished
                        </span>
                      )}
                    </div>

                    {/* Price, dark green, bold */}
                    <div className="pt-0.5 flex items-baseline gap-1">
                      <span className="text-[#1D9E75] font-extrabold text-[15.5px] tracking-tight">
                        ₹{Number(listing.price).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        /mo
                      </span>
                    </div>
                  </div>

                  {/* Filled bookmark icon on the right (tap to unsave) */}
                  <button
                    onClick={(e) => handleUnsave(e, listing)}
                    className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-brand transition-colors shrink-0 self-center"
                    title="Remove from saved"
                    aria-label="Remove from saved"
                  >
                    <Bookmark className="w-5 h-5 fill-brand text-brand" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Share Modal */}
      {shareListing && (
        <ShareModal
          isOpen={!!shareListing}
          listing={shareListing}
          onClose={() => setShareListing(null)}
        />
      )}
    </div>
  );
}
