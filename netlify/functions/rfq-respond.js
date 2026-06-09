/**
 * POST /api/rfqs/:id/respond  — Supplier submits quote/response
 * PUT  /api/rfqs/:id/award    — Buyer awards an RFQ to a supplier
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
  const pathParts = path.split('/').filter(Boolean);
  // /api/rfqs/:id/respond  or  /api/rfqs/:id/award
  const rfqId = pathParts[pathParts.length - 2];
  const action = pathParts[pathParts.length - 1]; // 'respond' or 'award'

  if (!rfqId) return err('RFQ ID required', 400);

  // ── POST — Supplier responds to RFQ ──────────────────────────────
  if (event.httpMethod === 'POST' && action === 'respond') {
    try {
      if (user.role !== 'supplier') return err('Only suppliers can respond to RFQs', 403);

      const { priceSar, leadTimeDays, iktvaScore, notes } = parseBody(event);
      if (!priceSar) return err('priceSar is required');

      const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [user.id]);
      if (compRes.rows.length === 0) return err('Supplier company not found', 404);

      // Check RFQ is still open
      const rfqRes = await query('SELECT id, status FROM rfqs WHERE id = $1', [rfqId]);
      if (rfqRes.rows.length === 0) return err('RFQ not found', 404);
      if (rfqRes.rows[0].status !== 'open') return err('This RFQ is no longer accepting responses');

      await query(
        `INSERT INTO rfq_responses
           (rfq_id, supplier_company_id, supplier_user_id, price_sar, lead_time_days, iktva_score, notes, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [rfqId, compRes.rows[0].id, user.id, priceSar, leadTimeDays || null, iktvaScore || null, notes]
      );

      // Increment responses count
      await query('UPDATE rfqs SET responses_count = responses_count + 1, updated_at = NOW() WHERE id = $1', [rfqId]);

      return ok({ message: 'Quote submitted successfully!' }, 201);
    } catch (e) {
      console.error('rfq-respond POST error:', e.message);
      return err('Failed to submit response', 500);
    }
  }

  // ── PUT — Buyer awards RFQ ────────────────────────────────────────
  if (event.httpMethod === 'PUT' && action === 'award') {
    try {
      const { responseId } = parseBody(event);
      if (!responseId) return err('responseId is required');

      // Verify buyer owns this RFQ
      const rfqRes = await query(
        `SELECT r.id FROM rfqs r
         JOIN companies c ON c.id = r.buyer_company_id
         WHERE r.id = $1 AND c.owner_user_id = $2`,
        [rfqId, user.id]
      );
      if (rfqRes.rows.length === 0) return err('RFQ not found or access denied', 404);

      // Award the selected response, reject others
      await query(
        `UPDATE rfq_responses SET status = CASE WHEN id = $2 THEN 'awarded' ELSE 'rejected' END
         WHERE rfq_id = $1`,
        [rfqId, responseId]
      );
      await query(
        `UPDATE rfqs SET status = 'awarded', updated_at = NOW() WHERE id = $1`,
        [rfqId]
      );

      return ok({ message: 'RFQ awarded successfully!' });
    } catch (e) {
      console.error('rfq-award error:', e.message);
      return err('Failed to award RFQ', 500);
    }
  }

  return err('Method not allowed', 405);
};
