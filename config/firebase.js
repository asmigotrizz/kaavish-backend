const admin = require('firebase-admin');

let messaging = null;

try {
  const serviceAccount = require('./kaavish-fe5eb-firebase-adminsdk-fbsvc-917cfd3bbe.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  messaging = admin.messaging();
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.log('⚠️ Firebase not initialized - push notifications disabled');
}

module.exports = { admin, messaging };