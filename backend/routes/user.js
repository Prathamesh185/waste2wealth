const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get logged-in user info (for points)
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            rewardPoints: user.rewardPoints || 0,
            address: user.address,
            phone: user.phone
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update user points (used for redemptions)
router.put('/points', auth, async (req, res) => {
    try {
        const { pointsToDeduct } = req.body;
        
        if (!pointsToDeduct || pointsToDeduct <= 0) {
            return res.status(400).json({ message: 'Invalid points value' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Check if user has enough points
        if (user.rewardPoints < pointsToDeduct) {
            return res.status(400).json({ message: 'Insufficient points' });
        }

        // Deduct points
        user.rewardPoints -= pointsToDeduct;
        await user.save();

        res.json({
            message: 'Points updated successfully',
            rewardPoints: user.rewardPoints
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Add points (used internally when pickups are completed)
router.post('/points/add', auth, async (req, res) => {
    try {
        const { userId, pointsToAdd } = req.body;
        
        if (!pointsToAdd || pointsToAdd <= 0) {
            return res.status(400).json({ message: 'Invalid points value' });
        }

        // If userId is provided (admin adding points), use that; otherwise use authenticated user
        const targetUserId = userId || req.user.userId;
        
        const user = await User.findById(targetUserId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.rewardPoints = (user.rewardPoints || 0) + pointsToAdd;
        await user.save();

        res.json({
            message: 'Points added successfully',
            rewardPoints: user.rewardPoints
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;