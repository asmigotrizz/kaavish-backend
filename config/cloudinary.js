const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dbliz1pca',    // Replace with your cloud name
  api_key: '156447135977882',           // Replace with your API key
  api_secret: 'J2I0QzQUTgJyo9v-kYTctKWqWsM',     // Replace with your API secret
});

// Configure storage for profile pictures
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'worker-app/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  },
});

// Configure storage for portfolio images
const portfolioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'worker-app/portfolio',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  },
});

// Create multer instances
const uploadProfile = multer({ storage: profileStorage });
const uploadPortfolio = multer({ storage: portfolioStorage });

module.exports = {
  cloudinary,
  uploadProfile,
  uploadPortfolio,
};