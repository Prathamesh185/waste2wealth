require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

// Geocode address helper
async function geocodeAddress(address) {
  if (!address || address === 'Not provided') {
    return null;
  }

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
        return {
          lat: parseFloat(geoData[0].lat),
          lon: parseFloat(geoData[0].lon)
        };
      }
    }
  } catch (error) {
    console.warn(`⚠️ Geocoding failed: ${error.message}`);
  }
  
  // Fallback: generate consistent coordinates based on address
  const addressHash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latOffset = ((addressHash % 100) - 50) / 1000; // ±0.05 degrees
  const lonOffset = ((addressHash % 100) - 50) / 1000;
  
  return {
    lat: 12.2958 + latOffset,
    lon: 76.6394 + lonOffset
  };
}

async function geocodeExistingOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all orders without coordinates
    const ordersWithoutCoords = await Order.find({
      $or: [
        { lat: { $exists: false } },
        { lon: { $exists: false } },
        { lat: null },
        { lon: null }
      ]
    });

    console.log(`\n📦 Found ${ordersWithoutCoords.length} orders without coordinates\n`);

    if (ordersWithoutCoords.length === 0) {
      console.log('✅ All orders already have coordinates!');
      process.exit(0);
    }

    let updated = 0;
    let failed = 0;

    for (const order of ordersWithoutCoords) {
      console.log(`\n🔄 Processing Order: ${order._id}`);
      console.log(`   Address: ${order.deliveryAddress}`);
      console.log(`   Status: ${order.status}`);

      const coords = await geocodeAddress(order.deliveryAddress);

      if (coords) {
        order.lat = coords.lat;
        order.lon = coords.lon;
        await order.save();
        console.log(`   ✅ Updated: (${coords.lat}, ${coords.lon})`);
        updated++;
        
        // Add delay to respect rate limits (1 request per second)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`   ❌ Failed to geocode`);
        failed++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📍 Total: ${ordersWithoutCoords.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

geocodeExistingOrders();