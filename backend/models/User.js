const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  full_name: { type: String },
  phone_number: { type: String },
  profile_photo: { type: String },
  role: { type: String, enum: ['tenant', 'landlord'], default: 'tenant' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
