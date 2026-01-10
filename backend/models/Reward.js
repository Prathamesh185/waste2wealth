const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
	title: { type: String, required: true, trim: true },
	points: { type: Number, required: true, min: 0 },
	description: { type: String, trim: true, default: '' },
	image: { type: String, trim: true, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema);



