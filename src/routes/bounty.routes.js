const express = require('express');
const router = express.Router();
const path = require('path');

const Bounty = require('../models/Bounty');
const { identityMiddleware } = require('../middleware/identity');
const { handleUpload } = require('../middleware/upload');
const { generateBountyId } = require('../utils/tokenGenerator');
const { sendHunterEmail } = require('../utils/mailer');

// ─────────────────────────────────────────────
// POST /bounties
// Create a new bounty. Poster identity is resolved by middleware.
// File upload is optional; if provided it's renamed to bountyId.
// ─────────────────────────────────────────────
router.post(
  '/',
  identityMiddleware('post'),   // resolves req.posterToken
  (req, _res, next) => {
    // Pre-generate bountyId so Multer can use it for filename renaming
    req.generatedBountyId = generateBountyId();
    next();
  },
  handleUpload('assignment'),   // optional file field named 'assignment'
  async (req, res, next) => {
    try {
      const { title, description, bountyAmount } = req.body;

      if (!title || !description || bountyAmount === undefined) {
        return res.status(400).json({
          success: false,
          message: 'title, description, and bountyAmount are required.',
        });
      }

      const amount = Number(bountyAmount);
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({ success: false, message: 'bountyAmount must be a non-negative number.' });
      }

      const bounty = await Bounty.create({
        bountyId: req.generatedBountyId,
        posterMobile: req.user.mobile,       // stored internally only
        posterToken: req.posterToken,
        title: title.trim(),
        description: description.trim(),
        bountyAmount: amount,
        attachmentPath: req.file ? req.file.filename : null,
        status: 'OPEN',
      });

      return res.status(201).json({
        success: true,
        message: 'Bounty created successfully.',
        data: {
          bountyId: bounty.bountyId,
          posterToken: bounty.posterToken,
          title: bounty.title,
          bountyAmount: bounty.bountyAmount,
          status: bounty.status,
          hasAttachment: !!bounty.attachmentPath,
          createdAt: bounty.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// GET /bounties/active
// Returns OPEN bounties only.
// Strict projection: no mobile, no internal _id, no posterMobile.
// ─────────────────────────────────────────────
router.get('/active', async (req, res, next) => {
  try {
    const bounties = await Bounty.find(
      { status: 'OPEN' },
      {
        // Explicit inclusion-only projection (whitelist approach)
        bountyId: 1,
        posterToken: 1,
        title: 1,
        description: 1,
        bountyAmount: 1,
        attachmentPath: 1,
        status: 1,
        createdAt: 1,
        _id: 0,           // exclude Mongo _id
        // All other fields (posterMobile, claimedBy details with mobile, etc.) excluded implicitly
      }
    ).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: bounties.length,
      data: bounties,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// PATCH /bounties/claim
// Atomically claim an OPEN bounty & Trigger Email
// ─────────────────────────────────────────────
router.patch(
  '/claim',
  identityMiddleware('hunt'),
  async (req, res, next) => {
    try {
      const { bountyId } = req.body;

      if (!bountyId) {
        return res.status(400).json({ success: false, message: 'bountyId is required.' });
      }

      // 1. Update Database (Atomic test-and-set)
      const claimed = await Bounty.findOneAndUpdate(
        {
          bountyId,
          status: 'OPEN',
        },
        {
          $set: {
            status: 'CLAIMED',
            hunterMobile: req.body.mobile, 
            'claimedBy.hunterToken': req.hunterToken,
            'claimedBy.claimedAt': new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
          projection: {
            bountyId: 1,
            posterToken: 1,
            title: 1,
            description: 1, // Grabbed for the email body
            bountyAmount: 1,
            status: 1,
            claimedBy: 1,
            attachmentPath: 1, // Crucial: grabbed so we can attach the file!
            _id: 0,
          },
        }
      );

      // 2. If it wasn't claimed, handle the error
      if (!claimed) {
        const exists = await Bounty.exists({ bountyId });
        if (!exists) {
          return res.status(404).json({ success: false, message: 'Bounty not found.' });
        }
        return res.status(409).json({
          success: false,
          message: 'Bounty is no longer available — it may have already been claimed.',
        });
      }

      // 3. Trigger the Email Delivery System!
      // (We check if it exists, and if the user actually uploaded an assignment)
      if (req.body.email && claimed.attachmentPath) {
        try {
          await sendHunterEmail(req.body.email, claimed);
          console.log("Email sent successfully to hunter!");
        } catch (mailError) {
          console.error("Mail failed to send:", mailError);
        }
      }

      // 4. Send success response back to React
      return res.status(200).json({
        success: true,
        message: 'Bounty claimed successfully.',
        data: claimed,
      });
      
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;