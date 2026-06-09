/**
 * GET /api/plans — Return all subscription plans
 * Prices are in SAR (incl. 15% VAT breakdown)
 */
const { query } = require('./_db');
const { preflight, ok, err } = require('./_cors');

// Fallback plans if DB isn't seeded yet
const DEFAULT_PLANS = [
  {
    id: 'plan-free',
    name: 'Free',
    slug: 'free',
    price_sar: 0,
    vat_amount_sar: 0,
    total_sar: 0,
    billing_cycle: 'monthly',
    features: {
      rfq_limit: 3,
      listing_priority: false,
      emergency_access: false,
      analytics_access: false,
      verified_badge: false,
      whatsapp_support: false,
    },
    max_products: 3,
    max_rfqs_per_month: 3,
    emergency_access: false,
    analytics_access: false,
    description: 'Get started — list your company, receive RFQs',
    highlight: false,
  },
  {
    id: 'plan-verified',
    name: 'Verified Supplier',
    slug: 'verified',
    price_sar: 490,
    vat_amount_sar: 73.5,
    total_sar: 563.5,
    billing_cycle: 'monthly',
    features: {
      rfq_limit: 25,
      listing_priority: false,
      emergency_access: false,
      analytics_access: false,
      verified_badge: true,
      whatsapp_support: true,
    },
    max_products: 20,
    max_rfqs_per_month: 25,
    emergency_access: false,
    analytics_access: false,
    description: 'TVH-verified badge, full profile, buyer RFQs',
    highlight: false,
  },
  {
    id: 'plan-priority',
    name: 'Priority P1',
    slug: 'priority',
    price_sar: 1490,
    vat_amount_sar: 223.5,
    total_sar: 1713.5,
    billing_cycle: 'monthly',
    features: {
      rfq_limit: 100,
      listing_priority: true,
      emergency_access: true,
      analytics_access: true,
      verified_badge: true,
      whatsapp_support: true,
      iktva_report: true,
    },
    max_products: 100,
    max_rfqs_per_month: 100,
    emergency_access: true,
    analytics_access: true,
    description: 'Top placement, emergency network, analytics dashboard',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    price_sar: null,
    vat_amount_sar: null,
    total_sar: null,
    billing_cycle: 'annual',
    features: {
      rfq_limit: -1,
      listing_priority: true,
      emergency_access: true,
      analytics_access: true,
      verified_badge: true,
      whatsapp_support: true,
      iktva_report: true,
      custom_integration: true,
      dedicated_account: true,
    },
    max_products: -1,
    max_rfqs_per_month: -1,
    emergency_access: true,
    analytics_access: true,
    description: 'Custom pricing, dedicated account manager, API access',
    highlight: false,
    badge: 'Custom',
    contact_only: true,
  },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  try {
    const res = await query(
      `SELECT id, name, slug, price_sar, vat_amount_sar,
              (price_sar + COALESCE(vat_amount_sar, 0)) AS total_sar,
              billing_cycle, features, max_products,
              max_rfqs_per_month, emergency_access, analytics_access
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY price_sar ASC NULLS LAST`
    );

    if (res.rows.length > 0) {
      return ok({ plans: res.rows });
    }

    // DB not seeded yet — return defaults
    return ok({ plans: DEFAULT_PLANS });
  } catch (e) {
    // DB not set up yet — return defaults silently
    return ok({ plans: DEFAULT_PLANS });
  }
};
