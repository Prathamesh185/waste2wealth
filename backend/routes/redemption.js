const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Redemption = require('../models/Redemption');
const Reward = require('../models/Reward');
const User = require('../models/User');

// Redeem a reward
router.post('/', auth, async (req, res) => {
    try {
        const { rewardId } = req.body;

        // Get the reward details
        const reward = await Reward.findById(rewardId);
        if (!reward) {
            return res.status(404).json({ message: 'Reward not found' });
        }

        // Get user
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has enough points
        if (user.rewardPoints < reward.points) {
            return res.status(400).json({ message: 'Insufficient points' });
        }

        // Deduct points
        user.rewardPoints -= reward.points;
        await user.save();

        // Create redemption record
        const redemption = new Redemption({
            userId: user._id,
            rewardId: reward._id,
            rewardTitle: reward.title,
            pointsSpent: reward.points
        });
        await redemption.save();

        res.status(201).json({
            message: 'Reward redeemed successfully',
            redemption,
            remainingPoints: user.rewardPoints
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get user's redemption history
router.get('/my-history', auth, async (req, res) => {
    try {
        const redemptions = await Redemption.find({ userId: req.user.userId })
            .sort({ redeemedAt: -1 })
            .populate('rewardId', 'title description image');
        
        res.json(redemptions);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Admin: Get all redemptions
router.get('/all', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const redemptions = await Redemption.find()
            .sort({ redeemedAt: -1 })
            .populate('userId', 'name email')
            .populate('rewardId', 'title description');
        
        res.json(redemptions);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;