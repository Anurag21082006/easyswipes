const User = require('../models/User');
const { generatePosterToken, generateHunterToken } = require('../utils/tokenGenerator');

/**
 * Identity Middleware
 *
 * Reads `mobile` from req.body (or req.headers['x-mobile'] as fallback).
 * Based on the `action` param ('post' | 'hunt'), ensures the corresponding
 * token exists on the User document, generating one if absent.
 *
 * Attaches to req:
 *   req.user        — full User document
 *   req.posterToken — (if action === 'post')
 *   req.hunterToken — (if action === 'hunt')
 *
 * @param {'post'|'hunt'} action
 */
const identityMiddleware = (action) => async (req, res, next) => {
  try {
    const mobile =
      req.body?.mobile || req.headers['x-mobile'];

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required. Provide it in the request body or x-mobile header.',
      });
    }

    // Sanitise: digits only, 10–15 chars (E.164-ish, without '+')
    const sanitisedMobile = String(mobile).replace(/\D/g, '');
    if (sanitisedMobile.length < 7 || sanitisedMobile.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format.',
      });
    }

    let update = {};
    let setOnInsertFields = {};

    if (action === 'post') {
      // We'll handle posterToken generation in a findOneAndUpdate with $setOnInsert
      // but token must be unique, so we generate optimistically and retry on collision.
      const user = await upsertWithToken(sanitisedMobile, 'posterToken', generatePosterToken);
      req.user = user;
      req.posterToken = user.posterToken;
    } else if (action === 'hunt') {
      const user = await upsertWithToken(sanitisedMobile, 'hunterToken', generateHunterToken);
      req.user = user;
      req.hunterToken = user.hunterToken;
    } else {
      return res.status(500).json({ success: false, message: 'Invalid action in identity middleware.' });
    }

    next();
  } catch (err) {
    console.error('[IdentityMiddleware] Error:', err);
    next(err);
  }
};

/**
 * Upsert helper with token generation.
 * - Finds user by mobile.
 * - If the target token field is missing, generates one and saves atomically.
 * - Retries once on duplicate-key collision (extremely rare but safe).
 *
 * @param {string} mobile
 * @param {'posterToken'|'hunterToken'} tokenField
 * @param {Function} generator  — token generator function
 * @returns {Promise<UserDocument>}
 */
const upsertWithToken = async (mobile, tokenField, generator, attempt = 0) => {
  if (attempt > 3) throw new Error('Token generation failed after retries — collision unlikely but handled.');

  const newToken = generator();

  // findOneAndUpdate with $setOnInsert only sets fields when inserting (new doc).
  // For existing docs lacking the token field, we use $set conditionally.
  // Strategy: find first, then conditionally update — safe because token is only
  // written once and subsequent calls are idempotent.
  let user = await User.findOne({ mobile });

  if (!user) {
    // New user — create with token
    try {
      user = await User.create({ mobile, [tokenField]: newToken });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate mobile (race) or duplicate token — retry
        return upsertWithToken(mobile, tokenField, generator, attempt + 1);
      }
      throw err;
    }
  } else if (!user[tokenField]) {
    // Existing user missing this token — assign atomically
    try {
      user = await User.findOneAndUpdate(
        { mobile, [tokenField]: { $exists: false } }, // guard: only update if still missing
        { $set: { [tokenField]: newToken } },
        { new: true }
      );

      if (!user) {
        // Another request beat us to it — re-fetch
        user = await User.findOne({ mobile });
      }
    } catch (err) {
      if (err.code === 11000) {
        return upsertWithToken(mobile, tokenField, generator, attempt + 1);
      }
      throw err;
    }
  }

  return user;
};

module.exports = { identityMiddleware };
