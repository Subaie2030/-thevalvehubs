-- ═══════════════════════════════════════════════════════════════════════════
-- TheValveHubs — PostgreSQL Database Schema v2.0
-- Saudi B2B Valve & Industrial Marketplace
-- Run this on Neon: https://neon.tech → SQL Editor → Paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Drop existing tables (safe reset) ───────────────────────────────────────
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS iktva_calculations CASCADE;
DROP TABLE IF EXISTS shutdown_events CASCADE;
DROP TABLE IF EXISTS news_articles CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS project_alerts CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS emergency_rfqs CASCADE;
DROP TABLE IF EXISTS rfq_responses CASCADE;
DROP TABLE IF EXISTS rfqs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS supplier_products CASCADE;
DROP TABLE IF EXISTS supplier_certifications CASCADE;
DROP TABLE IF EXISTS supplier_pillars CASCADE;
DROP TABLE IF EXISTS supplier_profiles CASCADE;
DROP TABLE IF EXISTS expert_profiles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 1 — users
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  phone             VARCHAR(20),
  whatsapp          VARCHAR(20),
  full_name         VARCHAR(255) NOT NULL,
  role              VARCHAR(50) NOT NULL CHECK (role IN ('buyer','supplier','expert','investor','admin')),
  language          VARCHAR(10) DEFAULT 'en',
  email_verified    BOOLEAN DEFAULT FALSE,
  phone_verified    BOOLEAN DEFAULT FALSE,
  is_active         BOOLEAN DEFAULT TRUE,
  last_login        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 2 — companies
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE companies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  type                  VARCHAR(50) NOT NULL CHECK (type IN ('supplier','buyer','epc','investor')),
  name_en               VARCHAR(255) NOT NULL,
  name_ar               VARCHAR(255),
  cr_number             VARCHAR(30) UNIQUE,
  vat_number            VARCHAR(20),
  iktva_score           DECIMAL(5,2),
  aramco_approved       BOOLEAN DEFAULT FALSE,
  sabic_approved        BOOLEAN DEFAULT FALSE,
  city                  VARCHAR(100),
  region                VARCHAR(100),
  address               TEXT,
  national_address      VARCHAR(50),
  website               VARCHAR(255),
  logo_url              VARCHAR(500),
  is_active             BOOLEAN DEFAULT TRUE,
  verified              BOOLEAN DEFAULT FALSE,
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 3 — supplier_profiles
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE supplier_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  priority_tier         VARCHAR(10) NOT NULL DEFAULT 'P1' CHECK (priority_tier IN ('P1','P2')),
  country_of_origin     VARCHAR(100) DEFAULT 'Saudi Arabia',
  founding_year         INTEGER,
  employee_count        VARCHAR(50),
  annual_revenue_sar    VARCHAR(50),
  emergency_capable     BOOLEAN DEFAULT FALSE,
  emergency_response_hr INTEGER,
  description_en        TEXT,
  description_ar        TEXT,
  profile_complete      BOOLEAN DEFAULT FALSE,
  profile_score         INTEGER DEFAULT 0,
  views_count           INTEGER DEFAULT 0,
  rfq_count             INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 4 — supplier_pillars
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE supplier_pillars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  pillar          VARCHAR(20) NOT NULL CHECK (pillar IN ('valves','parts','machining','3dprint','tpi','rental')),
  sub_categories  TEXT[] DEFAULT '{}',
  iktva_score     DECIMAL(5,2),
  is_primary      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, pillar)
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 5 — supplier_certifications
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE supplier_certifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  standard        VARCHAR(100) NOT NULL,
  issuing_body    VARCHAR(100),
  certificate_no  VARCHAR(100),
  issued_date     DATE,
  expiry_date     DATE,
  document_url    VARCHAR(500),
  verified        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 6 — supplier_products
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE supplier_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  pillar          VARCHAR(20) NOT NULL,
  name_en         VARCHAR(255) NOT NULL,
  name_ar         VARCHAR(255),
  description     TEXT,
  specs           JSONB DEFAULT '{}',
  standards       TEXT[] DEFAULT '{}',
  lead_time_days  INTEGER,
  in_stock        BOOLEAN DEFAULT FALSE,
  image_url       VARCHAR(500),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 7 — expert_profiles
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE expert_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title               VARCHAR(100),
  specializations     TEXT[] DEFAULT '{}',
  years_experience    INTEGER,
  certifications      TEXT[] DEFAULT '{}',
  aramco_badge        BOOLEAN DEFAULT FALSE,
  sabic_badge         BOOLEAN DEFAULT FALSE,
  available           BOOLEAN DEFAULT TRUE,
  day_rate_sar        DECIMAL(10,2),
  location_city       VARCHAR(100),
  cv_url              VARCHAR(500),
  linkedin_url        VARCHAR(255),
  bio_en              TEXT,
  bio_ar              TEXT,
  verified            BOOLEAN DEFAULT FALSE,
  views_count         INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 8 — subscription_plans
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,
  slug                VARCHAR(50) UNIQUE NOT NULL,
  price_sar           DECIMAL(10,2) NOT NULL,
  vat_amount_sar      DECIMAL(10,2),
  billing_cycle       VARCHAR(20) DEFAULT 'monthly',
  features            JSONB DEFAULT '{}',
  max_products        INTEGER,
  max_rfqs_per_month  INTEGER,
  emergency_access    BOOLEAN DEFAULT FALSE,
  analytics_access    BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 9 — subscriptions
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
  plan_id               UUID REFERENCES subscription_plans(id),
  status                VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','cancelled','past_due','trialing','pending')),
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  moyasar_subscription_id VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 10 — invoices
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID REFERENCES companies(id),
  subscription_id     UUID REFERENCES subscriptions(id),
  invoice_number      VARCHAR(50) UNIQUE NOT NULL,
  zatca_uuid          VARCHAR(100),
  zatca_status        VARCHAR(20) DEFAULT 'pending',
  issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  supply_date         DATE,
  due_date            DATE,
  subtotal_sar        DECIMAL(10,2) NOT NULL,
  vat_amount_sar      DECIMAL(10,2) NOT NULL,
  total_sar           DECIMAL(10,2) NOT NULL,
  buyer_cr            VARCHAR(30),
  buyer_vat           VARCHAR(20),
  line_items          JSONB NOT NULL DEFAULT '[]',
  qr_code             TEXT,
  pdf_url             VARCHAR(500),
  status              VARCHAR(20) DEFAULT 'unpaid',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 11 — payments
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID REFERENCES invoices(id),
  company_id          UUID REFERENCES companies(id),
  amount_sar          DECIMAL(10,2) NOT NULL,
  currency            VARCHAR(5) DEFAULT 'SAR',
  status              VARCHAR(20) NOT NULL CHECK (status IN ('paid','failed','refunded','pending')),
  payment_method      VARCHAR(30),
  gateway             VARCHAR(30) DEFAULT 'moyasar',
  gateway_payment_id  VARCHAR(100),
  gateway_response    JSONB,
  paid_at             TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  refund_reason       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 12 — rfqs
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE rfqs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number          VARCHAR(50) UNIQUE,
  buyer_company_id    UUID REFERENCES companies(id),
  buyer_user_id       UUID REFERENCES users(id),
  pillar              VARCHAR(20),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  quantity            VARCHAR(100),
  delivery_location   VARCHAR(255),
  delivery_date       DATE,
  budget_sar          DECIMAL(12,2),
  iktva_required      DECIMAL(5,2),
  standards_required  TEXT[] DEFAULT '{}',
  attachments         TEXT[] DEFAULT '{}',
  status              VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','closed','awarded','cancelled')),
  responses_count     INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 13 — rfq_responses
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE rfq_responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_company_id UUID REFERENCES companies(id),
  supplier_user_id    UUID REFERENCES users(id),
  price_sar           DECIMAL(12,2),
  lead_time_days      INTEGER,
  iktva_score         DECIMAL(5,2),
  notes               TEXT,
  attachments         TEXT[] DEFAULT '{}',
  status              VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted','shortlisted','awarded','rejected')),
  submitted_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 14 — emergency_rfqs
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE emergency_rfqs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erq_number           VARCHAR(50) UNIQUE,
  requester_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  requester_company    VARCHAR(255),
  plant_name           VARCHAR(255),
  plant_city           VARCHAR(100),
  contact_name         VARCHAR(255) NOT NULL,
  contact_phone        VARCHAR(20) NOT NULL,
  contact_whatsapp     VARCHAR(20),
  pillar               VARCHAR(20) NOT NULL,
  description          TEXT NOT NULL,
  urgency              VARCHAR(20) NOT NULL CHECK (urgency IN ('critical','urgent','standard')),
  plant_down           BOOLEAN DEFAULT FALSE,
  quantity             TEXT,
  location             VARCHAR(255),
  deadline             TIMESTAMPTZ,
  status               VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new','assigned','responding','resolved')),
  assigned_supplier_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  assigned_at          TIMESTAMPTZ,
  resolved_at          TIMESTAMPTZ,
  resolution_notes     TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 15 — projects
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id        VARCHAR(50) UNIQUE NOT NULL,
  title               TEXT NOT NULL,
  client              VARCHAR(255) NOT NULL,
  sector              VARCHAR(50) NOT NULL,
  location            VARCHAR(255),
  estimated_value_sar DECIMAL(14,2),
  deadline            VARCHAR(50),
  iktva_target        DECIMAL(5,2),
  status              VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open','Tendering','Upcoming','Closed')),
  tags                TEXT[] DEFAULT '{}',
  source_name         VARCHAR(100),
  source_url          VARCHAR(500),
  notes               TEXT,
  added_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  is_published        BOOLEAN DEFAULT TRUE,
  views_count         INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 16 — project_alerts
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE project_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES companies(id) ON DELETE CASCADE,
  sectors             TEXT[] DEFAULT '{}',
  pillars             TEXT[] DEFAULT '{}',
  min_value_sar       DECIMAL(14,2),
  notify_email        BOOLEAN DEFAULT TRUE,
  notify_whatsapp     BOOLEAN DEFAULT TRUE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 17 — reviews
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  target_type         VARCHAR(20) NOT NULL CHECK (target_type IN ('supplier','expert')),
  target_id           UUID NOT NULL,
  rating              INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               VARCHAR(255),
  comment             TEXT,
  verified_purchase   BOOLEAN DEFAULT FALSE,
  is_published        BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 18 — notifications
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  type                VARCHAR(50) NOT NULL,
  channel             VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','email','in_app')),
  subject             VARCHAR(255),
  body                TEXT NOT NULL,
  metadata            JSONB DEFAULT '{}',
  status              VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','read')),
  sent_at             TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 19 — iktva_calculations
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE iktva_calculations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id          UUID REFERENCES companies(id) ON DELETE SET NULL,
  input_data          JSONB NOT NULL DEFAULT '{}',
  iktva_score         DECIMAL(5,2) NOT NULL,
  breakdown           JSONB DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 20 — shutdown_events
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE shutdown_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name       VARCHAR(255) NOT NULL,
  operator            VARCHAR(255),
  sector              VARCHAR(50),
  event_type          VARCHAR(50) CHECK (event_type IN ('Turnaround','Shutdown','Inspection','Commissioning')),
  location_city       VARCHAR(100),
  start_date          DATE NOT NULL,
  end_date            DATE,
  duration_days       INTEGER,
  scope               TEXT,
  valve_opportunity   TEXT,
  is_confirmed        BOOLEAN DEFAULT FALSE,
  source              VARCHAR(255),
  added_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  is_published        BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE 21 — news_articles
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE news_articles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  category            VARCHAR(50) CHECK (category IN ('market','tender','event','regulation','technology','company')),
  title_en            VARCHAR(500) NOT NULL,
  title_ar            VARCHAR(500),
  slug                VARCHAR(255) UNIQUE NOT NULL,
  summary_en          TEXT,
  body_en             TEXT,
  body_ar             TEXT,
  cover_image_url     VARCHAR(500),
  tags                TEXT[] DEFAULT '{}',
  is_published        BOOLEAN DEFAULT FALSE,
  published_at        TIMESTAMPTZ,
  views_count         INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_companies_city        ON companies(city);
