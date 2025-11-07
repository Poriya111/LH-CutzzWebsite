// models/Appointment.js
const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  date: { type: String, required: true }, // format: YYYY-MM-DD
  time: { type: String, required: true }, // format: HH:mm
  treatment: { type: String, required: true },
  extraInfo: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Compound unique index to prevent double booking same date+time
AppointmentSchema.index({ date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);
