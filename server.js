// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const Appointment = require('./models/Appointment');
const { Server } = require('socket.io');
const cron = require('node-cron');

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// middlewares
app.use(express.json());
app.use(cors());

// helper functions
function getWeekRange(referenceDate = new Date()) {
  // Return { monday: Date, sunday: Date } for the week containing referenceDate
  // Week starts Monday.
  const d = new Date(referenceDate);
  d.setHours(0,0,0,0);
  const day = d.getDay(); // 0=Sunday .. 6=Saturday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  return { monday, sunday };
}

function isDateStringInCurrentWeek(dateString) {
  // dateString format: YYYY-MM-DD
  const d = new Date(dateString + 'T00:00:00');
  const { monday, sunday } = getWeekRange(new Date());
  return d >= monday && d <= sunday;
}

function isDateTimeInPast(dateString, endTimeString) {
  // endTimeString format: HH:mm
  const dt = new Date(`${dateString}T${endTimeString}:00`);
  return dt.getTime() < Date.now();
}

// API endpoints
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find({}).sort({ date: 1, time: 1 }).lean();
    res.json({ success: true, appointments });
  } catch (err) {
    console.error('GET /api/appointments error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { fullName, phoneNumber, date, time, treatment, extraInfo, endTime } = req.body;
    // Basic validation
    if (!fullName || !phoneNumber || !date || !time || !treatment) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Prevent date outside current week
    if (!isDateStringInCurrentWeek(date)) {
      return res.status(400).json({ success: false, error: 'Datum valt niet in de huidige week' });
    }

    // Prevent booking past date/time
    if (isDateTimeInPast(date, endTime || time)) { // Use endTime if available, fallback to time
      return res.status(400).json({ success: false, error: 'Tijd ligt in het verleden' });
    }

    // Check for existing appointment with same date+time
    const exists = await Appointment.findOne({ date, time });
    if (exists) {
      return res.status(400).json({ success: false, error: 'Tijdslot is al bezet' });
    }

    const appointment = new Appointment({
      fullName,
      phoneNumber,
      date,
      time,
      treatment,
      extraInfo: extraInfo || ''
    });

    await appointment.save();

    // Broadcast new appointment to all connected clients
    io.emit('appointment_created', {
      _id: appointment._id,
      fullName: appointment.fullName,
      phoneNumber: appointment.phoneNumber,
      date: appointment.date,
      time: appointment.time,
      treatment: appointment.treatment,
      extraInfo: appointment.extraInfo,
      createdAt: appointment.createdAt
    });

    return res.status(201).json({ success: true, appointment });
  } catch (err) {
    console.error('POST /api/appointments error', err);
    // handle unique index error (duplicate booking race)
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Tijdslot is al bezet' });
    }
    return res.status(500).json({ success: false, error: 'Server fout' });
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('socket disconnected:', socket.id);
  });
});

// Weekly reset job: run every Monday at 00:00 server time and remove all appointments
// Cron expression: '0 0 * * 1' => minute 0, hour 0, every Monday
cron.schedule('0 0 * * 1', async () => {
  try {
    console.log('Weekly reset job running - clearing all appointments for new week');
    await Appointment.deleteMany({});
    // Inform clients to reset calendar
    io.emit('weekly_reset', { message: 'weekly_reset' });
  } catch (err) {
    console.error('Weekly reset job error:', err);
  }
}, {
  scheduled: true,
  timezone: process.env.CRON_TIMEZONE || 'Europe/Amsterdam'
});

// Safety: On server start, ensure we are in the correct week. Optionally clear old appointments that
// are outside the current week (in case server was down during Monday 00:00).
(async function cleanupOldAppointmentsOnStart() {
  try {
    const { monday, sunday } = getWeekRange(new Date());
    // delete any appointment not in current week
    const before = await Appointment.deleteMany({
      $or: [
        { date: { $lt: formatDateISO(monday) } },
        { date: { $gt: formatDateISO(sunday) } }
      ]
    });
    // no need to broadcast here; fresh clients will fetch current list
    if (before.deletedCount) {
      console.log('Removed appointments outside current week:', before.deletedCount);
    }
  } catch (err) {
    console.error('Startup cleanup error:', err);
  }
})();

function formatDateISO(d) {
  // d is Date at midnight; returns YYYY-MM-DD
  const y = d.getFullYear();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return `${y}-${m}-${day}`;
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
