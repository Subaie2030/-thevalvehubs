/**
 * POST /api/auth/login
 * Login with email + password, returns JWT token
 */
const bcrypt = require('bcryptjs');
const { query } = require('./_db');
const { signToken } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const { email, password } = parseBody(event);

    if (!email || !password) return err('Email and password are required');

    // ── Find user ────────────────────────────────────
    const res = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.password_hash, u.is_active,
              c.id AS company_id, c.name_en AS company_name,
              c.aramco_approved, c.sabic_approved, c.iktva_score
       FROM users u
       LEFT JOIN companies c ON c.owner_user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (res.rows.length === 0) return err('Invalid email or password', 401);
    const user = res.rows[0];

    if (!user.is_active) return err('Account has been deactivated. Contact support.', 403);

    // ── Verify password ──────────────────────────────
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return err('Invalid email or password', 401);

    // ── Update last_login ────────────────────────────
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // ── Sign JWT ──────────────────────────────────────
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return ok({
      token,
      user: {
        id:         user.id,
        email:      user.email,
        name:       user.full_name,
        role:       user.role,
        companyId:  user.company_id,
        company:    user.company_name,
        aramco:     user.aramco_approved,
        sabic:      user.sabic_approved,
        iktva:      user.iktva_score,
      },
    });

  } catch (e) {
    console.error('auth-login error:', e.message);
    return err('Login failed — please try again', 500);
  }
};
