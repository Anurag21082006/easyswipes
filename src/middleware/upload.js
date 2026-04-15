const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directory exists at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Dynamic storage engine.
 * The bountyId is expected on req.body.bountyId (set before this middleware runs,
 * or generated in the route and attached to req.generatedBountyId).
 *
 * File is renamed to: `<bountyId>_assignment<ext>`
 * e.g. $B3KZ9A$_assignment.pdf
 *
 * This strips all original filename metadata, preserving poster anonymity.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    const bountyId =
      req.generatedBountyId || // set by route before multer if pre-generated
      req.body?.bountyId ||    // fallback from body
      `UNKNOWN_${Date.now()}`;

    const ext = path.extname(file.originalname).toLowerCase() || '.bin';

    // Sanitise bountyId for filesystem safety (strip $ signs for filename)
    const safeName = bountyId.replace(/\$/g, '');
    const filename = `${safeName}_assignment${ext}`;

    cb(null, filename);
  },
});

/**
 * File filter — allow only common document/image types.
 * Extend as needed.
 */
const fileFilter = (_req, file, cb) => {
  const ALLOWED_MIMES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/zip',
  ];

  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Unsupported file type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

/**
 * Error-handling wrapper for multer middleware.
 * Converts multer errors to clean JSON responses.
 */
const handleUpload = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    return res.status(500).json({ success: false, message: 'File upload failed.' });
  });
};

module.exports = { handleUpload, UPLOAD_DIR };
