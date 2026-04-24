const mongoose = require('mongoose');

/**
 * Bounty Model
 * Lifecycle: OPEN → CLAIMED → COMPLETED
 * 'mobile' is intentionally stored for admin reference only and
 * must NEVER be returned in public-facing API responses (enforced via projection).
 */
const bountySchema = new mongoose.Schema(
  {
    bountyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Internal reference — NEVER exposed publicly
    posterMobile: {
      type: String,
      required: true,
    },

    // Public-facing identity
    posterToken: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    bountyAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Path to the uploaded assignment file (renamed to bountyId for anonymity)
    attachmentPath: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ['OPEN', 'CLAIMED', 'COMPLETED'],
      default: 'OPEN',
      index: true,
    },

    // Populated atomically when a hunter claims the bounty
    claimedBy: {
      hunterToken: { type: String, default: null },
      claimedAt: { type: Date, default: null },
    },

    // Admin-controlled fields
    isPaid: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      default: null,
    },
    hunterMobile: { 
      type: String, 
      default: null 
    },
    posterMobile: { type: String, required: true },
    hunterMobile: { type: String, default: null }, // Ensure this is here
    hunterEmail:  { type: String, default: null }, // Ensure this is here
    status: { type: String, default: 'OPEN' },
}, { timestamps: true });
  

module.exports = mongoose.model('Bounty', bountySchema);
