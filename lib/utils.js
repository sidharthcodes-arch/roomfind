/**
 * Calculate Euclidean distance approximation between two coordinates in km.
 * 1 degree ≈ 111 km
 */
export function getDistance(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2) * 111
}

/**
 * Filter listings to those within 20km of user coordinates.
 * Listings without coordinates are always included.
 */
export function filterByDistance(listings, userLat, userLng) {
  return listings.filter((listing) => {
    if (listing.latitude == null || listing.longitude == null) return true
    return getDistance(listing.latitude, listing.longitude, userLat, userLng) <= 20
  })
}

/**
 * Filter listings by case-insensitive substring match on title, area, or city.
 */
export function filterBySearch(listings, query) {
  const q = query.toLowerCase()
  return listings.filter(
    (listing) =>
      listing.title?.toLowerCase().includes(q) ||
      listing.area?.toLowerCase().includes(q) ||
      listing.city?.toLowerCase().includes(q)
  )
}

/**
 * Sanitize a filename by replacing non-alphanumeric characters (except . and -) with _.
 */
export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9.\-]/g, '_')
}

/**
 * Format a price as ₹X,XX,XXX/mo using Indian locale.
 */
export function formatPrice(price) {
  return `₹${Number(price).toLocaleString('en-IN')}/mo`
}
