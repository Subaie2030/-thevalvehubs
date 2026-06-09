/**
 * GET /api/rfqs/:id — Get single RFQ detail
 */
const { query } = require('./_db');
const { getRequestUser } = require('./_auth');
const { preflight, ok, err } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  const tokenUser = getRequestUser(event);
  const pathParts = (event.path || '').split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1];
  if (!id) return err('RFQ ID required', 400);

  try {
    const res = await query(
      `SELECT r.*, c.name_en AS buyer_company,
              COALESCE(
                json_agg(jsonb_build_object(
                  'id', rr.id, 'price_sar', rr.price_sar,
                  'lead_time_days', rr.lead_time_days,
                  'iktva_score', rr.iktva_score,
                  'notes', rr.notes, 'status', rr.status,
                  'submitted_at', rr.submitted_at,
                  'supplier_name', sc.name_en
                )) FILTER (WHERE rr.id IS NOT NULL), '[]'
              ) AS responses
       FROM rfqs r
       JOIN companies c ON c.id = r.buyer_company_id
       LEFT JOIN rfq_responses rr ON rr.rfq_id = r.id
       LEFT JOIN companies sc ON sc.id = rr.supplier_company_id
       WHERE r.id = $1
       GROUP BY r.id, c.name_en`,
      [id]
    );

    if (res.rows.length === 0) return err('RFQ not found', 404);

    const rfq = res.rows[0];

    // Hide responses from non-owners unless they're the buyer
    if (!tokenUser) {
      rfq.responses = [];
    }

    return ok(rfq);
  } catch (e) {
    console.error('rfq-get error:', e.message);
    return err('Failed to fetch RFQ', 500);
  }
};
