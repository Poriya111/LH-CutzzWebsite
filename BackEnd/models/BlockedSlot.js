// models/BlockedSlot.js
const mongoose = require('mongoose');

const BlockedSlotSchema = new mongoose.Schema({
  date: { type: String, required: true }, // format: YYYY-MM-DD
  time: { type: String, required: true }  // format: HH:mm
});

// Prevent duplicate entries for the same date and time
BlockedSlotSchema.index({ date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('BlockedSlot', BlockedSlotSchema);