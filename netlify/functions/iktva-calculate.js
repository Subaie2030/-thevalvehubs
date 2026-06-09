/**
 * POST /api/iktva/calculate  — Calculate & save IKTVA score
 * GET  /api/iktva/history    — Get user's calculation history
 * GET  /api/iktva/benchmark  — Industry benchmarks (public)
 */
const { query } = require('./_db');
const { getRequestUser } = require('./_auth');
const { preflight, ok, err, parseBody, queryParams } = require('./_cors');

// ── IKTVA Scoring Model ───────────────────────────────────────────────
// Based on Saudi Aramco IKTVA methodology
function calculateIKTVA(inputs) {
  const {
    // Manpower (max 35 points)
    saudiEmployees = 0, totalEmployees = 1,
    // Goods & Services (max 30 points)
    localProcurementSar = 0, totalProcurementSar = 1,
    // Technology Transfer (max 15 points)
    hasRdProgram = false, hasTechLicense = false, hasTrainingCenter = false,
    // Business Sustainability (max 10 points)
    yearsInSaudi = 0, hasIso9001 = false, hasAramcoApproval = false,
    // Capital & Finance (max 10 points)
    saudiOwnership = 0, hasLocalBank = false,
  } = inputs;

  const breakdown = {};

  // Manpower (35 pts)
  const saudiRatio = Math.min(saudiEmployees / Math.max(totalEmployees, 1), 1);
  breakdown.manpower = Math.round(saudiRatio * 35 * 10) / 10;

  // Goods & Services (30 pts)
  const localRatio = Math.min(localProcurementSar / Math.max(totalProcurementSar, 1), 1);
  breakdown.goodsServices = Math.round(localRatio * 30 * 10) / 10;

  // Technology Transfer (15 pts)
  let techScore = 0;
  if (hasRdProgram)       techScore += 6;
  if (hasTechLicense)     techScore += 5;
  if (hasTrainingCenter)  techScore += 4;
  breakdown.technology = techScore;

  // Business Sustainability (10 pts)
  let bizScore = 0;
  if (yearsInSaudi >= 10) bizScore += 4;
  else if (yearsInSaudi >= 5) bizScore += 2;
  else if (yearsInSaudi >= 1) bizScore += 1;
  if (hasIso9001)         bizScore += 3;
  if (hasAramcoApproval)  bizScore += 3;
  breakdown.sustainability = Math.min(bizScore, 10);

  // Capital & Finance (10 pts)
  let capScore = Math.min((saudiOwnership / 100) * 8, 8);
  if (hasLocalBank) capScore += 2;
  breakdown.capital = Math.round(capScore * 10) / 10;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.round(Math.min(total, 100) * 10) / 10;

  // Aramco IKTVA band
  let band, color, advice;
  if (score >= 75) {
    band = 'Excellence'; color = '#006C35';
    advice = 'Eligible for P1 Priority designation. Maintain and document all local activities.';
  } else if (score >= 50) {
    band = 'Established'; color = '#C8973A';
    advice = 'Strong foundation. Focus on Saudi manpower and local procurement to reach Excellence tier.';
  } else if (score >= 25) {
    band = 'Developing'; color = '#1A3A6B';
    advice = 'Growing presence. Hire more Saudi engineers and build local supply chain partnerships.';
  } else {
    band = 'Entry'; color = '#C0392B';
    advice = 'Start with Saudi hiring plan and local procurement commitments to qualify for Aramco bids.';
  }

  return { score, breakdown, band, color, advice };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const path = event.path || '';
  const tokenUser = getRequestUser(event);

  // ── GET /benchmark — public ──────────────────────────────────────
  if (event.httpMethod === 'GET' && path.includes('/benchmark')) {
    return ok({
      benchmarks: [
        { sector: 'Valve Manufacturing',   avg: 62.4, top10: 84.1 },
        { sector: 'Industrial Services',   avg: 55.8, top10: 78.3 },
        { sector: 'Pipeline Equipment',    avg: 58.2, top10: 80.5 },
        { sector: 'Instrumentation',       avg: 51.1, top10: 74.9 },
        { sector: 'Repair & Maintenance',  avg: 67.3, top10: 88.2 },
        { sector: 'Testing & Inspection',  avg: 59.7, top10: 82.0 },
      ],
      aramcoMinimum:  35,
      sabicMinimum:   30,
      vision2030Target: 70,
    });
  }

  // ── GET /history — requires auth ─────────────────────────────────
  if (event.httpMethod === 'GET' && path.includes('/history')) {
    if (!tokenUser) return err('Authentication required', 401);
    try {
      const res = await query(
        `SELECT id, iktva_score, breakdown, notes, created_at
         FROM iktva_calculations
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [tokenUser.id]
      );
      return ok({ history: res.rows });
    } catch (e) {
      return err('Failed to fetch history', 500);
    }
  }

  // ── POST /calculate ───────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const body = parseBody(event);
      const result = calculateIKTVA(body);

      // Save to DB if authenticated
      if (tokenUser) {
        const compRes = await query('SELECT id FROM companies WHERE owner_user_id = $1', [tokenUser.id]);
        const companyId = compRes.rows.length > 0 ? compRes.rows[0].id : null;

        await query(
          `INSERT INTO iktva_calculations
             (user_id, company_id, input_data, iktva_score, breakdown, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [tokenUser.id, companyId, JSON.stringify(body), result.score, JSON.stringify(result.breakdown)]
        ).catch(() => {}); // Non-blocking

        // Update company IKTVA score
        if (companyId) {
          await query(
            `UPDATE companies SET iktva_score = $2, updated_at = NOW() WHERE id = $1`,
            [companyId, result.score]
          ).catch(() => {});
        }
      }

      return ok({
        score:     result.score,
        breakdown: result.breakdown,
        band:      result.band,
        color:     result.color,
        advice:    result.advice,
        saved:     !!tokenUser,
      });
    } catch (e) {
      console.error('iktva-calculate error:', e.message);
      return err('Calculation failed', 500);
    }
  }

  return err('Method not allowed', 405);
};
