/**
 * POST /api/manufacturing/register
 * Register a manufacturing supplier (Casting / Forging / Raw Materials)
 */
const { query } = require('./_db');
const { getRequestUser } = require('./_auth');
const { preflight, ok, err, parseBody } = require('./_cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const body = parseBody(event);
    const tokenUser = getRequestUser(event);

    const {
      category,      // 'casting' | 'forging' | 'materials'
      companyName,
      contactName,
      email,
      phone,
      city,
      website,

      // Casting specific
      castingProcesses = [],    // ['Sand Casting','Investment Casting','Die Casting']
      maxWeightKg,
      materials = [],           // ['Carbon Steel','Stainless Steel','Duplex']
      certifications = [],      // ['API 6A','ISO 9001','ASME B16.34']

      // Forging specific
      forgingTypes = [],        // ['Open Die','Closed Die','Ring Rolling']
      maxForgingWeightKg,
      pressCapacityTon,

      // Raw Materials specific
      productLines = [],        // ['Bars','Pipes','Flanges','Fittings']
      grades = [],              // ['A105','F316L','F51','A182']
      stockSar,                 // Approximate stock value in SAR
      deliveryDays,

      description,
      emergencyCapable = false,
      annualCapacityTons,
      iktvaScore,
    } = body;

    if (!category || !['casting', 'forging', 'materials'].includes(category)) {
      return err('category must be: casting, forging, or materials');
    }
    if (!companyName || !contactName || !email || !phone) {
      return err('companyName, contactName, email, and phone are required');
    }

    const userId = tokenUser?.id || null;

    // Upsert company
    let companyId;
    if (userId) {
      const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [userId]);
      if (compRes.rows.length > 0) {
        companyId = compRes.rows[0].id;
        await query(
          `UPDATE companies SET name_en=$2, city=$3, website=$4, updated_at=NOW() WHERE id=$1`,
          [companyId, companyName, city, website]
        );
      } else {
        const c = await query(
          `INSERT INTO companies (owner_user_id, type, name_en, city, website, created_at, updated_at)
           VALUES ($1, 'supplier', $2, $3, $4, NOW(), NOW()) RETURNING id`,
          [userId, companyName, city, website]
        );
        companyId = c.rows[0].id;
      }
    } else {
      const c = await query(
        `INSERT INTO companies (type, name_en, city, website, created_at, updated_at)
         VALUES ('supplier', $1, $2, $3, NOW(), NOW()) RETURNING id`,
        [companyName, city, website]
      );
      companyId = c.rows[0].id;
    }

    // Upsert supplier profile
    const profRes = await query('SELECT id FROM supplier_profiles WHERE company_id = $1', [companyId]);
    let profileId;

    if (profRes.rows.length > 0) {
      profileId = profRes.rows[0].id;
      await query(
        `UPDATE supplier_profiles SET
          emergency_capable=$2, description_en=$3, updated_at=NOW()
         WHERE id=$1`,
        [profileId, emergencyCapable, description]
      );
    } else {
      const p = await query(
        `INSERT INTO supplier_profiles
           (company_id, priority_tier, emergency_capable, description_en, created_at, updated_at)
         VALUES ($1, 'P1', $2, $3, NOW(), NOW()) RETURNING id`,
        [companyId, emergencyCapable, description]
      );
      profileId = p.rows[0].id;
    }

    // Map category → pillar
    const pillarMap = { casting: 'machining', forging: 'machining', materials: 'parts' };
    const pillar = pillarMap[category];

    // Build sub_categories from all category-specific arrays
    let subCategories = [];
    if (category === 'casting')  subCategories = [...castingProcesses, ...materials];
    if (category === 'forging')  subCategories = [...forgingTypes, ...materials];
    if (category === 'materials') subCategories = [...productLines, ...grades];

    // Upsert pillar
    await query(
      `INSERT INTO supplier_pillars (supplier_id, pillar, sub_categories, is_primary, created_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (supplier_id, pillar)
       DO UPDATE SET sub_categories = $3`,
      [profileId, pillar, subCategories]
    );

    // Insert certifications
    for (const cert of certifications) {
      await query(
        `INSERT INTO supplier_certifications (supplier_id, standard, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [profileId, cert]
      ).catch(() => {});
    }

    // Update IKTVA if provided
    if (iktvaScore && companyId) {
      await query(
        `UPDATE companies SET iktva_score=$2, updated_at=NOW() WHERE id=$1`,
        [companyId, iktvaScore]
      );
    }

    // Log notification
    await query(
      `INSERT INTO notifications (type, channel, subject, body, metadata, status, created_at)
       VALUES ('manufacturing_register', 'email', $1, $2, $3, 'pending', NOW())`,
      [
        `New ${category} supplier: ${companyName}`,
        `${contactName} (${email}, ${phone}) registered as ${category} supplier from ${city}`,
        JSON.stringify({ category, companyName, contactName, email, phone, companyId })
      ]
    ).catch(() => {});

    return ok({
      message: `Your ${category} manufacturing profile has been submitted! Our team will review and contact you within 24 hours.`,
      companyId,
    }, 201);

  } catch (e) {
    console.error('register-manufacturing error:', e.message);
    return err('Registration failed — please try again', 500);
  }
};
