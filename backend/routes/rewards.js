const express = require('express');
const auth = require('../middleware/auth');
const Reward = require('../models/Reward');

const router = express.Router();

// Public: list all rewards
router.get('/', async (req, res) => {
	try {
		const rewards = await Reward.find().sort({ createdAt: -1 });
		res.json(rewards);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Admin: create reward
router.post('/', auth, async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Admin access required' });
		}
		const { title, points, description, image } = req.body;
		const reward = new Reward({ title, points, description, image });
		await reward.save();
		res.status(201).json(reward);
	} catch (err) {
		res.status(400).json({ message: 'Invalid reward', error: err.message });
	}
});

// Admin: update reward
router.put('/:id', auth, async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Admin access required' });
		}
		const { id } = req.params;
		const update = req.body;
		const updated = await Reward.findByIdAndUpdate(id, update, { new: true });
		if (!updated) return res.status(404).json({ message: 'Reward not found' });
		res.json(updated);
	} catch (err) {
		res.status(400).json({ message: 'Update failed', error: err.message });
	}
});

// Admin: delete reward
router.delete('/:id', auth, async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Admin access required' });
		}
		const { id } = req.params;
		const deleted = await Reward.findByIdAndDelete(id);
		if (!deleted) return res.status(404).json({ message: 'Reward not found' });
		res.json({ message: 'Deleted', id });
	} catch (err) {
		res.status(400).json({ message: 'Delete failed', error: err.message });
	}
});

module.exports = router;



