/**
 * POST /api/suppliers/certs — Add certification to supplier profile
 * GET  /api/suppliers/certs — List my certifications
 */
const { query } = require('./_db');
const { requireAuth } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const auth = requireAuth(event);
  if (auth.error) return auth.response;
  const { user } = auth;

  // Get supplier profile ID
  const profRes = await query(
    `SELECT sp.id FROM supplier_profiles sp
     JOIN companies c ON c.id = sp.company_id
     WHERE c.owner_user_id = $1`,
    [user.id]
  );
  if (profRes.rows.length === 0) return err('Supplier profile not found', 404);
  const profileId = profRes.rows[0].id;

  // ── GET ───────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const res = await query(
        `SELECT id, standard, issuing_body, certificate_no,
                issued_date, expiry_date, verified
         FROM supplier_certifications
         WHERE supplier_id = $1
         ORDER BY issued_date DESC NULLS LAST`,
        [profileId]
      );
      return ok({ certifications: res.rows });
    } catch (e) {
      return err('Failed to fetch certifications', 500);
    }
  }

  // ── POST ──────────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { standard, issuingBody, certificateNo, issuedDate, expiryDate } = parseBody(event);
      if (!standard) return err('standard is required (e.g. API 6D, ISO 9001)');

      const res = await query(
        `INSERT INTO supplier_certifications
           (supplier_id, standard, issuing_body, certificate_no, issued_date, expiry_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, standard, issuing_body, verified`,
        [profileId, standard, issuingBody, certificateNo, issuedDate || null, expiryDate || null]
      );

      return ok({ message: 'Certification added', cert: res.rows[0] }, 201);
    } catch (e) {
      console.error('supplier-certs POST error:', e.message);
      return err('Failed to add certification', 500);
    }
  }

  return err('Method not allowed', 405);
};
