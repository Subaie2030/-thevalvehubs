/**
 * GET /api/auth/me
 * Returns current user profile from JWT
 */
const { query } = require('./_db');
const { requireAuth } = require('./_auth');
const { preflight, ok, err } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  const auth = requireAuth(event);
  if (auth.error) return auth.response;
  const { user: tokenUser } = auth;

  try {
    const res = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.whatsapp, u.role,
              u.email_verified, u.phone_verified, u.last_login, u.created_at,
              c.id AS company_id, c.name_en AS company_name, c.type AS company_type,
              c.cr_number, c.vat_number, c.iktva_score, c.city,
              c.aramco_approved, c.sabic_approved, c.verified AS company_verified,
              c.logo_url,
              sp.priority_tier, sp.emergency_capable, sp.profile_score,
              sp.profile_complete, sp.description_en
       FROM users u
       LEFT JOIN companies c ON c.owner_user_id = u.id
       LEFT JOIN supplier_profiles sp ON sp.company_id = c.id
       WHERE u.id = $1`,
      [tokenUser.id]
    );

    if (res.rows.length === 0) return err('User not found', 404);
    const u = res.rows[0];

    // Get active subscription
    const subRes = await query(
      `SELECT s.status, sp2.name AS plan_name, sp2.slug AS plan_slug,
              s.current_period_end
       FROM subscriptions s
       JOIN subscription_plans sp2 ON sp2.id = s.plan_id
       WHERE s.company_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [u.company_id || '00000000-0000-0000-0000-000000000000']
    );
    const sub = subRes.rows[0] || null;

    return ok({
      id:           u.id,
      email:        u.email,
      name:         u.full_name,
      phone:        u.phone,
      whatsapp:     u.whatsapp,
      role:         u.role,
      emailVerified: u.email_verified,
      phoneVerified: u.phone_verified,
      lastLogin:    u.last_login,
      createdAt:    u.created_at,
      company: u.company_id ? {
        id:           u.company_id,
        name:         u.company_name,
        type:         u.company_type,
        crNumber:     u.cr_number,
        vatNumber:    u.vat_number,
        iktvaScore:   u.iktva_score,
        city:         u.city,
        aramco:       u.aramco_approved,
        sabic:        u.sabic_approved,
        verified:     u.company_verified,
        logoUrl:      u.logo_url,
      } : null,
      supplier: u.priority_tier ? {
        tier:            u.priority_tier,
        emergencyCapable: u.emergency_capable,
        profileScore:    u.profile_score,
        profileComplete: u.profile_complete,
        description:     u.description_en,
      } : null,
      subscription: sub,
    });

  } catch (e) {
    console.error('auth-me error:', e.message);
    return err('Failed to fetch user profile', 500);
  }
};
