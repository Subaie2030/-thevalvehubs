/**
 * GET    /api/subscriptions/current  — Get active subscription
 * POST   /api/subscriptions          — Create subscription
 * DELETE /api/subscriptions/:id      — Cancel subscription
 * GET    /api/invoices               — Get invoices
 */
const { query } = require('./_db');
const { requireAuth } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const auth = requireAuth(event);
  if (auth.error) return auth.response;
  const { user } = auth;

  const path = event.path || '';

  // ── GET /invoices ────────────────────────────────────────────────
  if (event.httpMethod === 'GET' && path.includes('/invoices')) {
    try {
      const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [user.id]);
      if (compRes.rows.length === 0) return ok({ invoices: [] });
      const cid = compRes.rows[0].id;

      const res = await query(
        `SELECT id, invoice_number, issue_date, due_date,
                subtotal_sar, vat_amount_sar, total_sar, status, pdf_url, created_at
         FROM invoices
         WHERE company_id = $1
         ORDER BY created_at DESC LIMIT 24`,
        [cid]
      );
      return ok({ invoices: res.rows });
    } catch (e) {
      return err('Failed to fetch invoices', 500);
    }
  }

  // ── GET /current ─────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [user.id]);
      if (compRes.rows.length === 0) return ok({ subscription: null, plan: null });
      const cid = compRes.rows[0].id;

      const res = await query(
        `SELECT s.id, s.status, s.started_at, s.current_period_start, s.current_period_end,
                sp.name AS plan_name, sp.slug AS plan_slug,
                sp.price_sar, sp.features, sp.emergency_access, sp.analytics_access
         FROM subscriptions s
         JOIN subscription_plans sp ON sp.id = s.plan_id
         WHERE s.company_id = $1 AND s.status IN ('active','trialing')
         ORDER BY s.created_at DESC LIMIT 1`,
        [cid]
      );

      if (res.rows.length === 0) return ok({ subscription: null, plan: 'free' });
      return ok({ subscription: res.rows[0] });
    } catch (e) {
      return err('Failed to fetch subscription', 500);
    }
  }

  // ── POST — create subscription ───────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { planSlug, paymentMethod } = parseBody(event);
      if (!planSlug) return err('planSlug is required');

      const planRes = await query('SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = TRUE', [planSlug]);
      if (planRes.rows.length === 0) return err('Plan not found', 404);
      const plan = planRes.rows[0];

      const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [user.id]);
      if (compRes.rows.length === 0) return err('Company profile not found', 404);
      const cid = compRes.rows[0].id;

      // For paid plans — Moyasar integration would go here
      // For now, create the subscription record
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const res = await query(
        `INSERT INTO subscriptions
           (company_id, plan_id, status, started_at, current_period_start, current_period_end, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW(), $4, NOW(), NOW())
         RETURNING id, status`,
        [cid, plan.id, plan.price_sar === 0 ? 'active' : 'pending', periodEnd]
      );

      const msg = plan.price_sar === 0
        ? 'Free plan activated!'
        : `Subscription created. Complete payment to activate. Contact us at wa.me/966501099901 to proceed.`;

      return ok({ message: msg, subscription: res.rows[0] }, 201);
    } catch (e) {
      console.error('subscriptions POST error:', e.message);
      return err('Failed to create subscription', 500);
    }
  }

  // ── DELETE — cancel ───────────────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    try {
      const pathParts = path.split('/').filter(Boolean);
      const subId = pathParts[pathParts.length - 1];
      if (!subId) return err('Subscription ID required', 400);

      await query(
        `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND company_id IN (SELECT id FROM companies WHERE owner_user_id = $2)`,
        [subId, user.id]
      );
      return ok({ message: 'Subscription cancelled. Access continues until period end.' });
    } catch (e) {
      return err('Failed to cancel subscription', 500);
    }
  }

  return err('Method not allowed', 405);
};
