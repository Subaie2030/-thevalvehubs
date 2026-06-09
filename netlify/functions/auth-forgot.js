/**
 * POST /api/auth/forgot-password
 * Sends a password-reset email (or WhatsApp) with a reset token
 *
 * In production: plug in Nodemailer/SendGrid.
 * For now: stores reset token in notifications table.
 */
const crypto = require('crypto');
const { query } = require('./_db');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const { email } = parseBody(event);
    if (!email) return err('Email is required');

    const res = await query('SELECT id, email, full_name FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always return success to prevent email enumeration
    if (res.rows.length === 0) {
      return ok({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const user = res.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in notifications (reuse table for simplicity; a proper reset_tokens table would be better)
    await query(
      `INSERT INTO notifications (user_id, type, channel, subject, body, metadata, status, created_at)
       VALUES ($1, 'password_reset', 'email', 'Password Reset', $2, $3, 'pending', NOW())`,
      [
        user.id,
        `Reset link for ${user.email}`,
        JSON.stringify({ token, expires: expires.toISOString(), userId: user.id }),
      ]
    );

    // TODO: send actual email with Nodemailer
    // const resetUrl = `${process.env.SITE_URL}/reset-password.html?token=${token}`;
    // await sendEmail({ to: user.email, subject: 'Reset Your TheValveHubs Password', html: `...` });

    return ok({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (e) {
    console.error('auth-forgot error:', e.message);
    return err('Failed to process request', 500);
  }
};
