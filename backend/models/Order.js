const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  compostName: {  
    type: String,
    required: true,
    default: 'Organic Compost'
  },
  quantity: {
    type: Number,
    required: true
  },
  deliveryAddress: {
    type: String,
    default: "Not provided"
  },
  lat: {
    type: Number,
    default: null
  },
  lon: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-transit', 'rejected', 'delivered'],
    default: 'pending'
  },
  pricePerKg: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

OrderSchema.virtual('orderNumber').get(function () {
  return `ORD-${this._id.toString().slice(-6).toUpperCase()}`;
});

OrderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Order', OrderSchema);