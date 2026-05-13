const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const Brevo = require('@getbrevo/brevo');

// Brevo API client
const brevoClient = new Brevo.TransactionalEmailsApi();
brevoClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

// Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000);

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      [resetToken, resetExpires, email]
    );

    const resetURL = `kaavish://reset-password/${resetToken}`;

    // Send via Brevo HTTP API (not SMTP)
    await brevoClient.sendTransacEmail({
      sender: { email: 'ab375c001@smtp-brevo.com', name: 'Kaavish' },
      to: [{ email }],
      subject: 'Kaavish - Password Reset Request',
      htmlContent: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password for your Kaavish account.</p>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetURL}" style="background:#FF6B35;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Reset Password
        </a>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });

    res.json({ success: true, message: 'Password reset email sent!' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE reset_token = ?',
      [hashedPassword, token]
    );

    res.json({ success: true, message: 'Password reset successfully!' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

module.exports = { forgotPassword, resetPassword };