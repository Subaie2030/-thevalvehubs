# TheValveHubs — Database Schema (PostgreSQL)
# Version 1.0 — Designed for Saudi B2B Marketplace

---

## OVERVIEW — Entity Map

```
users
  ├── companies (buyer / supplier / epc / investor)
  │     └── supplier_profiles
  │           ├── supplier_pillars       (which of 6 pillars)
  │           ├── supplier_certifications
  │           └── supplier_products
  ├── expert_profiles
  └── subscriptions ──→ subscription_plans
                   └──→ invoices ──→ payments

projects (tender tracker)
  └── project_alerts (user subscriptions to project notifications)

rfqs (general requests)
  └── rfq_responses

emergency_rfqs
  └── emergency_responses

reviews (for suppliers and experts)
notifications (WhatsApp + email alerts)
iktva_calculations (saved results)
shutdown_events (calendar)
news_articles (TVH intelligence)
```

---

## TABLE 1 — users
> Authentication and identity. One user = one person.

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  phone             VARCHAR(20),                    -- Saudi format: +966XXXXXXXXX
  whatsapp          VARCHAR(20),
  full_name         VARCHAR(255) NOT NULL,
  role              VARCHAR(50) NOT NULL,            -- 'buyer' | 'supplier' | 'expert' | 'investor' | 'admin'
  language          VARCHAR(10) DEFAULT 'en',        -- 'en' | 'ar'
  email_verified    BOOLEAN DEFAULT FALSE,
  phone_verified    BOOLEAN DEFAULT FALSE,
  is_active         BOOLEAN DEFAULT TRUE,
  last_login        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 2 — companies
> Organizations: suppliers, buyers, EPC contractors, investors.

```sql
CREATE TABLE companies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         UUID REFERENCES users(id),
  type                  VARCHAR(50) NOT NULL,         -- 'supplier' | 'buyer' | 'epc' | 'investor'
  name_en               VARCHAR(255) NOT NULL,
  name_ar               VARCHAR(255),
  cr_number             VARCHAR(30) UNIQUE,            -- Commercial Registration رقم السجل التجاري
  vat_number            VARCHAR(20),                   -- ZATCA VAT رقم
  iktva_score           DECIMAL(5,2),                  -- 0.00 to 100.00
  aramco_approved       BOOLEAN DEFAULT FALSE,
  sabic_approved        BOOLEAN DEFAULT FALSE,
  city                  VARCHAR(100),                  -- Khobar | Riyadh | Jubail | Jeddah | Yanbu
  region                VARCHAR(100),                  -- Eastern Province | Riyadh | Makkah | etc.
  address               TEXT,
  national_address      VARCHAR(50),                   -- Saudi National Address (Wasel)
  website               VARCHAR(255),
  logo_url              VARCHAR(500),
  verified              BOOLEAN DEFAULT FALSE,          -- TVH verified badge
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 3 — supplier_profiles
> Extended data for companies with type = 'supplier'.

```sql
CREATE TABLE supplier_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  priority_tier         VARCHAR(10) NOT NULL,           -- 'P1' (Saudi) | 'P2' (Global)
  country_of_origin     VARCHAR(100) DEFAULT 'Saudi Arabia',
  founding_year         INTEGER,
  employee_count        VARCHAR(50),                    -- '1-10' | '11-50' | '51-200' | '200+'
  annual_revenue_sar    VARCHAR(50),                    -- Revenue range for matching
  emergency_capable     BOOLEAN DEFAULT FALSE,          -- Can respond in <2 hours?
  emergency_response_hr INTEGER,                        -- Response time in hours
  description_en        TEXT,
  description_ar        TEXT,
  profile_complete      BOOLEAN DEFAULT FALSE,
  profile_score         INTEGER DEFAULT 0,              -- 0–100 completeness score
  views_count           INTEGER DEFAULT 0,
  rfq_count             INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 4 — supplier_pillars
> Which of the 6 Saudi Market pillars each supplier covers.

