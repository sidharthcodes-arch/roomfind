const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  city: { type: String, required: true },
  area: { type: String, required: true },
  address: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  room_type: { type: String, required: true }, // single, shared, full apartment
  furnished: { type: Boolean, default: false },
  gender_preference: { type: String, enum: ['any', 'male', 'female'], default: 'any' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  photos: [{ type: String }],
  is_available: { type: Boolean, default: true },
  status: { type: String, enum: ['available', 'taken'], default: 'available' }
}, { timestamps: true });

// Add spatial index for "Near you" filtering
listingSchema.index({ latitude: 1, longitude: 1 });

module.exports = mongoose.model('Listing', listingSchema);
