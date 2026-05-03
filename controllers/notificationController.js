const { pool } = require('../config/database');
const { messaging } = require('../config/firebase');

// Save FCM token to database
const saveToken = async (req, res) => {
  try {
    const { userId, userType, fcmToken, platform } = req.body;

    if (!userId || !userType || !fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userType, fcmToken',
      });
    }

    console.log('💾 Saving FCM token for:', { userId, userType });

    // Check if token already exists
    const [existing] = await pool.query(
      'SELECT * FROM fcm_tokens WHERE user_id = ? AND user_type = ?',
      [userId, userType]
    );

    if (existing.length > 0) {
      // Update existing token
      await pool.query(
        'UPDATE fcm_tokens SET fcm_token = ?, platform = ?, updated_at = NOW() WHERE user_id = ? AND user_type = ?',
        [fcmToken, platform, userId, userType]
      );
      console.log('✅ FCM token updated');
    } else {
      // Insert new token
      await pool.query(
        'INSERT INTO fcm_tokens (user_id, user_type, fcm_token, platform) VALUES (?, ?, ?, ?)',
        [userId, userType, fcmToken, platform]
      );
      console.log('✅ FCM token inserted');
    }

    res.status(200).json({
      success: true,
      message: 'FCM token saved successfully',
    });
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving FCM token',
      error: error.message,
    });
  }
};

// Send notification to specific user
const sendNotificationToUser = async (userId, userType, notification) => {
  try {
    console.log(`📤 Attempting to send notification to user ${userId} (${userType})`);

    // Get user's FCM token
    const [tokens] = await pool.query(
      'SELECT fcm_token FROM fcm_tokens WHERE user_id = ? AND user_type = ? ORDER BY updated_at DESC LIMIT 1',
      [userId, userType]
    );

    if (tokens.length === 0) {
      console.log(`⚠️ No FCM token found for user ${userId}`);
      return false;
    }

    const token = tokens[0].fcm_token;
    console.log('📱 Found FCM token, sending notification...');

    // Prepare message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      token: token,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default_channel',
        },
      },
    };

    // Send notification
    const response = await messaging.send(message);
    console.log('✅ Notification sent successfully:', response);
    return true;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return false;
  }
};

module.exports = {
  saveToken,
  sendNotificationToUser,
};