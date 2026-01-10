const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const Compost = require('../models/Compost');

// Compost stock APIs — stored in database using Compost model (not in-memory)

// Get compost stock
router.get('/stock', async (req, res) => {
  try {
    let compost = await Compost.findOne();
    // If no record exists yet, initialize with defaults
    if (!compost) {
      compost = new Compost({ available: 0, pricePerKg: 0 });
      await compost.save();
    }

    res.json(compost);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update compost stock (Admin only)
router.put('/stock', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { available, pricePerKg } = req.body;

    let compost = await Compost.findOne();
    if (!compost) compost = new Compost();

    if (available !== undefined) compost.available = available;
    if (pricePerKg !== undefined) compost.pricePerKg = pricePerKg;

    await compost.save();

    res.json({
      message: 'Compost stock updated successfully',
      stock: compost
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
