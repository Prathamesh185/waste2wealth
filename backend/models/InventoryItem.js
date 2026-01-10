const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
	name: { type: String, required: true, trim: true },
	category: { type: String, required: true, trim: true, default: 'general' },
	pricePerKg: { type: Number, required: true, min: 0 },
	stock: { type: Number, required: true, min: 0 },
	image: { type: String, trim: true, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);



