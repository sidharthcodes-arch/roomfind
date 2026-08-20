# 📋 RoomFind Real Development TODO & Launch Backlog

---

## 🚨 1. Missing Backend Integration (Current Mock Features)

### 💬 Comments & Community Discussion
- [ ] **Supabase Table Setup**: Create/connect `listing_comments` table (`id`, `listing_id`, `user_id`, `comment_text`, `created_at`).
- [ ] **Fetch & Post Comments**: Replace hardcoded mock comments in `app/listings/[id]/page.js` with live Supabase queries and `insert()` calls.
- [ ] **Realtime Updates**: Enable Supabase Realtime so new owner/user comments pop up instantly.

### 🔖 Bookmarks & Saved Rooms
- [ ] **Supabase Table Setup**: Create `user_bookmarks` table (`user_id`, `listing_id`).
- [ ] **Bookmark Toggle**: Replace local `useState(saved)` on listing card & detail page with DB sync.
- [ ] **Saved Page Route**: Build `/profile/saved` or `/saved` page for users to view bookmarked listings.

### 🧭 Listing Page Live Geolocation
- [ ] **Active GPS Request**: `app/listings/[id]/page.js` currently only checks `localStorage`. Add direct `navigator.geolocation.getCurrentPosition()` fallback if local storage is empty so `userDistance` is accurately calculated on direct page land.

---

## ⚡ 2. Recommended Polish & Optimization

### 🔗 Dynamic OpenGraph Meta Tags (Social Links)
- [ ] **Next.js `generateMetadata`**: Implement dynamic OpenGraph tags on `app/listings/[id]/page.js` so WhatsApp and social shares preview room photo, title, and price pill.

### 🖼️ Image Compression & Loading
- [ ] **Client-side Compression**: Compress images before upload to Supabase Storage.
- [ ] **Next.js `<Image />` Component**: Replace native `<img>` tags with Next.js image optimization for fast WebP loading.

### 🛡️ Safety & Reporting
- [ ] **Report Listing Modal**: Add option for users to report fake or taken listings.
- [ ] **Owner Phone Verification**: OTP SMS verification before publishing contact details.

---

*Verified against current codebase state.*