```sql
CREATE TABLE supplier_pillars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  pillar          VARCHAR(20) NOT NULL,         -- 'valves' | 'parts' | 'machining' | '3dprint' | 'tpi' | 'rental'
  sub_categories  TEXT[],                       -- e.g. ['Gate Valves','Ball Valves','API 6D']
  iktva_score     DECIMAL(5,2),                 -- Pillar-specific IKTVA
  is_primary      BOOLEAN DEFAULT FALSE,        -- Main pillar?
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(supplier_id, pillar)
);
```

---

## TABLE 5 — supplier_certifications
> API, ASME, ISO, SAMSS and other standards held by supplier.

```sql
CREATE TABLE supplier_certifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  standard        VARCHAR(100) NOT NULL,         -- 'API 6D' | 'ISO 9001' | 'SAMSS' | 'NACE MR0175'
  issuing_body    VARCHAR(100),
  certificate_no  VARCHAR(100),
  issued_date     DATE,
  expiry_date     DATE,
  document_url    VARCHAR(500),
  verified        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 6 — supplier_products
> Product/service catalog entries per supplier.

```sql
CREATE TABLE supplier_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  pillar          VARCHAR(20) NOT NULL,
  name_en         VARCHAR(255) NOT NULL,
  name_ar         VARCHAR(255),
  description     TEXT,
  specs           JSONB,                          -- Flexible: {"size":"2-48 inch","pressure":"Class 150-2500"}
  standards       TEXT[],                         -- ['API 6D','ASME B16.34']
  lead_time_days  INTEGER,
  in_stock        BOOLEAN DEFAULT FALSE,
  image_url       VARCHAR(500),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 7 — expert_profiles
> Valve engineers, technicians, inspectors, consultants.

```sql
CREATE TABLE expert_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE REFERENCES users(id),
  title               VARCHAR(100),               -- 'Valve Engineer' | 'TPI Inspector' | 'Consultant'
  specializations     TEXT[],                     -- ['Control Valves','API 598','NDE Testing']
  years_experience    INTEGER,
  certifications      TEXT[],                     -- ['API 570','CSWIP','ASNT Level II']
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
```

---

## TABLE 8 — subscription_plans
> Pricing tiers (matches Pricing page).

```sql
CREATE TABLE subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,       -- 'Free' | 'Verified' | 'Priority' | 'Enterprise'
  slug                VARCHAR(50) UNIQUE NOT NULL, -- 'free' | 'verified' | 'priority' | 'enterprise'
  price_sar           DECIMAL(10,2) NOT NULL,      -- Excluding VAT
  vat_amount_sar      DECIMAL(10,2),               -- 15% VAT (calculated)
  billing_cycle       VARCHAR(20) DEFAULT 'monthly',-- 'monthly' | 'annual'
  features            JSONB,                       -- {"rfq_limit":5,"listing_priority":false,...}
  max_products        INTEGER,
  max_rfqs_per_month  INTEGER,
  emergency_access    BOOLEAN DEFAULT FALSE,
  analytics_access    BOOLEAN DEFAULT FALSE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 9 — subscriptions
> Active subscriptions per company. Linked to payment and invoice.

```sql
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID REFERENCES companies(id),
  plan_id             UUID REFERENCES subscription_plans(id),
  status              VARCHAR(20) DEFAULT 'active',  -- 'active' | 'cancelled' | 'past_due' | 'trialing'
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end  TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  moyasar_subscription_id VARCHAR(100),              -- Moyasar recurring billing ID
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 10 — invoices
> ZATCA-compliant e-invoices for every payment.

