const express = require('express');
const auth = require('../middleware/auth');
const InventoryItem = require('../models/InventoryItem');

const router = express.Router();

// Public: list all items
router.get('/', async (req, res) => {
	try {
		const items = await InventoryItem.find().sort({ createdAt: -1 });
		res.json(items);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Admin: create item
router.post('/', auth, async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Admin access required' });
		}
		const { name, category, pricePerKg, stock, image } = req.body;
		const item = new InventoryItem({ name, category, pricePerKg, stock, image });
		await item.save();
		res.status(201).json(item);
	} catch (err) {
		res.status(400).json({ message: 'Invalid inventory item', error: err.message });
	}
});

// Admin: update item
router.put('/:id', auth, async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Admin access required' });
		}
		const { id } = req.params;
		const update = req.body;
		const updated = await InventoryItem.findByIdAndUpdate(id, update, { new: true });
		if (!updated) return res.status(404).json({ message: 'Item not found' });
		res.json(updated);
	} catch (err) {
		res.status(400).json({ message: 'Update failed', error: err.message });
	}
});

// Admin: delete item
router.delete('/:id', auth, async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Admin access required' });
		}
		const { id } = req.params;
		const deleted = await InventoryItem.findByIdAndDelete(id);
		if (!deleted) return res.status(404).json({ message: 'Item not found' });
		res.json({ message: 'Deleted', id });
	} catch (err) {
		res.status(400).json({ message: 'Delete failed', error: err.message });
	}
});

module.exports = router;



