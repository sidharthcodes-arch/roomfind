"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TwitterImageGrid from "@/components/TwitterImageGrid";
import ImageLightboxModal from "@/components/ImageLightboxModal";
import {
  MapPin,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  CheckCircle,
} from "lucide-react";

function timeAgo(dateStr) {
  if (!dateStr) return "recently";
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

export default function ListingCard({
  listing,
  currentUserId,
  onLikeToggle,
  onBookmarkToggle,
  onShare,
}) {
  const router = useRouter();
  const isTaken =
    listing.status === "taken" ||
    listing.status === "booked" ||
    listing.is_available === false;
  const photos = listing.photos ?? [];
  const [liked, setLiked] = useState(listing._liked ?? false);
  const [likeCount, setLikeCount] = useState(listing._likeCount ?? 0);
  const [saved, setSaved] = useState(listing._saved ?? false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const ownerName = listing.users?.full_name ?? "Owner";
  const ownerInitials = initials(ownerName);

  useEffect(() => {
    setLiked(listing._liked ?? false);
    setLikeCount(listing._likeCount ?? 0);
  }, [listing._liked, listing._likeCount]);

  useEffect(() => {
    setSaved(listing._saved ?? false);
  }, [listing._saved]);

  const handleCardClick = () => {
    router.push(`/listings/${listing.id}`);
  };

  const handleOpenLightbox = (index) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const handleLike = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!currentUserId) {
      router.push("/auth");
      return;
    }
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

  const handleBookmark = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!currentUserId) {
      router.push("/auth");
      return;
    }
    const nextSaved = !saved;
    setSaved(nextSaved);
    onBookmarkToggle?.(listing.id, nextSaved);

    if (nextSaved) {
      const { error } = await supabase
        .from("bookmarks")
        .insert({ listing_id: listing.id, user_id: currentUserId });
      if (error && error.code !== "23505") {
        console.error("Bookmark error:", error);
        setSaved(saved);
        onBookmarkToggle?.(listing.id, saved);
      }
    } else {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("listing_id", listing.id)
        .eq("user_id", currentUserId);
      if (error) {
        console.error("Unbookmark error:", error);
        setSaved(saved);
        onBookmarkToggle?.(listing.id, saved);
      }
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
    ? `https://wa.me/${listing.users.phone_number.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hi, I saw your listing "${listing.title}" on RoomFind. Is it still available?`,
      )}`
    : null;

  return (
    <article
      onClick={handleCardClick}
      className="bg-white rounded-2xl overflow-hidden border border-black/[0.09] mb-3 cursor-pointer group hover:border-black/20 transition-all shadow-2xs hover:shadow-xs"
    >
      {/* Owner row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0 overflow-hidden">
          {listing.users?.profile_photo ? (
            <img
              src={listing.users.profile_photo}
              alt=""
              className="w-full h-full object-cover"
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
            {/* Verified owner badge */}
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-brand bg-brand-light px-1.5 py-0.5 rounded-full shrink-0">
              <CheckCircle className="w-3 h-3" />
              Owner
            </span>
          </div>
          <p className="text-[12px] text-slate-400 truncate">
            {listing.area || listing.city
              ? `${listing.area || listing.city} · `
              : ""}
            {timeAgo(listing.created_at)}
          </p>
        </div>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600"
        >
          <span className="text-xl leading-none">···</span>
        </button>
      </div>

      {/* Twitter-Style Multi Image Grid */}
      <div className="relative px-3">
        <TwitterImageGrid photos={photos} onImageClick={handleOpenLightbox} />

        {/* Status + room type badges overlay */}
        <div className="absolute top-2.5 left-5 z-[1] flex gap-1.5 pointer-events-none">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${
              isTaken ? "bg-slate-700 text-white" : "bg-brand text-white"
            }`}
          >
            {isTaken ? "Taken" : "Available"}
          </span>
          {listing.room_type && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm capitalize">
              {listing.room_type}
            </span>
          )}
        </div>
      </div>

      {/* Twitter-Style Full Screen Lightbox Modal */}
      {isLightboxOpen && (
        <ImageLightboxModal
          isOpen={isLightboxOpen}
          photos={photos}
          initialIndex={lightboxIndex}
          listing={{ ...listing, _liked: liked, _likeCount: likeCount }}
          onClose={() => setIsLightboxOpen(false)}
          onLikeToggle={handleLike}
          onShare={() => handleShare()}
        />
      )}

      {/* Price + details */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-[22px] font-bold text-slate-900">
            ₹{Number(listing.price || 0).toLocaleString("en-IN")}
          </span>
          <span className="text-[13px] text-slate-400">/month</span>
        </div>
        <p className="text-[14px] text-slate-700 font-medium line-clamp-1 mb-1">
          {listing.title}
        </p>
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[12px] text-slate-500 truncate">
            {listing.address || `${listing.area || ""}, ${listing.city || ""}`}
          </span>
        </div>

        {/* Tags (Distance, Furnished, Gender - NO BROKER TAG REMOVED) */}
        <div className="flex flex-wrap gap-1.5">
          {listing._distanceKm != null && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-1 border border-emerald-200/60">
              <span>📍</span>
              {listing._distanceKm < 1
                ? `${Math.round(listing._distanceKm * 1000)}m away`
                : `${listing._distanceKm.toFixed(1)} km away`}
            </span>
          )}
          {listing.furnished && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-light text-brand font-semibold border border-brand/20">
              Furnished
            </span>
          )}
          {listing.bhk_type && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200/60">
              {listing.bhk_type}
            </span>
          )}
          {listing.gender_preference &&
            listing.gender_preference !== "any" &&
            listing.gender_preference !== "all" && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium capitalize border border-slate-200/60">
                {listing.gender_preference === "male"
                  ? "Male only"
                  : "Female preferred"}
              </span>
            )}
        </div>
      </div>

      {/* Action row (Clicks here do NOT open detail page) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center px-3 py-1 border-t border-black/[0.05]"
      >
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors hover:bg-slate-50"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              liked ? "fill-coral text-coral" : "text-slate-400"
            }`}
          />
          <span
            className={`text-[13px] font-medium ${
              liked ? "text-coral" : "text-slate-500"
            }`}
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
          onClick={handleBookmark}
          className="ml-auto flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-50 transition-colors"
          title={saved ? "Remove from saved" : "Save listing"}
          aria-label={saved ? "Remove from saved" : "Save listing"}
        >
          <Bookmark
            className={`w-5 h-5 transition-colors ${
              saved ? "fill-brand text-brand" : "text-slate-400 hover:text-slate-600"
            }`}
          />
        </button>
      </div>

      {/* CTA Section */}
      <div onClick={(e) => e.stopPropagation()} className="px-4 pb-4 pt-1">
        {isTaken ? (
          <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-semibold text-[14px] cursor-not-allowed select-none">
            Room no longer available
          </div>
        ) : whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand text-white font-semibold text-[14px] active:opacity-90 transition-opacity"
          >
            <svg
              className="w-4 h-4 fill-white"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contact on WhatsApp
          </a>
        ) : (
          <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-100 text-slate-500 font-semibold text-[14px] border border-black/[0.05] select-none">
            Available (No Contact Phone Listed)
          </div>
        )}
      </div>
    </article>
  );
}