```sql
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID REFERENCES companies(id),
  subscription_id     UUID REFERENCES subscriptions(id),
  invoice_number      VARCHAR(50) UNIQUE NOT NULL,   -- TVH-2026-00001 (sequential)
  zatca_uuid          VARCHAR(100),                  -- ZATCA-issued UUID after submission
  zatca_status        VARCHAR(20),                   -- 'pending' | 'reported' | 'cleared' | 'rejected'
  issue_date          DATE NOT NULL,
  supply_date         DATE,
  due_date            DATE,
  subtotal_sar        DECIMAL(10,2) NOT NULL,        -- Before VAT
  vat_amount_sar      DECIMAL(10,2) NOT NULL,        -- 15% VAT
  total_sar           DECIMAL(10,2) NOT NULL,        -- subtotal + VAT
  buyer_cr            VARCHAR(30),                   -- Buyer CR for B2B invoice
  buyer_vat           VARCHAR(20),                   -- Buyer VAT number
  line_items          JSONB NOT NULL,                -- [{description, qty, unit_price, vat}]
  qr_code             TEXT,                          -- ZATCA QR code (base64)
  pdf_url             VARCHAR(500),
  status              VARCHAR(20) DEFAULT 'unpaid',  -- 'unpaid' | 'paid' | 'void'
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 11 — payments
> Payment transactions via Moyasar (or other SAMA-licensed gateway).

```sql
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID REFERENCES invoices(id),
  company_id          UUID REFERENCES companies(id),
  amount_sar          DECIMAL(10,2) NOT NULL,
  currency            VARCHAR(5) DEFAULT 'SAR',
  status              VARCHAR(20) NOT NULL,           -- 'paid' | 'failed' | 'refunded' | 'pending'
  payment_method      VARCHAR(30),                    -- 'mada' | 'visa' | 'mastercard' | 'apple_pay'
  gateway             VARCHAR(30) DEFAULT 'moyasar',
  gateway_payment_id  VARCHAR(100),                   -- Moyasar payment ID
  gateway_response    JSONB,                          -- Full gateway response for audit
  paid_at             TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  refund_reason       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 12 — rfqs
> General Request for Quotation from buyers to suppliers.

```sql
CREATE TABLE rfqs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number          VARCHAR(50) UNIQUE,             -- TVH-RFQ-2026-00001
  buyer_company_id    UUID REFERENCES companies(id),
  buyer_user_id       UUID REFERENCES users(id),
  pillar              VARCHAR(20),                    -- Which of 6 pillars
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  quantity            VARCHAR(100),
  delivery_location   VARCHAR(255),                   -- City / Plant name
  delivery_date       DATE,
  budget_sar          DECIMAL(12,2),
  iktva_required      DECIMAL(5,2),                  -- Minimum IKTVA % required
  standards_required  TEXT[],
  attachments         TEXT[],                        -- S3 URLs of uploaded docs
  status              VARCHAR(20) DEFAULT 'open',    -- 'open' | 'closed' | 'awarded' | 'cancelled'
  responses_count     INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 13 — rfq_responses
> Supplier responses / quotes to an RFQ.

```sql
CREATE TABLE rfq_responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              UUID REFERENCES rfqs(id),
  supplier_company_id UUID REFERENCES companies(id),
  supplier_user_id    UUID REFERENCES users(id),
  price_sar           DECIMAL(12,2),
  lead_time_days      INTEGER,
  iktva_score         DECIMAL(5,2),
  notes               TEXT,
  attachments         TEXT[],
  status              VARCHAR(20) DEFAULT 'submitted', -- 'submitted' | 'shortlisted' | 'awarded' | 'rejected'
  submitted_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 14 — emergency_rfqs
> Urgent 24/7 emergency requests. Separate from regular RFQs due to SLA requirements.

