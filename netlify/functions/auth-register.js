/**
 * POST /api/auth/register
 * Register a new user (buyer / supplier / expert / investor)
 */
const bcrypt = require('bcryptjs');
const { query } = require('./_db');
const { signToken } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const { email, password, role, nameEn, phone, companyName } = parseBody(event);

    // ── Validation ───────────────────────────────────
    if (!email || !password || !role || !nameEn) {
      return err('email, password, role, and nameEn are required');
    }
    if (!['buyer', 'supplier', 'expert', 'investor'].includes(role)) {
      return err('Invalid role. Use: buyer, supplier, expert, or investor');
    }
    if (password.length < 8) {
      return err('Password must be at least 8 characters');
    }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) return err('Invalid email address');

    // ── Check duplicate email ────────────────────────
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return err('An account with this email already exists', 409);

    // ── Hash password ────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Create user ──────────────────────────────────
    const userRes = await query(
      `INSERT INTO users (email, full_name, phone, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, email, full_name, role, created_at`,
      [email.toLowerCase(), nameEn, phone || null, role, passwordHash]
    );
    const user = userRes.rows[0];

    // ── Create company record (for supplier/buyer/epc/investor) ──
    if (companyName && ['supplier', 'buyer', 'investor'].includes(role)) {
      const compType = role === 'investor' ? 'investor' : role;
      const compRes = await query(
        `INSERT INTO companies (owner_user_id, type, name_en, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [user.id, compType, companyName]
      );

      // ── Create supplier_profile shell for suppliers ──
      if (role === 'supplier') {
        await query(
          `INSERT INTO supplier_profiles (company_id, priority_tier, created_at, updated_at)
           VALUES ($1, 'P1', NOW(), NOW())`,
          [compRes.rows[0].id]
        );
      }
    }

    // ── Sign JWT ──────────────────────────────────────
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return ok({
      token,
      user: {
        id:    user.id,
        email: user.email,
        name:  user.full_name,
        role:  user.role,
      },
    }, 201);

  } catch (e) {
    console.error('auth-register error:', e.message);
    return err('Registration failed — please try again', 500);
  }
};
