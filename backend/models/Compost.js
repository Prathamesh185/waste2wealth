const mongoose = require('mongoose');

const compostSchema = new mongoose.Schema({
  available: {
    type: Number,
    required: true,
    default: 0
  },
  pricePerKg: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Compost', compostSchema);
