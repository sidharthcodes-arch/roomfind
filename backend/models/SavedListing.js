const mongoose = require('mongoose');

const savedListingSchema = new mongoose.Schema({
  listing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// User can only save a listing once
savedListingSchema.index({ listing_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('SavedListing', savedListingSchema);
