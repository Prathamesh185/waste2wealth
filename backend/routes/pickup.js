const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Pickup = require('../models/Pickup'); // ✅ Make sure this is imported
const User = require('../models/User');
const Compost = require('../models/Compost');

const ALLOWED_STATUSES = ['pending', 'processing', 'picked', 'completed', 'rejected'];

async function applyCompletionSideEffects(pickup) {
  pickup.status = 'completed';
  pickup.completedDate = new Date();
  pickup.pointsAwarded = pickup.pointsAwarded || Math.round((pickup.quantity || 0) * 10);
  await pickup.save();

  if (pickup.userId?._id) {
    const user = await User.findById(pickup.userId._id);
    if (user) {
      user.rewardPoints = (user.rewardPoints || 0) + pickup.pointsAwarded;
      await user.save();
    }
  }

  const compost = await Compost.findOne();
  if (compost) {
    compost.available = (compost.available || 0) + (pickup.quantity || 0);
    await compost.save();
  }

  return pickup;
}

// Request pickup (Household only)
router.post('/request', auth, async (req, res) => {
  try {
    if (req.user.role !== 'household') {
      return res.status(403).json({ message: 'Only household users can request pickups' });
    }

    const { quantity, address, wasteType, phone, pickupDate, pickupTime, instructions } = req.body;
    if (!quantity || !address)
      return res.status(400).json({ message: 'Quantity and address are required' });

    const pickup = new Pickup({
      userId: req.user.userId,
      quantity,
      address,
      wasteType,
      phone,
      pickupDate,
      pickupTime,
      instructions,
      status: 'pending',
      requestDate: new Date()
    });

    // ✅ Geocoding with fallback
    if (!req.body.lat && address) {
      try {
        const fetch = require('node-fetch');
        const cleanAddress = address.trim().replace(/\s+/g, ' ');
        const encodedAddress = encodeURIComponent(`${cleanAddress}, Mysuru, Karnataka, India`);
        const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
        
        console.log(`🔍 Geocoding: ${cleanAddress}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        const geoRes = await fetch(geoUrl, {
          headers: { 'User-Agent': 'Waste2Wealth-App/1.0' },
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          
          if (geoData && geoData.length > 0) {
            pickup.lat = parseFloat(geoData[0].lat);
            pickup.lon = parseFloat(geoData[0].lon);
            console.log(`✅ Geocoded: (${pickup.lat}, ${pickup.lon})`);
          } else {
            throw new Error('No geocoding results');
          }
        } else {
          throw new Error(`Geocoding API error: ${geoRes.status}`);
        }
        
      } catch (geoError) {
        console.warn(`⚠️ Geocoding failed (${geoError.message}), using fallback coordinates`);
        
        const addressHash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const latOffset = ((addressHash % 100) - 50) / 1000;
        const lonOffset = ((addressHash % 100) - 50) / 1000;
        
        pickup.lat = 12.2958 + latOffset;
        pickup.lon = 76.6394 + lonOffset;
        
        console.log(`📍 Fallback coordinates: (${pickup.lat}, ${pickup.lon})`);
      }
    } else if (req.body.lat && req.body.lon) {
      pickup.lat = req.body.lat;
      pickup.lon = req.body.lon;
    } else {
      pickup.lat = 12.2958;
      pickup.lon = 76.6394;
    }

    await pickup.save();
    console.log(`✅ Pickup request saved: ${pickup._id}`);

    res.status(201).json({ 
      message: 'Pickup request submitted successfully', 
      pickup 
    });
    
  } catch (err) {
    console.error('❌ Pickup request error:', err);
    res.status(500).json({ 
      message: 'Failed to submit pickup request', 
      error: err.message 
    });
  }
});

// Get household's pickups (NO ADMIN AUTH NEEDED)
router.get('/my', auth, async (req, res) => {
  try {
    console.log(`📋 Fetching pickups for user: ${req.user.userId}`);
    
    const pickups = await Pickup.find({ userId: req.user.userId })
      .sort({ requestDate: -1 });
    
    console.log(`✅ Found ${pickups.length} pickups`);
    res.json(pickups);
  } catch (err) {
    console.error('❌ Error fetching user pickups:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ FIX: Admin get all pickups (was fetching Orders!)
router.get('/all', auth, adminAuth, async (req, res) => {
  try {
    const pickups = await Pickup.find()
      .populate('userId', 'name email phone')
      .sort({ requestDate: -1 });
    
    // console.log(`✅ Fetched ${pickups.length} pickups for admin`);
    res.json(pickups);
  } catch (err) {
    console.error('❌ Error fetching all pickups:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin: Update pickup status
router.put('/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const pickup = await Pickup.findById(req.params.id).populate('userId');
    if (!pickup) {
      return res.status(404).json({ message: 'Pickup not found' });
    }

    const currentStatus = pickup.status;

    if (status === 'completed' && currentStatus !== 'completed') {
      await applyCompletionSideEffects(pickup);
      const populated = await Pickup.findById(pickup._id).populate('userId', 'name email phone');
      return res.json({ message: 'Pickup marked as completed', pickup: populated });
    }

    if (status !== 'completed') {
      pickup.status = status;
      if (currentStatus === 'completed' && status !== 'completed') {
        pickup.completedDate = undefined;
        pickup.pointsAwarded = pickup.pointsAwarded || 0;
      }
      await pickup.save();
    }

    const populated = await Pickup.findById(pickup._id).populate('userId', 'name email phone');
    return res.json({ message: `Pickup status updated to ${status}`, pickup: populated });
  } catch (err) {
    console.error('❌ Error updating pickup status:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin: Mark pickup completed
router.put('/:id/complete', auth, adminAuth, async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id).populate('userId');
    if (!pickup) return res.status(404).json({ message: 'Pickup not found' });

    if (pickup.status === 'completed')
      return res.status(400).json({ message: 'Pickup already completed' });

    await applyCompletionSideEffects(pickup);
    const populated = await Pickup.findById(pickup._id).populate('userId', 'name email phone');

    res.json({ message: 'Pickup marked as completed', pickup: populated });
  } catch (err) {
    console.error('❌ Error completing pickup:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;