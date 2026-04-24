const express = require('express');
const router = express.Router();
const path = require('path');
const nodemailer = require('nodemailer');

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

// ── PATCH /api/bounties/claim ─────────────────────────────────────────────
router.patch('/claim', async (req, res) => {
  try {
    const { bountyId, mobile, email } = req.body;

    // 1. Find the bounty
    const bounty = await Bounty.findOne({ bountyId });
    if (!bounty) return res.status(404).json({ message: "Bounty not found" });
    if (bounty.status === 'CLAIMED') return res.status(400).json({ message: "Already claimed" });

    // 2. Save the hunter's info
    bounty.status = 'CLAIMED';
    bounty.hunterMobile = mobile; 
    bounty.hunterEmail = email;
    bounty.claimedAt = new Date();
    await bounty.save();

    // 3. SET UP THE EMAIL TRANSPORTER
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // 4. DRAFT THE EMAIL
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email, // Send to the hunter's email
      subject: `[BountyChain] Assignment Secured: ${bounty.title}`,
      text: `Congratulations Hunter!\n\nYou have successfully claimed the bounty: "${bounty.title}".\n\nPoster's WhatsApp Number: ${bounty.posterMobile}\n\nPlease contact the poster immediately to coordinate payment and details.\n\nGood luck!`,
    };

    // 5. ATTACH THE FILE (If the poster uploaded one)
    if (bounty.attachmentPath) {
      mailOptions.attachments = [
        {
          filename: `Assignment_${bounty.bountyId}`, // You can customize this name
          path: `./uploads/${bounty.attachmentPath}` // Looks in your backend uploads folder
        }
      ];
    }

    // 6. SEND IT
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Claimed successfully and email sent!" });
  } catch (err) {
    console.error("Claim/Email Error:", err);
    res.status(500).json({ error: "Server error during claim." });
  }
});

module.exports = router;