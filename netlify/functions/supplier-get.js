/**
 * GET /api/suppliers/:id — Get single supplier profile (public)
 */
const { query } = require('./_db');
const { preflight, ok, err } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  const pathParts = (event.path || '').split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1];
  if (!id) return err('Supplier ID required', 400);

  try {
    const res = await query(
      `SELECT
        c.id, c.name_en AS name, c.city, c.region, c.website,
        c.logo_url, c.aramco_approved AS aramco, c.sabic_approved AS sabic,
        c.iktva_score, c.verified, c.founded_year,
        prof.priority_tier AS tier, prof.emergency_capable,
        prof.emergency_response_hr, prof.description_en AS description,
        prof.employee_count, prof.annual_revenue_sar, prof.founding_year,
        prof.profile_score, prof.views_count, prof.rfq_count,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'pillar', sp.pillar, 'primary', sp.is_primary,
            'categories', sp.sub_categories
          )) FILTER (WHERE sp.id IS NOT NULL), '[]'
        ) AS pillars,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'standard', cert.standard, 'body', cert.issuing_body,
            'expiry', cert.expiry_date, 'verified', cert.verified
          )) FILTER (WHERE cert.id IS NOT NULL), '[]'
        ) AS certifications,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', prod.id, 'name', prod.name_en, 'pillar', prod.pillar,
            'specs', prod.specs, 'inStock', prod.in_stock
          )) FILTER (WHERE prod.id IS NOT NULL AND prod.is_active = TRUE), '[]'
        ) AS products
      FROM companies c
      JOIN supplier_profiles prof ON prof.company_id = c.id
      LEFT JOIN supplier_pillars sp ON sp.supplier_id = prof.id
      LEFT JOIN supplier_certifications cert ON cert.supplier_id = prof.id
      LEFT JOIN supplier_products prod ON prod.supplier_id = prof.id
      WHERE c.id = $1 AND c.type = 'supplier'
      GROUP BY c.id, prof.id`,
      [id]
    );

    if (res.rows.length === 0) return err('Supplier not found', 404);

    // Increment view count
    query(
      `UPDATE supplier_profiles SET views_count = views_count + 1, updated_at = NOW()
       WHERE company_id = $1`,
      [id]
    ).catch(() => {});

    // Get reviews
    const reviewsRes = await query(
      `SELECT r.rating, r.title, r.comment, r.created_at,
              u.full_name AS reviewer_name
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_user_id
       WHERE r.target_id = $1 AND r.target_type = 'supplier' AND r.is_published = TRUE
       ORDER BY r.created_at DESC LIMIT 10`,
      [id]
    );

    return ok({
      ...res.rows[0],
      reviews: reviewsRes.rows,
    });

  } catch (e) {
    console.error('supplier-get error:', e.message);
    return err('Failed to fetch supplier', 500);
  }
};
