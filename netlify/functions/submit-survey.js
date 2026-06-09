/**
 * POST /api/survey — Submit a survey / rating
 * Public endpoint — no auth required
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
      type = 'platform_rating',   // 'platform_rating' | 'supplier_rating' | 'nps'
      rating,                     // 1–5
      targetId,                   // supplier/expert ID if rating one
      targetType,                 // 'supplier' | 'expert'
      title,
      comment,
      name,
      email,
      role,
    } = body;

    if (!rating || rating < 1 || rating > 5) {
      return err('rating is required (1–5)');
    }

    if (type === 'supplier_rating' || type === 'expert_rating') {
      if (!targetId || !targetType) {
        return err('targetId and targetType are required for supplier/expert ratings');
      }

      // Require auth for supplier/expert reviews
      if (!tokenUser) return err('Authentication required to leave a review', 401);

      await query(
        `INSERT INTO reviews
           (reviewer_user_id, target_type, target_id, rating, title, comment,
            is_published, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())`,
        [tokenUser.id, targetType, targetId, rating, title, comment]
      );

      return ok({ message: 'Review submitted. Thank you!' }, 201);
    }

    // Platform/NPS rating — save as notification record for now
    await query(
      `INSERT INTO notifications
         (user_id, type, channel, subject, body, metadata, status, created_at)
       VALUES ($1, 'survey_response', 'in_app', $2, $3, $4, 'pending', NOW())`,
      [
        tokenUser?.id || null,
        `Survey: ${type} — ${rating}/5`,
        comment || '',
        JSON.stringify({ type, rating, name, email, role, title, comment }),
      ]
    );

    return ok({ message: 'Thank you for your feedback! It helps us improve TheValveHubs.' }, 201);

  } catch (e) {
    console.error('submit-survey error:', e.message);
    return err('Failed to submit survey', 500);
  }
};
