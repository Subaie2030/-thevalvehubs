/**
 * GET  /api/admin/stats         — Dashboard stats
 * GET  /api/admin/users         — All users
 * PUT  /api/admin/verify/:id    — Verify company
 * PUT  /api/admin/emergency/:id — Assign emergency RFQ
 */
const { query } = require('./_db');
const { requireAdmin } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const admin = requireAdmin(event);
  if (admin.error) return admin.response;

  const path = event.path || '';
  const pathParts = path.split('/').filter(Boolean);
  const resource = pathParts[pathParts.length - 1];

  // ── GET /admin/stats ─────────────────────────────────────────────
  if (event.httpMethod === 'GET' && path.includes('/stats')) {
    try {
      const [
        usersRes, suppliersRes, rfqsRes, emergencyRes, projectsRes
      ] = await Promise.all([
        query('SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL \'30 days\''),
        query('SELECT COUNT(*) FROM companies WHERE type = \'supplier\''),
        query('SELECT COUNT(*) FROM rfqs WHERE status = \'open\''),
        query('SELECT COUNT(*) FROM emergency_rfqs WHERE status = \'new\''),
        query('SELECT COUNT(*) FROM projects WHERE is_published = TRUE'),
      ]);

      return ok({
        newUsers30d:     parseInt(usersRes.rows[0].count),
        totalSuppliers:  parseInt(suppliersRes.rows[0].count),
        openRfqs:        parseInt(rfqsRes.rows[0].count),
        pendingEmergency: parseInt(emergencyRes.rows[0].count),
        publishedProjects: parseInt(projectsRes.rows[0].count),
      });
    } catch (e) {
      return err('Failed to fetch stats', 500);
    }
  }

  // ── GET /admin/users ─────────────────────────────────────────────
  if (event.httpMethod === 'GET' && path.includes('/users')) {
    try {
      const res = await query(
        `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at,
                c.name_en AS company_name, c.verified
         FROM users u
         LEFT JOIN companies c ON c.owner_user_id = u.id
         ORDER BY u.created_at DESC LIMIT 100`
      );
      return ok({ users: res.rows });
    } catch (e) {
      return err('Failed to fetch users', 500);
    }
  }

  // ── GET /admin/emergency ─────────────────────────────────────────
  if (event.httpMethod === 'GET' && path.includes('/emergency')) {
    try {
      const res = await query(
        `SELECT * FROM emergency_rfqs ORDER BY created_at DESC LIMIT 50`
      );
      return ok({ emergencies: res.rows });
    } catch (e) {
      return err('Failed to fetch emergencies', 500);
    }
  }

  // ── PUT /admin/verify/:id ────────────────────────────────────────
  if (event.httpMethod === 'PUT' && path.includes('/verify')) {
    try {
      const id = pathParts[pathParts.length - 1];
      await query(
        `UPDATE companies SET verified = TRUE, verified_at = NOW(), verified_by = $2 WHERE id = $1`,
        [id, admin.user.id]
      );
      return ok({ message: 'Company verified successfully' });
    } catch (e) {
      return err('Failed to verify company', 500);
    }
  }

  // ── PUT /admin/emergency/:id/assign ─────────────────────────────
  if (event.httpMethod === 'PUT' && path.includes('/emergency')) {
    try {
      const body = parseBody(event);
      const id = pathParts[pathParts.length - 2]; // emergency/:id/assign
      await query(
        `UPDATE emergency_rfqs SET
           status = 'assigned',
           assigned_supplier_id = $2,
           assigned_at = NOW()
         WHERE id = $1`,
        [id, body.supplierId]
      );
      return ok({ message: 'Emergency assigned to supplier' });
    } catch (e) {
      return err('Failed to assign emergency', 500);
    }
  }

  // ── GET /admin/pending-suppliers ─────────────────────────────────
  if (event.httpMethod === 'GET' && path.includes('/pending')) {
    try {
      const res = await query(
        `SELECT c.id, c.name_en, c.city, c.cr_number, c.iktva_score,
                u.email, u.full_name, u.phone,
                sp.priority_tier, sp.profile_score, sp.emergency_capable,
                c.created_at
         FROM companies c
         JOIN supplier_profiles sp ON sp.company_id = c.id
         JOIN users u ON u.id = c.owner_user_id
         WHERE c.verified = FALSE AND c.type = 'supplier'
         ORDER BY c.created_at DESC`
      );
      return ok({ pending: res.rows });
    } catch (e) {
      return err('Failed to fetch pending suppliers', 500);
    }
  }

  return err('Route not found', 404);
};