```sql
CREATE TABLE emergency_rfqs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erq_number          VARCHAR(50) UNIQUE,             -- TVH-ERQ-2026-00001
  requester_user_id   UUID REFERENCES users(id),
  requester_company   VARCHAR(255),
  plant_name          VARCHAR(255),
  plant_city          VARCHAR(100),
  contact_name        VARCHAR(255) NOT NULL,
  contact_phone       VARCHAR(20) NOT NULL,
  contact_whatsapp    VARCHAR(20),
  pillar              VARCHAR(20) NOT NULL,           -- Which emergency service needed
  description         TEXT NOT NULL,
  urgency             VARCHAR(20) NOT NULL,           -- 'critical' (2h) | 'urgent' (24h) | 'standard' (72h)
  plant_down          BOOLEAN DEFAULT FALSE,          -- Is plant stopped?
  quantity            TEXT,
  location            VARCHAR(255),
  deadline            TIMESTAMPTZ,
  status              VARCHAR(20) DEFAULT 'new',      -- 'new' | 'assigned' | 'responding' | 'resolved'
  assigned_supplier_id UUID REFERENCES companies(id),
  assigned_at         TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 15 — projects
> Saudi valve tender tracker. Replaces manual JS array in projects.html.

```sql
CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id        VARCHAR(50) UNIQUE NOT NULL,   -- e.g. IK-2026-1047
  title               TEXT NOT NULL,
  client              VARCHAR(255) NOT NULL,          -- Saudi Aramco | SABIC | SWCC | etc.
  sector              VARCHAR(50) NOT NULL,           -- 'Oil & Gas' | 'Water' | 'Power' | etc.
  location            VARCHAR(255),
  estimated_value_sar DECIMAL(14,2),
  deadline            VARCHAR(50),                   -- 'Aug 2026' | 'Q1 2027' | 'TBD'
  iktva_target        DECIMAL(5,2),
  status              VARCHAR(20) DEFAULT 'Open',    -- 'Open' | 'Tendering' | 'Upcoming' | 'Closed'
  tags                TEXT[],                        -- ['Gate Valves','API 6D','SAMSS']
  source_name         VARCHAR(100),                  -- 'Etimad' | 'Aramco IBO' | 'MEED'
  source_url          VARCHAR(500),
  notes               TEXT,
  added_by            UUID REFERENCES users(id),
  is_published        BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 16 — project_alerts
> Suppliers subscribe to receive alerts for specific sectors/pillars.

```sql
CREATE TABLE project_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  company_id          UUID REFERENCES companies(id),
  sectors             TEXT[],                        -- ['Oil & Gas','Water']
  pillars             TEXT[],                        -- ['valves','parts']
  min_value_sar       DECIMAL(14,2),
  notify_email        BOOLEAN DEFAULT TRUE,
  notify_whatsapp     BOOLEAN DEFAULT TRUE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 17 — reviews
> Ratings for suppliers and experts (1–5 stars + comment).

```sql
CREATE TABLE reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_user_id    UUID REFERENCES users(id),
  reviewer_company_id UUID REFERENCES companies(id),
  target_type         VARCHAR(20) NOT NULL,          -- 'supplier' | 'expert'
  target_id           UUID NOT NULL,                 -- supplier_profiles.id or expert_profiles.id
  rating              INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               VARCHAR(255),
  comment             TEXT,
  verified_purchase   BOOLEAN DEFAULT FALSE,
  is_published        BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 18 — notifications
> System notifications — WhatsApp, email, in-app.

```sql
CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  type                VARCHAR(50) NOT NULL,           -- 'new_project' | 'rfq_response' | 'emergency_assigned'
  channel             VARCHAR(20) NOT NULL,           -- 'whatsapp' | 'email' | 'in_app'
  subject             VARCHAR(255),
  body                TEXT NOT NULL,
  metadata            JSONB,                          -- Extra data (project_id, rfq_id, etc.)
  status              VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'sent' | 'failed' | 'read'
  sent_at             TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 19 — iktva_calculations
> Saved IKTVA calculator results per user/company.

```sql
CREATE TABLE iktva_calculations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  company_id          UUID REFERENCES companies(id),
  input_data          JSONB NOT NULL,                -- All form inputs
  iktva_score         DECIMAL(5,2) NOT NULL,
  breakdown           JSONB,                         -- Score by category
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 20 — shutdown_events
> Shutdown calendar — replaces static HTML table.

