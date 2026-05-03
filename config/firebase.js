const admin = require('firebase-admin');
const path = require('path');

try {
  // Load service account key
  const serviceAccount = require('./kaavish-fe5eb-firebase-adminsdk-fbsvc-917cfd3bbe.json');

  // Initialize Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  process.exit(1);
}

// Export messaging instance
const messaging = admin.messaging();

module.exports = { admin, messaging };