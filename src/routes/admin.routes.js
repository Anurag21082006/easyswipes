const express = require('express');
const router  = express.Router();
const Bounty  = require('../models/Bounty');

// ── Simple shared-secret middleware ────────────────────────────────────────
const adminGuard = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
};

// ── GET /api/admin/bounties ────────────────────────────────────────────────
// Returns ALL bounties including posterMobile and hunterMobile (admin only)
router.get('/bounties', adminGuard, async (req, res) => {
  try {
    const bounties = await Bounty
      .find({})
      .select('bountyId title description bountyAmount status posterMobile hunterMobile createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const total     = bounties.length;
    const open      = bounties.filter(b => b.status === 'OPEN').length;
    const claimed   = bounties.filter(b => b.status === 'CLAIMED').length;

    return res.status(200).json({
      meta: { total, open, claimed },
      bounties
    });
  } catch (err) {
    console.error('[admin/GET bounties]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── DELETE /api/admin/bounties/:bountyId ───────────────────────────────────
// Hard-deletes a bounty by its token (e.g. B00042)
router.delete('/bounties/:bountyId', adminGuard, async (req, res) => {
  try {
    const { bountyId } = req.params;

    const deleted = await Bounty.findOneAndDelete({ bountyId });
    if (!deleted) {
      return res.status(404).json({ error: 'Bounty not found.' });
    }

    return res.status(200).json({
      message:  `Bounty ${bountyId} deleted.`,
      bountyId: deleted.bountyId
    });
  } catch (err) {
    console.error('[admin/DELETE bounty]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;