```sql
CREATE TABLE shutdown_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name       VARCHAR(255) NOT NULL,
  operator            VARCHAR(255),                  -- Aramco | SABIC | SWCC | SEC
  sector              VARCHAR(50),
  event_type          VARCHAR(50),                   -- 'Turnaround' | 'Shutdown' | 'Inspection'
  location_city       VARCHAR(100),
  start_date          DATE NOT NULL,
  end_date            DATE,
  duration_days       INTEGER,
  scope               TEXT,
  valve_opportunity   TEXT,                          -- What valves/services are needed
  is_confirmed        BOOLEAN DEFAULT FALSE,
  source              VARCHAR(255),
  added_by            UUID REFERENCES users(id),
  is_published        BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TABLE 21 — news_articles
> TVH News and Intelligence content.

```sql
CREATE TABLE news_articles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           UUID REFERENCES users(id),
  category            VARCHAR(50),                   -- 'market' | 'tender' | 'event' | 'regulation' | 'technology'
  title_en            VARCHAR(500) NOT NULL,
  title_ar            VARCHAR(500),
  slug                VARCHAR(255) UNIQUE NOT NULL,
  summary_en          TEXT,
  body_en             TEXT,
  body_ar             TEXT,
  cover_image_url     VARCHAR(500),
  tags                TEXT[],
  is_published        BOOLEAN DEFAULT FALSE,
  published_at        TIMESTAMPTZ,
  views_count         INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## KEY RELATIONSHIPS SUMMARY

```
users (1) ──→ (1) companies          [owner]
users (1) ──→ (1) expert_profiles
companies (1) ──→ (1) supplier_profiles
supplier_profiles (1) ──→ (N) supplier_pillars
supplier_profiles (1) ──→ (N) supplier_certifications
supplier_profiles (1) ──→ (N) supplier_products
companies (1) ──→ (N) subscriptions ──→ subscription_plans
subscriptions (1) ──→ (N) invoices ──→ (N) payments
companies (1) ──→ (N) rfqs ──→ (N) rfq_responses
users (1) ──→ (N) emergency_rfqs
projects (1) ──→ (N) project_alerts (via sectors/pillars match)
companies (1) ──→ (N) reviews
users (1) ──→ (N) notifications
users (1) ──→ (N) iktva_calculations
```

---

## SAUDI-SPECIFIC FIELDS SUMMARY

| Field | Table | Purpose |
|---|---|---|
| `cr_number` | companies | Commercial Registration — mandatory for invoicing |
| `vat_number` | companies | ZATCA VAT registration |
| `iktva_score` | companies, supplier_pillars | Vision 2030 compliance |
| `aramco_approved` | companies | Aramco Approved Vendor status |
| `national_address` | companies | Saudi Wasel national address |
| `zatca_uuid` | invoices | ZATCA e-invoice UUID |
| `zatca_status` | invoices | ZATCA reporting status |
| `qr_code` | invoices | ZATCA-mandated QR code |
| `vat_amount_sar` | invoices, plans | 15% VAT calculation |
| `plant_down` | emergency_rfqs | Critical SLA trigger |
| `urgency` | emergency_rfqs | 2h / 24h / 72h SLA |

---

## RECOMMENDED INDEXES

```sql
-- Fast supplier search by city and pillar
CREATE INDEX idx_companies_city ON companies(city);
CREATE INDEX idx_supplier_pillars_pillar ON supplier_pillars(pillar);
CREATE INDEX idx_supplier_profiles_tier ON supplier_profiles(priority_tier);

-- Fast project filtering
CREATE INDEX idx_projects_sector ON projects(sector);
CREATE INDEX idx_projects_status ON projects(status);

-- Fast RFQ routing
CREATE INDEX idx_rfqs_pillar ON rfqs(pillar);
CREATE INDEX idx_rfqs_status ON rfqs(status);

-- Notifications queue
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Invoicing
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_zatca ON invoices(zatca_status);
```

---

## IMPLEMENTATION ORDER (Suggested)

```
Phase 1 — Core (MVP)
  users + companies + supplier_profiles + supplier_pillars
  subscription_plans + subscriptions + invoices + payments

Phase 2 — Marketplace
  rfqs + rfq_responses
  emergency_rfqs
  projects (replace static JS array)
  project_alerts + notifications

Phase 3 — Trust & Intelligence
  reviews + expert_profiles
  iktva_calculations
  shutdown_events
  news_articles
```
