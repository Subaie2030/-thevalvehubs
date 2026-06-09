/**
 * GET  /api/rfqs         — List RFQs (buyer sees own, supplier sees inbox)
 * GET  /api/rfqs/my      — Buyer's own RFQs
 * GET  /api/rfqs/inbox   — Supplier's incoming RFQs
 * POST /api/rfqs         — Create new RFQ
 */
const { query } = require('./_db');
const { requireAuth } = require('./_auth');
const { preflight, ok, err, parseBody, queryParams } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const auth = requireAuth(event);
  if (auth.error) return auth.response;
  const { user } = auth;

  const path = event.path || '';
  const isInbox = path.includes('/inbox');
  const isMy    = path.includes('/my');

  // ── GET — List RFQs ──────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const { status, pillar, page = 1, limit = 20 } = queryParams(event);
      const offset = (parseInt(page) - 1) * parseInt(limit);

      if (user.role === 'supplier' || isInbox) {
        // Suppliers see open RFQs matching their pillars
        const sql = `
          SELECT r.id, r.rfq_number, r.title, r.description, r.pillar,
                 r.quantity, r.delivery_location, r.delivery_date,
                 r.budget_sar, r.iktva_required, r.standards_required,
                 r.status, r.responses_count, r.created_at,
                 c.name_en AS buyer_company
          FROM rfqs r
          JOIN companies c ON c.id = r.buyer_company_id
          WHERE r.status = 'open'
          ${pillar ? "AND r.pillar = $1" : ""}
          ORDER BY r.created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
        const res = await query(sql, pillar ? [pillar] : []);
        return ok({ rfqs: res.rows, total: res.rows.length, page: parseInt(page) });

      } else {
        // Buyers see their own RFQs
        const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [user.id]);
        if (compRes.rows.length === 0) return ok({ rfqs: [], total: 0 });
        const companyId = compRes.rows[0].id;

        const conditions = ['r.buyer_company_id = $1'];
        const params = [companyId];
        let idx = 2;
        if (status) { conditions.push(`r.status = $${idx++}`); params.push(status); }

        const sql = `
          SELECT r.id, r.rfq_number, r.title, r.pillar, r.status,
                 r.responses_count, r.budget_sar, r.delivery_date, r.created_at
          FROM rfqs r
          WHERE ${conditions.join(' AND ')}
          ORDER BY r.created_at DESC
          LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(parseInt(limit), offset);
        const res = await query(sql, params);
        return ok({ rfqs: res.rows, total: res.rows.length, page: parseInt(page) });
      }
    } catch (e) {
      console.error('rfqs GET error:', e.message);
      return err('Failed to fetch RFQs', 500);
    }
  }

  // ── POST — Create RFQ ────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const {
        title, description, pillar, quantity,
        deliveryLocation, deliveryDate, budgetSar,
        iktvaRequired, standardsRequired = []
      } = parseBody(event);

      if (!title || !description || !pillar) {
        return err('title, description, and pillar are required');
      }

      // Get buyer's company
      const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [user.id]);
      let companyId = compRes.rows.length > 0 ? compRes.rows[0].id : null;

      // Generate RFQ number
      const countRes = await query('SELECT COUNT(*) FROM rfqs');
      const seq = parseInt(countRes.rows[0].count) + 1;
      const rfqNumber = `TVH-RFQ-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

      const res = await query(
        `INSERT INTO rfqs
           (rfq_number, buyer_company_id, buyer_user_id, pillar, title, description,
            quantity, delivery_location, delivery_date, budget_sar,
            iktva_required, standards_required, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         RETURNING id, rfq_number, title, pillar, status, created_at`,
        [rfqNumber, companyId, user.id, pillar, title, description,
         quantity, deliveryLocation, deliveryDate || null, budgetSar || null,
         iktvaRequired || null, standardsRequired]
      );

      return ok({ message: 'RFQ submitted successfully', rfq: res.rows[0] }, 201);
    } catch (e) {
      console.error('rfqs POST error:', e.message);
      return err('Failed to create RFQ', 500);
    }
  }

  return err('Method not allowed', 405);
};
