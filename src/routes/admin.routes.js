const express = require('express');
const router = express.Router();

const Bounty = require('../models/Bounty');
const User = require('../models/User');
const { adminAuth } = require('../middleware/adminAuth');

// All admin routes require the admin key
router.use(adminAuth);

// ─────────────────────────────────────────────
// PATCH /admin/finalize/:bountyId
// Manually mark a bounty as COMPLETED and isPaid: true.
// Only admin can trigger this — represents offline payment confirmation.
// ─────────────────────────────────────────────
router.patch('/finalize/:bountyId', async (req, res, next) => {
  try {
    const { bountyId } = req.params;
    const { adminNote } = req.body;

    // Allow finalizing from CLAIMED (normal flow) or OPEN (admin override edge case)
    const bounty = await Bounty.findOneAndUpdate(
      {
        bountyId,
        status: { $in: ['OPEN', 'CLAIMED'] }, // cannot re-finalize a COMPLETED bounty
      },
      {
        $set: {
          status: 'COMPLETED',
          isPaid: true,
          completedAt: new Date(),
          ...(adminNote ? { adminNote: adminNote.trim() } : {}),
        },
      },
      { new: true }
    );

    if (!bounty) {
      const exists = await Bounty.exists({ bountyId });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Bounty not found.' });
      }
      return res.status(409).json({
        success: false,
        message: 'Bounty is already COMPLETED and cannot be finalized again.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Bounty ${bountyId} has been finalized and marked as paid.`,
      data: {
        bountyId: bounty.bountyId,
        status: bounty.status,
        isPaid: bounty.isPaid,
        completedAt: bounty.completedAt,
        claimedBy: bounty.claimedBy,
        adminNote: bounty.adminNote,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// GET /admin/bounties
// Full bounty list for admin — includes all statuses, all fields.
// Supports ?status= filter.
// ─────────────────────────────────────────────
router.get('/bounties', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) {
      if (!['OPEN', 'CLAIMED', 'COMPLETED'].includes(status.toUpperCase())) {
        return res.status(400).json({ success: false, message: 'Invalid status filter.' });
      }
      filter.status = status.toUpperCase();
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [bounties, total] = await Promise.all([
      Bounty.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Bounty.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      data: bounties, // full document including posterMobile visible to admin
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// GET /admin/users
// List all users with their tokens (admin audit view).
// ─────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      User.countDocuments(),
    ]);

    return res.status(200).json({ success: true, total, page: Number(page), data: users });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// GET /admin/bounties/:bountyId
// Fetch a single bounty with full detail (admin only).
// ─────────────────────────────────────────────
router.get('/bounties/:bountyId', async (req, res, next) => {
  try {
    const bounty = await Bounty.findOne({ bountyId: req.params.bountyId }).lean();
    if (!bounty) return res.status(404).json({ success: false, message: 'Bounty not found.' });
    return res.status(200).json({ success: true, data: bounty });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
