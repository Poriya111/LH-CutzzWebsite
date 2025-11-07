// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const Appointment = require('./models/Appointment');
const BlockedSlot = require('./models/BlockedSlot');
const { Server } = require('socket.io');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI in .env');
  process.exit(1);
}

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    console.error('Missing ADMIN_USERNAME, ADMIN_PASSWORD, or JWT_SECRET in .env file');
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

// For production, FRONTEND_URL should be a comma-separated list of allowed origins.
// e.g., "https://www.lhcutzz.com,https://lhcutzz.netlify.app"
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

const io = new Server(server, { cors: corsOptions });
app.use(express.json());
app.use(cors(corsOptions));

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
    // Fetch both appointments and blocked slots for the public calendar
    const appointments = await Appointment.find({}).lean();
    const blockedSlots = await BlockedSlot.find({}).lean();

    res.json({ success: true, appointments, blockedSlots });
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

    // Check if the slot is blocked by the admin
    const isBlocked = await BlockedSlot.findOne({ date, time });
    if (isBlocked) {
      return res.status(400).json({ success: false, error: 'Tijdslot is niet beschikbaar' });
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

// --- Admin Authentication ---

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        // Credentials are correct, generate a JWT
        const token = jwt.sign(
            { user: 'admin' }, // Payload
            process.env.JWT_SECRET, // Secret
            { expiresIn: '8h' } // Token expires in 8 hours
        );
        res.json({ success: true, token });
    } else {
        // Incorrect credentials
        res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
});

// Middleware to protect admin routes
const protectAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ success: false, error: 'Forbidden: Invalid token' });
            }
            // If token is valid, proceed
            req.user = decoded;
            next();
        });
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }
};

// Protected route to get all appointments
app.get('/api/admin/appointments', protectAdmin, async (req, res) => {
    try {
        const appointments = await Appointment.find({}).sort({ date: 1, time: 1 }).lean();
        res.json({ success: true, appointments });
    } catch (err) {
        console.error('GET /api/admin/appointments error', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Protected route to delete an appointment
app.delete('/api/admin/appointments/:id', protectAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await Appointment.findByIdAndDelete(id);
        res.json({ success: true, message: 'Appointment deleted successfully' });
    } catch (err) {
        console.error(`DELETE /api/admin/appointments/${req.params.id} error`, err);
        res.status(500).json({ success: false, error: 'Server error while deleting' });
    }
});

// Protected route to get all data for the admin calendar
app.get('/api/admin/slots', protectAdmin, async (req, res) => {
    try {
        const appointments = await Appointment.find({}).lean();
        const blockedSlots = await BlockedSlot.find({}).lean();
        res.json({ success: true, appointments, blockedSlots });
    } catch (err) {
        console.error('GET /api/admin/slots error', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Protected route to block a time slot
app.post('/api/admin/block-slot', protectAdmin, async (req, res) => {
    try {
        const { date, time } = req.body;
        if (!date || !time) {
            return res.status(400).json({ success: false, error: 'Date and time are required' });
        }

        // Ensure it's not already booked
        const existingAppointment = await Appointment.findOne({ date, time });
        if (existingAppointment) {
            return res.status(400).json({ success: false, error: 'Slot is already booked by a customer' });
        }

        const blockedSlot = new BlockedSlot({ date, time });
        await blockedSlot.save();

        io.emit('slot_updated'); // Notify all clients
        res.json({ success: true, blockedSlot });
    } catch (err) {
        if (err.code === 11000) { // Duplicate key error
            return res.status(400).json({ success: false, error: 'Slot is already blocked' });
        }
        console.error('POST /api/admin/block-slot error', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Protected route to unblock a time slot
app.post('/api/admin/unblock-slot', protectAdmin, async (req, res) => {
    try {
        const { date, time } = req.body;
        await BlockedSlot.deleteOne({ date, time });
        io.emit('slot_updated'); // Notify all clients
        res.json({ success: true, message: 'Slot unblocked successfully' });
    } catch (err) {
        console.error('POST /api/admin/unblock-slot error', err);
        res.status(500).json({ success: false, error: 'Server error' });
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
    await BlockedSlot.deleteMany({}); // Also clear blocked slots
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
    const isoMonday = formatDateISO(monday);
    const isoSunday = formatDateISO(sunday);

    // delete any appointment not in current week
    const before = await Appointment.deleteMany({
      $or: [
        { date: { $lt: isoMonday } },
        { date: { $gt: isoSunday } }
      ]
    });
    // delete any blocked slots not in current week
    const beforeBlocked = await BlockedSlot.deleteMany({
      $or: [
        { date: { $lt: isoMonday } },
        { date: { $gt: isoSunday } }
      ]
    });
    // no need to broadcast here; fresh clients will fetch current list
    if (before.deletedCount) {
      console.log('Removed appointments outside current week:', before.deletedCount);
    }
    if (beforeBlocked.deletedCount) {
      console.log('Removed blocked slots outside current week:', beforeBlocked.deletedCount);
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
