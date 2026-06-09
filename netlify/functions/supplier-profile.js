/**
 * GET  /api/suppliers/me/profile   — Get my supplier profile
 * POST /api/suppliers/profile      — Create / update supplier profile
 */
const { query, transaction } = require('./_db');
const { requireAuth } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const auth = requireAuth(event);
  if (auth.error) return auth.response;
  const { user } = auth;

  // ── GET — fetch my profile ────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const res = await query(
        `SELECT c.id AS company_id, c.name_en, c.city, c.region, c.address,
                c.website, c.logo_url, c.cr_number, c.vat_number,
                c.iktva_score, c.aramco_approved, c.sabic_approved, c.verified,
                prof.priority_tier, prof.country_of_origin, prof.founding_year,
                prof.employee_count, prof.annual_revenue_sar,
                prof.emergency_capable, prof.emergency_response_hr,
                prof.description_en, prof.description_ar,
                prof.profile_complete, prof.profile_score,
                COALESCE(
                  json_agg(DISTINCT jsonb_build_object(
                    'pillar', sp2.pillar,
                    'primary', sp2.is_primary,
                    'categories', sp2.sub_categories
                  )) FILTER (WHERE sp2.id IS NOT NULL), '[]'
                ) AS pillars,
                COALESCE(
                  json_agg(DISTINCT jsonb_build_object(
                    'id', cert.id,
                    'standard', cert.standard,
                    'issuing_body', cert.issuing_body,
                    'expiry_date', cert.expiry_date,
                    'verified', cert.verified
                  )) FILTER (WHERE cert.id IS NOT NULL), '[]'
                ) AS certifications
         FROM companies c
         JOIN supplier_profiles prof ON prof.company_id = c.id
         LEFT JOIN supplier_pillars sp2 ON sp2.supplier_id = prof.id
         LEFT JOIN supplier_certifications cert ON cert.supplier_id = prof.id
         WHERE c.owner_user_id = $1
         GROUP BY c.id, prof.id`,
        [user.id]
      );

      if (res.rows.length === 0) return err('Supplier profile not found', 404);
      return ok(res.rows[0]);
    } catch (e) {
      console.error('supplier-profile GET error:', e.message);
      return err('Failed to fetch profile', 500);
    }
  }

  // ── POST — create/update profile ─────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const body = parseBody(event);
      const {
        companyName, city, region, address, website, crNumber, vatNumber,
        foundingYear, employeeCount, annualRevenue,
        emergencyCapable, emergencyResponseHr,
        descriptionEn, descriptionAr,
        pillars = [],
        // pillars: [{ pillar, isPrimary, categories }]
      } = body;

      // ── Find or create company ───────────────────────────────────
      let companyId;
      const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [user.id]);

      if (compRes.rows.length > 0) {
        companyId = compRes.rows[0].id;
        await query(
          `UPDATE companies SET
            name_en = COALESCE($2, name_en),
            city = COALESCE($3, city),
            region = COALESCE($4, region),
            address = COALESCE($5, address),
            website = COALESCE($6, website),
            cr_number = COALESCE($7, cr_number),
            vat_number = COALESCE($8, vat_number),
            updated_at = NOW()
          WHERE id = $1`,
          [companyId, companyName, city, region, address, website, crNumber, vatNumber]
        );
      } else {
        const newComp = await query(
          `INSERT INTO companies (owner_user_id, type, name_en, city, region, address, website, cr_number, vat_number, created_at, updated_at)
           VALUES ($1, 'supplier', $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING id`,
          [user.id, companyName || 'My Company', city, region, address, website, crNumber, vatNumber]
        );
        companyId = newComp.rows[0].id;
      }

      // ── Find or create supplier profile ─────────────────────────
      const profRes = await query('SELECT id FROM supplier_profiles WHERE company_id = $1', [companyId]);
      let profileId;

      if (profRes.rows.length > 0) {
        profileId = profRes.rows[0].id;
        await query(
          `UPDATE supplier_profiles SET
            founding_year = COALESCE($2, founding_year),
            employee_count = COALESCE($3, employee_count),
            annual_revenue_sar = COALESCE($4, annual_revenue_sar),
            emergency_capable = COALESCE($5, emergency_capable),
            emergency_response_hr = COALESCE($6, emergency_response_hr),
            description_en = COALESCE($7, description_en),
            description_ar = COALESCE($8, description_ar),
            updated_at = NOW()
          WHERE id = $1`,
          [profileId, foundingYear, employeeCount, annualRevenue,
           emergencyCapable, emergencyResponseHr, descriptionEn, descriptionAr]
        );
      } else {
        const newProf = await query(
          `INSERT INTO supplier_profiles
             (company_id, priority_tier, founding_year, employee_count, annual_revenue_sar,
              emergency_capable, emergency_response_hr, description_en, description_ar, created_at, updated_at)
           VALUES ($1, 'P1', $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING id`,
          [companyId, foundingYear, employeeCount, annualRevenue,
           emergencyCapable || false, emergencyResponseHr || null, descriptionEn, descriptionAr]
        );
        profileId = newProf.rows[0].id;
      }

      // ── Update pillars ───────────────────────────────────────────
      if (pillars.length > 0) {
        // Remove existing, re-insert
        await query('DELETE FROM supplier_pillars WHERE supplier_id = $1', [profileId]);
        for (const p of pillars) {
          await query(
            `INSERT INTO supplier_pillars (supplier_id, pillar, is_primary, sub_categories, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [profileId, p.pillar, p.isPrimary || false, p.categories || []]
          );
        }
      }

      // ── Recalculate profile score ────────────────────────────────
      const score = calculateProfileScore(body, pillars);
      await query(
        `UPDATE supplier_profiles SET profile_score = $2, profile_complete = $3, updated_at = NOW() WHERE id = $1`,
        [profileId, score, score >= 70]
      );

      return ok({ message: 'Profile saved successfully', profileScore: score }, 201);
    } catch (e) {
      console.error('supplier-profile POST error:', e.message);
      return err('Failed to save profile', 500);
    }
  }

  return err('Method not allowed', 405);
};

// ── Profile completeness score (0–100) ──────────────────────────────
function calculateProfileScore(data, pillars) {
  let score = 0;
  if (data.companyName)      score += 15;
  if (data.city)             score += 10;
  if (data.descriptionEn)    score += 15;
  if (data.crNumber)         score += 15;
  if (data.foundingYear)     score += 5;
  if (data.employeeCount)    score += 5;
  if (pillars.length > 0)    score += 20;
  if (data.website)          score += 5;
  if (data.emergencyCapable) score += 10;
  return Math.min(score, 100);
}
