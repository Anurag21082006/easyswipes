const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');

const bountyRoutes = require('./routes/bounty.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// ── Security & CORS ─────────────────────────────────────────────────────────
app.use(cors());
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body Parsing (MUST BE BEFORE ROUTES) ────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static Files ────────────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', ts: new Date().toISOString() }));

// ── Routes (Cleaned up!) ────────────────────────────────────────────────────
app.use('/bounties', bountyRoutes);
app.use('/api/admin', adminRoutes); // Only declared once now!

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate entry detected.' });
  }

  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message;
  return res.status(status).json({ success: false, message });
});

module.exports = app;