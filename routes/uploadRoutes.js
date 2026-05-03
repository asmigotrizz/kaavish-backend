const express = require('express');
const router = express.Router();
const { uploadProfile, uploadPortfolio } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/upload/profile
// @desc    Upload profile picture
// @access  Private
router.post('/profile', protect, uploadProfile.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message,
    });
  }
});

// @route   POST /api/upload/portfolio
// @desc    Upload portfolio image
// @access  Private
router.post('/portfolio', protect, uploadPortfolio.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Portfolio image uploaded successfully',
      data: {
        url: req.file.path,
        public_id: req.file.filename,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message,
    });
  }
});

module.exports = router;