CREATE INDEX idx_companies_type        ON companies(type);
CREATE INDEX idx_supplier_pillars      ON supplier_pillars(pillar);
CREATE INDEX idx_supplier_tier         ON supplier_profiles(priority_tier);
CREATE INDEX idx_projects_sector       ON projects(sector);
CREATE INDEX idx_projects_status       ON projects(status);
CREATE INDEX idx_rfqs_pillar           ON rfqs(pillar);
CREATE INDEX idx_rfqs_status           ON rfqs(status);
CREATE INDEX idx_emergency_status      ON emergency_rfqs(status);
CREATE INDEX idx_notifications_status  ON notifications(status);
CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_invoices_company      ON invoices(company_id);
CREATE INDEX idx_users_email           ON users(email);

-- ════════════════════════════════════════════════════════════════════════════
-- SEED DATA — Subscription Plans
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO subscription_plans (name, slug, price_sar, vat_amount_sar, billing_cycle, features, max_products, max_rfqs_per_month, emergency_access, analytics_access) VALUES
('Free',             'free',       0,      0,      'monthly', '{"rfq_limit":3,"verified_badge":false,"whatsapp_support":false}', 3,   3,   false, false),
('Verified Supplier','verified',   490,    73.5,   'monthly', '{"rfq_limit":25,"verified_badge":true,"whatsapp_support":true}',  20,  25,  false, false),
('Priority P1',      'priority',   1490,   223.5,  'monthly', '{"rfq_limit":100,"verified_badge":true,"listing_priority":true,"iktva_report":true}', 100, 100, true, true),
('Enterprise',       'enterprise', 0,      0,      'annual',  '{"rfq_limit":-1,"verified_badge":true,"listing_priority":true,"dedicated_account":true}', -1, -1, true, true);

-- ════════════════════════════════════════════════════════════════════════════
-- SEED DATA — Default Admin User (change password immediately!)
-- ════════════════════════════════════════════════════════════════════════════
-- Password: TVH@Admin2026! (hashed with bcrypt rounds=12)
-- IMPORTANT: Change this password immediately after first login
INSERT INTO users (email, password_hash, full_name, role, email_verified, is_active) VALUES
('admin@thevalvehubs.com', '$2a$12$K9mLq7SZxWX8jYnPqR3tOO1RjK5v2xJwHmMhD3lFpNqG8sVtE6uXK', 'TVH Admin', 'admin', true, true);

-- ════════════════════════════════════════════════════════════════════════════
-- Schema complete. 21 tables + indexes + seed data.
-- Next step: Add DATABASE_URL to Netlify environment variables.
-- ════════════════════════════════════════════════════════════════════════════
