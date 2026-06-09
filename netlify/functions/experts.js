/**
 * GET  /api/experts      — List valve experts & technicians
 * POST /api/experts      — Register as expert
 */
const { query } = require('./_db');
const { getRequestUser, requireAuth } = require('./_auth');
const { preflight, ok, err, parseBody, queryParams } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  // ── GET — List experts ────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const { specialization, city, available, aramco, search, page = 1, limit = 20 } = queryParams(event);
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions = ['e.verified = TRUE'];
      const params = [];
      let idx = 1;

      if (available === 'true') { conditions.push('e.available = TRUE'); }
      if (aramco === 'true')    { conditions.push('e.aramco_badge = TRUE'); }
      if (city)                 { conditions.push(`e.location_city ILIKE $${idx++}`); params.push(`%${city}%`); }
      if (specialization)       { conditions.push(`$${idx++} = ANY(e.specializations)`); params.push(specialization); }
      if (search) {
        conditions.push(`(u.full_name ILIKE $${idx++} OR e.bio_en ILIKE $${idx-1} OR e.title ILIKE $${idx-1})`);
        params.push(`%${search}%`);
      }

      const where = 'WHERE ' + conditions.join(' AND ');
      const sql = `
        SELECT e.id, u.full_name AS name, e.title, e.specializations,
               e.years_experience, e.certifications, e.aramco_badge, e.sabic_badge,
               e.available, e.day_rate_sar, e.location_city,
               e.bio_en, e.views_count, u.created_at
        FROM expert_profiles e
        JOIN users u ON u.id = e.user_id
        ${where}
        ORDER BY e.aramco_badge DESC, e.years_experience DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(parseInt(limit), offset);

      const res = await query(sql, params);
      return ok({ experts: res.rows, total: res.rows.length, page: parseInt(page) });
    } catch (e) {
      console.error('experts GET error:', e.message);
      return err('Failed to fetch experts', 500);
    }
  }

  // ── POST — Register as expert ─────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const body = parseBody(event);
      const {
        title, specializations = [], yearsExperience,
        certifications = [], aramcoBadge = false, sabicBadge = false,
        available = true, dayRateSar, locationCity,
        cvUrl, linkedinUrl, bioEn, bioAr,
        // If not logged in — also accept user details
        email, password, fullName, phone,
      } = body;

      if (!title || !specializations.length || !yearsExperience) {
        return err('title, specializations, and yearsExperience are required');
      }

      let userId = getRequestUser(event)?.id;

      // Auto-register user if email+password provided and not logged in
      if (!userId && email && password && fullName) {
        const bcrypt = require('bcryptjs');
        const { signToken } = require('./_auth');

        const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
          return err('An account with this email already exists. Please log in first.', 409);
        }
        const hash = await bcrypt.hash(password, 12);
        const newUser = await query(
          `INSERT INTO users (email, full_name, phone, role, password_hash, created_at, updated_at)
           VALUES ($1, $2, $3, 'expert', $4, NOW(), NOW()) RETURNING id`,
          [email.toLowerCase(), fullName, phone || null, hash]
        );
        userId = newUser.rows[0].id;
      }

      if (!userId) return err('Authentication required or provide email/password/fullName', 401);

      // Check existing profile
      const existing = await query('SELECT id FROM expert_profiles WHERE user_id = $1', [userId]);
      if (existing.rows.length > 0) {
        // Update
        await query(
          `UPDATE expert_profiles SET
            title = $2, specializations = $3, years_experience = $4,
            certifications = $5, aramco_badge = $6, sabic_badge = $7,
            available = $8, day_rate_sar = $9, location_city = $10,
            cv_url = $11, linkedin_url = $12, bio_en = $13, bio_ar = $14,
            updated_at = NOW()
          WHERE user_id = $1`,
          [userId, title, specializations, yearsExperience, certifications,
           aramcoBadge, sabicBadge, available, dayRateSar || null,
           locationCity, cvUrl, linkedinUrl, bioEn, bioAr]
        );
        return ok({ message: 'Expert profile updated successfully' });
      }

      // Create new
      await query(
        `INSERT INTO expert_profiles
           (user_id, title, specializations, years_experience, certifications,
            aramco_badge, sabic_badge, available, day_rate_sar, location_city,
            cv_url, linkedin_url, bio_en, bio_ar, verified, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,FALSE,NOW(),NOW())`,
        [userId, title, specializations, yearsExperience, certifications,
         aramcoBadge, sabicBadge, available, dayRateSar || null,
         locationCity, cvUrl, linkedinUrl, bioEn, bioAr]
      );

      return ok({ message: 'Expert profile submitted! Our team will verify it within 48 hours.' }, 201);
    } catch (e) {
      console.error('experts POST error:', e.message);
      return err('Failed to submit expert profile', 500);
    }
  }

  return err('Method not allowed', 405);
};
