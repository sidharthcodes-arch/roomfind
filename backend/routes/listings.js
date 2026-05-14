const express = require('express');
const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const SavedListing = require('../models/SavedListing');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Helper to optionally get user if token is present, but don't fail if not
const optionalAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const jwt = require('jsonwebtoken');
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey');
    } catch (e) {
      // ignore invalid token for optional auth
    }
  }
  next();
};

// Get all listings (with pagination and filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.room_type) query.room_type = req.query.room_type;
    if (req.query.furnished === 'true') query.furnished = true;
    if (req.query.max_price) query.price = { $lte: parseInt(req.query.max_price) };

    const listings = await Listing.find(query)
      .populate('user_id', 'full_name phone_number profile_photo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // If user is logged in, attach like/save status
    let listingsWithMeta = listings.map(l => l.toObject());
    
    if (req.user) {
      const listingIds = listings.map(l => l._id);
      
      const userLikes = await Like.find({ user_id: req.user.id, listing_id: { $in: listingIds } });
      const userSaves = await SavedListing.find({ user_id: req.user.id, listing_id: { $in: listingIds } });
      
      const likedSet = new Set(userLikes.map(l => l.listing_id.toString()));
      const savedSet = new Set(userSaves.map(s => s.listing_id.toString()));
      
      listingsWithMeta = listingsWithMeta.map(l => ({
        ...l,
        _liked: likedSet.has(l._id.toString()),
        _saved: savedSet.has(l._id.toString())
      }));
    }

    // Attach counts (simplified, in production you'd use aggregation)
    for (let l of listingsWithMeta) {
      l._likeCount = await Like.countDocuments({ listing_id: l._id });
      l._commentCount = await Comment.countDocuments({ listing_id: l._id });
    }

    res.json(listingsWithMeta);
  } catch (error) {
    console.error('Fetch listings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single listing
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    const listing = await Listing.findById(req.params.id).populate('user_id', 'full_name phone_number profile_photo');
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    const listingObj = listing.toObject();
    listingObj._likeCount = await Like.countDocuments({ listing_id: listing._id });
    listingObj._commentCount = await Comment.countDocuments({ listing_id: listing._id });

    if (req.user) {
      listingObj._liked = !!(await Like.findOne({ listing_id: listing._id, user_id: req.user.id }));
      listingObj._saved = !!(await SavedListing.findOne({ listing_id: listing._id, user_id: req.user.id }));
    }

    res.json(listingObj);
  } catch (error) {
    console.error('Fetch listing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a listing
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'landlord') {
      return res.status(403).json({ message: 'Only landlords can post listings' });
    }

    const newListing = new Listing({
      ...req.body,
      user_id: req.user.id
    });

    await newListing.save();
    res.status(201).json(newListing);
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a listing
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    if (listing.user_id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await Listing.findByIdAndDelete(req.params.id);
    // Cleanup related documents
    await Like.deleteMany({ listing_id: req.params.id });
    await Comment.deleteMany({ listing_id: req.params.id });
    await SavedListing.deleteMany({ listing_id: req.params.id });
    
    res.json({ message: 'Listing removed' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle Like
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const existing = await Like.findOne({ listing_id: req.params.id, user_id: req.user.id });
    if (existing) {
      await Like.findByIdAndDelete(existing._id);
      res.json({ liked: false });
    } else {
      await new Like({ listing_id: req.params.id, user_id: req.user.id }).save();
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle Save (Bookmark)
router.post('/:id/save', authMiddleware, async (req, res) => {
  try {
    const existing = await SavedListing.findOne({ listing_id: req.params.id, user_id: req.user.id });
    if (existing) {
      await SavedListing.findByIdAndDelete(existing._id);
      res.json({ saved: false });
    } else {
      await new SavedListing({ listing_id: req.params.id, user_id: req.user.id }).save();
      res.json({ saved: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
