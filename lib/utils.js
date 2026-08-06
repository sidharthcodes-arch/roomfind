/**
 * Calculate accurate distance between two coordinates on Earth in km (Haversine formula).
 */
export function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Enrich listings with distance and filter within specified maxRadiusKm.
 * Sorts listings by closest distance first.
 */
export function filterByDistance(listings, userLat, userLng, maxRadiusKm = 20) {
  if (userLat == null || userLng == null) return listings

  return listings
    .map((listing) => {
      const dist = getDistance(userLat, userLng, listing.latitude, listing.longitude)
      return { ...listing, _distanceKm: dist }
    })
    .filter((listing) => {
      if (listing._distanceKm == null) return false
      return listing._distanceKm <= maxRadiusKm
    })
    .sort((a, b) => (a._distanceKm ?? 9999) - (b._distanceKm ?? 9999))
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
