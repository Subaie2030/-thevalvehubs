/**
 * POST /api/rfqs/emergency   — Submit emergency RFQ (24/7)
 * GET  /api/rfqs/emergency/:id — Get emergency RFQ detail
 *
 * Emergency SLAs:
 *   critical  → 2 hours  (plant down)
 *   urgent    → 24 hours
 *   standard  → 72 hours
 */
const { query } = require('./_db');
const { getRequestUser } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  // ── POST — Submit emergency ───────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const {
        requesterCompany, plantName, plantCity,
        contactName, contactPhone, contactWhatsapp,
        pillar, description, urgency = 'urgent',
        plantDown = false, quantity, location
      } = parseBody(event);

      if (!contactName || !contactPhone || !pillar || !description) {
        return err('contactName, contactPhone, pillar, and description are required');
      }
      if (!['critical', 'urgent', 'standard'].includes(urgency)) {
        return err('urgency must be: critical, urgent, or standard');
      }

      // Auth optional — allow anonymous emergency submissions
      const tokenUser = getRequestUser(event);

      // Calculate deadline based on urgency
      const now = new Date();
      const hoursMap = { critical: 2, urgent: 24, standard: 72 };
      const deadline = new Date(now.getTime() + hoursMap[urgency] * 60 * 60 * 1000);

      // Generate ERQ number
      const countRes = await query('SELECT COUNT(*) FROM emergency_rfqs');
      const seq = parseInt(countRes.rows[0].count) + 1;
      const erqNumber = `TVH-ERQ-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

      const res = await query(
        `INSERT INTO emergency_rfqs
           (erq_number, requester_user_id, requester_company, plant_name, plant_city,
            contact_name, contact_phone, contact_whatsapp,
            pillar, description, urgency, plant_down,
            quantity, location, deadline, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'new', NOW())
         RETURNING id, erq_number, urgency, deadline, status, created_at`,
        [erqNumber, tokenUser?.id || null, requesterCompany,
         plantName, plantCity, contactName, contactPhone, contactWhatsapp || null,
         pillar, description, urgency, plantDown,
         quantity || null, location || null, deadline]
      );

      const erq = res.rows[0];

      // Log notification record (email/WhatsApp will be sent async)
      await query(
        `INSERT INTO notifications (user_id, type, channel, subject, body, metadata, status, created_at)
         VALUES ($1, 'emergency_submitted', 'whatsapp', $2, $3, $4, 'pending', NOW())`,
        [
          tokenUser?.id || null,
          `🚨 Emergency RFQ ${erqNumber}`,
          `New ${urgency.toUpperCase()} emergency from ${contactName} (${plantName || requesterCompany}). Pillar: ${pillar}. Response required by: ${deadline.toISOString()}`,
          JSON.stringify({ erq_id: erq.id, erq_number: erqNumber, urgency, plant_down: plantDown })
        ]
      ).catch(() => {}); // Non-blocking

      return ok({
        message: 'Emergency request received! Our team will contact you within the SLA window.',
        erq: {
          id:        erq.id,
          number:    erq.erq_number,
          urgency:   erq.urgency,
          deadline:  erq.deadline,
          status:    erq.status,
          createdAt: erq.created_at,
          slaHours:  hoursMap[urgency],
          whatsapp:  'https://wa.me/966501099901',
        }
      }, 201);

    } catch (e) {
      console.error('emergency-rfq POST error:', e.message);
      return err('Failed to submit emergency request', 500);
    }
  }

  // ── GET — fetch emergency RFQ by ID ──────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const pathParts = (event.path || '').split('/').filter(Boolean);
      const id = pathParts[pathParts.length - 1];

      if (!id || id === 'emergency') return err('Emergency ID required', 400);

      const res = await query(
        `SELECT * FROM emergency_rfqs WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return err('Emergency RFQ not found', 404);

      return ok(res.rows[0]);
    } catch (e) {
      console.error('emergency-rfq GET error:', e.message);
      return err('Failed to fetch emergency RFQ', 500);
    }
  }

  return err('Method not allowed', 405);
};
