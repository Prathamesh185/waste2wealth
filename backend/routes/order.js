const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Order = require('../models/Order');
const Compost = require('../models/Compost');

// ✅ Helper function to geocode address
async function geocodeAddress(address) {
  if (!address || address === 'Not provided') {
    return null;
  }

  try {
    const fetch = require('node-fetch');
    const cleanAddress = address.trim().replace(/\s+/g, ' ');
    const encodedAddress = encodeURIComponent(`${cleanAddress}, Mysuru, Karnataka, India`);
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
    
    console.log(`🔍 Geocoding order address: ${cleanAddress}`);
    
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
        const coords = {
          lat: parseFloat(geoData[0].lat),
          lon: parseFloat(geoData[0].lon)
        };
        console.log(`✅ Geocoded order address: (${coords.lat}, ${coords.lon})`);
        return coords;
      }
    }
  } catch (error) {
    console.warn(`⚠️ Geocoding failed for order: ${error.message}`);
  }
  
  // Fallback coordinates (near Mysuru)
  const addressHash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latOffset = ((addressHash % 100) - 50) / 1000;
  const lonOffset = ((addressHash % 100) - 50) / 1000;
  
  return {
    lat: 12.2958 + latOffset,
    lon: 76.6394 + lonOffset
  };
}

// Create Order (Farmer)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can order compost' });
    }

    const { compostName, quantity, deliveryAddress, lat, lon, pricePerKg, totalAmount } = req.body;

    if (!compostName)
      return res.status(400).json({ message: "Compost name required" });

    const qty = Number(quantity);
    if (qty <= 0)
      return res.status(400).json({ message: "Invalid quantity" });

    // ⭐ OPTIONAL: Validate compost exists
    // const item = await InventoryItem.findOne({ name: compostName });
    // if (!item) return res.status(400).json({ message: "Compost not found" });

    const newOrder = new Order({
      farmerId: req.user.userId,
      compostName,
      quantity: qty,
      deliveryAddress: deliveryAddress || 'Not provided',
      pricePerKg,
      totalAmount,
      status: 'pending'
    });

    // coordinates
    if (lat && lon) {
      newOrder.lat = lat;
      newOrder.lon = lon;
    }

    await newOrder.save();

    res.status(201).json({
      message: "Order placed successfully",
      order: newOrder
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



// Update order status (Admin only)
router.put('/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'in-transit', 'rejected', 'delivered'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status === status) {
      const populatedOrder = await Order.findById(order._id).populate('farmerId', 'name email phone');
      return res.json({ message: `Order already ${status}`, order: populatedOrder });
    }

    // Confirm: check stock, deduct, set pricing & total
    if (status === 'confirmed' && order.status === 'pending') {
      const compost = await Compost.findOne();
      if (!compost || order.quantity > (compost.available || 0)) {
        return res.status(400).json({ message: 'Not enough stock to approve order' });
      }

      compost.available -= order.quantity;
      await compost.save();

      order.pricePerKg = compost.pricePerKg || 0;
      order.totalAmount = order.quantity * order.pricePerKg;
    }

    if (status === 'rejected' && order.status === 'pending') {
      order.pricePerKg = 0;
      order.totalAmount = 0;
    }

    if (status === 'in-transit') {
      if (order.status !== 'confirmed') {
        return res.status(400).json({ message: 'Only confirmed orders can move to in-transit' });
      }
    }

    if (status === 'delivered') {
      if (!['confirmed', 'in-transit'].includes(order.status)) {
        return res.status(400).json({ message: 'Order must be confirmed or in-transit before marking delivered' });
      }
    }

    order.status = status;
    await order.save();

    const populated = await Order.findById(order._id).populate('farmerId', 'name email phone');

    res.json({ message: `Order ${status} successfully`, order: populated });
  } catch (e) {
    console.error('❌ Order status update error:', e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Get farmer's own orders
router.get('/my', auth, async (req, res) => {
  try {
    const orders = await Order.find({ farmerId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('❌ Error fetching farmer orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: get all orders
router.get('/all', auth, adminAuth, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('farmerId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// ✅ Admin: Fix missing coordinates for all orders
router.post('/fix-coordinates', auth, adminAuth, async (req, res) => {
  try {
    // Find orders without coordinates
    const ordersWithoutCoords = await Order.find({
      $or: [
        { lat: { $exists: false } },
        { lon: { $exists: false } },
        { lat: null },
        { lon: null }
      ]
    });

    console.log(`📦 Found ${ordersWithoutCoords.length} orders without coordinates`);

    let updated = 0;

    for (const order of ordersWithoutCoords) {
      const coords = await geocodeAddress(order.deliveryAddress);

      if (coords) {
        order.lat = coords.lat;
        order.lon = coords.lon;
        await order.save();
        updated++;
        console.log(`✅ Updated order ${order._id}: (${coords.lat}, ${coords.lon})`);
        
        // Rate limit: 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.json({
      message: `Fixed coordinates for ${updated} orders`,
      total: ordersWithoutCoords.length,
      updated
    });
  } catch (error) {
    console.error('❌ Error fixing coordinates:', error);
    res.status(500).json({ message: 'Failed to fix coordinates', error: error.message });
  }
});
module.exports = router;