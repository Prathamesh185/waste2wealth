
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Install: npm install @google/generative-ai@latest
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini (add GEMINI_API_KEY to your .env file)
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Simple fallback optimization using nearest-neighbor algorithm
 * Used when Gemini API fails or is unavailable
 */
function fallbackOptimization(locations) {
  if (!locations || locations.length <= 2) return locations;

  const unvisited = [...locations];
  const route = [unvisited.shift()]; // Start with first location

  while (unvisited.length > 0) {
    const current = route[route.length - 1];
    let nearestIdx = 0;
    let minDist = Infinity;

    // Find nearest unvisited location
    unvisited.forEach((loc, idx) => {
      const dist = Math.sqrt(
        Math.pow(loc.lat - current.lat, 2) +
        Math.pow(loc.lon - current.lon, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });

    route.push(unvisited.splice(nearestIdx, 1)[0]);
  }

  return route;
}

router.post('/optimize-route', auth, async (req, res) => {
  try {
    // Only admin can optimize routes
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { locations } = req.body;

    // Validate input
    if (!locations || !Array.isArray(locations) || locations.length < 2) {
      return res.status(400).json({
        message: 'Please provide at least 2 locations with lat/lon coordinates'
      });
    }

    // Validate each location has required fields
    for (const loc of locations) {
      if (!loc.lat || !loc.lon || !loc.name) {
        return res.status(400).json({
          message: 'Each location must have name, lat, and lon'
        });
      }
    }

    let optimizedOrder;
    let method = 'gemini';

    // Try Gemini optimization first
    try {
      if (!process.env.GEMINI_API_KEY || !genAI) {
        throw new Error('Gemini API key not configured');
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1, // Lower temperature for consistent routing
          maxOutputTokens: 1024
        }
      });

      // Prepare location data for Gemini
      const locationData = locations.map((loc, idx) => ({
        index: idx,
        id: loc.id || loc._id,
        name: loc.name,
        lat: loc.lat,
        lon: loc.lon,
        address: loc.address || ''
      }));

      // Craft optimization prompt for Gemini
      const prompt = `
You are a route optimization expert. 
Return STRICT JSON ONLY. Do NOT include any text outside JSON.

LOCATIONS:
${locationData.map((loc, i) => `${i}. ${loc.name} (${loc.lat}, ${loc.lon})`).join('\n')}

TASK:
1. Compute shortest route starting from index 0.
2. Visit all locations exactly once.
3. Output strictly valid JSON.

OUTPUT:
{
  "optimizedOrder": [0, 2, 1],
  "reasoning": "Explain steps in simple sentences separated by \\n. No bullets, no emojis, no unicode. Escape all quotes."
}
`;


      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse Gemini response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse Gemini response');
      }

      const geminiResult = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (!geminiResult.optimizedOrder || !Array.isArray(geminiResult.optimizedOrder)) {
        throw new Error('Invalid Gemini response format');
      }

      // Map indices back to full location objects with ALL properties preserved
      optimizedOrder = geminiResult.optimizedOrder.map(idx => {
        const original = locations[idx];
        const dataItem = locationData[idx];
        return {
          ...original,           // Keep ALL original properties
          ...dataItem,           // Overlay with formatted data
          quantity: original.quantity || dataItem.quantity || 0,
          wasteType: original.wasteType,
          phone: original.phone,
          pickupDate: original.pickupDate,
          pickupTime: original.pickupTime
        };
      });

      console.log('✅ Gemini optimization successful');
      console.log('Reasoning:', geminiResult.reasoning);

    } catch (geminiError) {
      // Fallback to simple nearest-neighbor algorithm
      console.warn('⚠️ Gemini optimization failed, using fallback:', geminiError.message);
      method = 'fallback';
      optimizedOrder = fallbackOptimization(locations);
    }

    // Calculate simple metrics
    const calculateDistance = (loc1, loc2) => {
      // Haversine formula for lat/lon distance (km)
      const R = 6371; // Earth radius in km
      const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
      const dLon = (loc2.lon - loc1.lon) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let totalDistance = 0;
    for (let i = 0; i < optimizedOrder.length - 1; i++) {
      totalDistance += calculateDistance(optimizedOrder[i], optimizedOrder[i + 1]);
    }

    // Estimate time (assume 30 km/h average speed + 5 min per stop)
    const travelTime = (totalDistance / 30) * 60; // minutes
    const stopTime = optimizedOrder.length * 5; // 5 min per stop
    const totalTime = Math.round(travelTime + stopTime);

    res.json({
      success: true,
      method, // 'gemini' or 'fallback'
      optimizedOrder: optimizedOrder.map((loc, idx) => ({
        ...loc,
        stopNumber: idx + 1
      })),
      metrics: {
        totalStops: optimizedOrder.length,
        totalDistance: Math.round(totalDistance * 100) / 100, // km, 2 decimals
        estimatedTime: totalTime, // minutes
        timeSaved: Math.round(optimizedOrder.length * 2) // rough estimate
      }
    });

  } catch (error) {
    console.error('❌ Route optimization error:', error);
    res.status(500).json({
      message: 'Route optimization failed',
      error: error.message
    });
  }
});

/**
 * Helper endpoint to geocode addresses (optional)
 * Uses free Nominatim (OpenStreetMap) service
 */
router.post('/geocode', auth, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    // Use Nominatim for free geocoding
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}, Belagavi, Karnataka, India&limit=1`;

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Waste2Wealth-App' }
    });

    const data = await response.json();

    if (data && data.length > 0) {
      res.json({
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      });
    } else {
      res.status(404).json({ message: 'Address not found' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ message: 'Geocoding failed', error: error.message });
  }
});

module.exports = router;