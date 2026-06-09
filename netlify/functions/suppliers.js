/**
 * GET  /api/suppliers         — List suppliers (with filters)
 * POST /api/suppliers/profile — Register/update supplier profile
 */
const { query } = require('./_db');
const { requireAuth } = require('./_auth');
const { preflight, ok, err, parseBody, queryParams } = require('./_cors');

// ── GET — List suppliers ──────────────────────────────────────────────
async function listSuppliers(event) {
  const p = queryParams(event);
  const {
    pillar, city, tier, aramco, sabic, emergency,
    search, page = 1, limit = 20
  } = p;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = ['c.is_active = TRUE', "c.type = 'supplier'"];
  const params = [];
  let idx = 1;

  if (pillar) {
    conditions.push(`EXISTS (SELECT 1 FROM supplier_pillars sp2 WHERE sp2.supplier_id = prof.id AND sp2.pillar = $${idx++})`);
    params.push(pillar);
  }
  if (city) {
    conditions.push(`c.city ILIKE $${idx++}`);
    params.push(`%${city}%`);
  }
  if (tier) {
    conditions.push(`prof.priority_tier = $${idx++}`);
    params.push(tier.toUpperCase());
  }
  if (aramco === 'true') {
    conditions.push('c.aramco_approved = TRUE');
  }
  if (sabic === 'true') {
    conditions.push('c.sabic_approved = TRUE');
  }
  if (emergency === 'true') {
    conditions.push('prof.emergency_capable = TRUE');
  }
  if (search) {
    conditions.push(`(c.name_en ILIKE $${idx++} OR prof.description_en ILIKE $${idx - 1})`);
    params.push(`%${search}%`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `
    SELECT
      c.id, c.name_en AS name, c.city, c.logo_url,
      c.aramco_approved AS aramco, c.sabic_approved AS sabic,
      c.iktva_score, c.verified,
      prof.priority_tier AS tier,
      prof.emergency_capable,
      prof.emergency_response_hr,
      prof.description_en AS description,
      prof.profile_score,
      prof.views_count,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('pillar', sp2.pillar, 'primary', sp2.is_primary))
        FILTER (WHERE sp2.id IS NOT NULL), '[]'
      ) AS pillars,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('standard', cert.standard, 'verified', cert.verified))
        FILTER (WHERE cert.id IS NOT NULL), '[]'
      ) AS certifications
    FROM companies c
    JOIN supplier_profiles prof ON prof.company_id = c.id
    LEFT JOIN supplier_pillars sp2 ON sp2.supplier_id = prof.id
    LEFT JOIN supplier_certifications cert ON cert.supplier_id = prof.id
    ${where}
    GROUP BY c.id, prof.id
    ORDER BY prof.priority_tier ASC, c.verified DESC, prof.profile_score DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  params.push(parseInt(limit), offset);

  const countSql = `
    SELECT COUNT(*) FROM companies c
    JOIN supplier_profiles prof ON prof.company_id = c.id
    ${where}
  `;

  const [res, countRes] = await Promise.all([
    query(sql, params),
    query(countSql, params.slice(0, -2)),
  ]);

  // Increment view counts in background (non-blocking)
  if (res.rows.length > 0) {
    const ids = res.rows.map(r => `'${r.id}'`).join(',');
    query(`UPDATE supplier_profiles prof SET views_count = views_count + 1
           FROM companies c WHERE prof.company_id = c.id AND c.id IN (${ids})`).catch(() => {});
  }

  return ok({
    suppliers: res.rows,
    total:     parseInt(countRes.rows[0].count),
    page:      parseInt(page),
    limit:     parseInt(limit),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  if (event.httpMethod === 'GET') {
    try {
      return await listSuppliers(event);
    } catch (e) {
      console.error('suppliers GET error:', e.message);
      return err('Failed to fetch suppliers', 500);
    }
  }

  return err('Method not allowed', 405);
};
