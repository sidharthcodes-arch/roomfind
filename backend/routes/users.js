const express = require('express');
const User = require('../models/User');
const Listing = require('../models/Listing');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { full_name, phone_number, profile_photo } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { full_name, phone_number, profile_photo } },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's own listings
router.get('/my-listings', authMiddleware, async (req, res) => {
  try {
    const listings = await Listing.find({ user_id: req.user.id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (error) {
    console.error('Fetch user listings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
