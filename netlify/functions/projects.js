/**
 * GET  /api/projects      — List Saudi tender projects
 * POST /api/projects      — Add new project (admin only)
 * GET  /api/projects/:id  — Get single project
 */
const { query } = require('./_db');
const { requireAuth, requireAdmin, getRequestUser } = require('./_auth');
const { preflight, ok, err, parseBody, queryParams } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const path = event.path || '';
  const pathParts = path.split('/').filter(Boolean);
  const projectId = pathParts[pathParts.length - 1];
  const isDetail = projectId && projectId !== 'projects' && !projectId.match(/^\d+$/);

  // ── GET ──────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      // Single project
      if (isDetail) {
        const res = await query(
          `SELECT * FROM projects WHERE id = $1 AND is_published = TRUE`,
          [projectId]
        );
        if (res.rows.length === 0) return err('Project not found', 404);

        // Increment view count
        query(`UPDATE projects SET views_count = COALESCE(views_count,0) + 1 WHERE id = $1`, [projectId]).catch(() => {});
        return ok(res.rows[0]);
      }

      // List projects
      const { sector, status, client, search, page = 1, limit = 50 } = queryParams(event);
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions = ['is_published = TRUE'];
      const params = [];
      let idx = 1;

      if (sector) { conditions.push(`sector = $${idx++}`); params.push(sector); }
      if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
      if (client) { conditions.push(`client ILIKE $${idx++}`); params.push(`%${client}%`); }
      if (search) {
        conditions.push(`(title ILIKE $${idx++} OR client ILIKE $${idx-1} OR $${idx-1} = ANY(tags))`);
        params.push(`%${search}%`);
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const sql = `
        SELECT id, reference_id, title, client, sector, location,
               estimated_value_sar, deadline, iktva_target, status,
               tags, source_name, notes, created_at
        FROM projects
        ${where}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(parseInt(limit), offset);

      const [res, countRes] = await Promise.all([
        query(sql, params),
        query(`SELECT COUNT(*) FROM projects ${where}`, params.slice(0, -2)),
      ]);

      // Stats summary
      const statsRes = await query(
        `SELECT sector, COUNT(*) AS count, SUM(estimated_value_sar) AS total_value
         FROM projects WHERE is_published = TRUE
         GROUP BY sector ORDER BY total_value DESC NULLS LAST`
      );

      return ok({
        projects: res.rows,
        total:    parseInt(countRes.rows[0].count),
        page:     parseInt(page),
        stats:    statsRes.rows,
      });

    } catch (e) {
      console.error('projects GET error:', e.message);
      return err('Failed to fetch projects', 500);
    }
  }

  // ── POST — admin only ─────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const admin = requireAdmin(event);
    if (admin.error) return admin.response;

    try {
      const {
        referenceId, title, client, sector, location,
        estimatedValueSar, deadline, iktvaTarget, status = 'Open',
        tags = [], sourceName, sourceUrl, notes
      } = parseBody(event);

      if (!title || !client || !sector) {
        return err('title, client, and sector are required');
      }

      const res = await query(
        `INSERT INTO projects
           (reference_id, title, client, sector, location, estimated_value_sar,
            deadline, iktva_target, status, tags, source_name, source_url,
            notes, added_by, is_published, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE,NOW(),NOW())
         RETURNING *`,
        [referenceId, title, client, sector, location, estimatedValueSar || null,
         deadline, iktvaTarget || null, status, tags, sourceName, sourceUrl, notes, admin.user.id]
      );

      return ok({ message: 'Project added', project: res.rows[0] }, 201);
    } catch (e) {
      console.error('projects POST error:', e.message);
      return err('Failed to add project', 500);
    }
  }

  return err('Method not allowed', 405);
};
