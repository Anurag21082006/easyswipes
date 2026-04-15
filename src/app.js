const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');

const bountyRoutes = require('./routes/bounty.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(cors()); // Put this right below const app = express();

// ── Security & Logging ──────────────────────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body Parsing ────────────────────────────────────────────────────────────
// NOTE: multer handles multipart/form-data in upload routes.
// These parsers handle JSON and URL-encoded bodies for non-upload routes.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', ts: new Date().toISOString() }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/bounties', bountyRoutes);
app.use('/admin', adminRoutes);

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err);

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate entry detected.' });
  }

  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message;
  return res.status(status).json({ success: false, message });
});

module.exports = app;
