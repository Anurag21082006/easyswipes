const mongoose = require('mongoose');

/**
 * User Model
 * One document per mobile number.
 * A single user can hold both a posterToken and a hunterToken — they are
 * not mutually exclusive, but each is generated lazily on first use.
 */
const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    posterToken: {
      type: String,
      unique: true,
      sparse: true, // allows null/undefined without unique-index collision
    },
    hunterToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
