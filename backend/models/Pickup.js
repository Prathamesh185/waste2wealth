const mongoose = require('mongoose');

const PickupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true },
  address: { type: String, required: true },
  lat: { type: Number },
  lon: { type: Number },
  wasteType: { type: String },
  phone: { type: String },
  pickupDate: { type: String },
  pickupTime: { type: String },
  instructions: { type: String },
  status: {
    type: String,
    enum: ['pending', 'processing', 'picked', 'completed', 'rejected'],
    default: 'pending'
  },
  pointsAwarded: { type: Number, default: 0 },
  requestDate: { type: Date, default: Date.now },
  completedDate: { type: Date }
});

module.exports = mongoose.model('Pickup', PickupSchema);
