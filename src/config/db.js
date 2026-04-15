const mongoose = require('mongoose');

/**
 * Connect to MongoDB.
 * Exits the process on failure so the issue is surfaced immediately.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[DB] MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // Recommended options for production stability
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('[DB] MongoDB disconnected.'));
  mongoose.connection.on('reconnected', () => console.log('[DB] MongoDB reconnected.'));
};

module.exports = connectDB;
