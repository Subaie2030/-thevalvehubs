# TheValveHubs — Backend Full Requirements
# جميع المتطلبات لبناء الـ Backend الكامل

---

## 1. DEVELOPMENT ENVIRONMENT (الجهاز المحلي)

| الأداة | الإصدار | الرابط | الغرض |
|---|---|---|---|
| **Node.js** | v20 LTS أو أعلى | nodejs.org | بيئة تشغيل الـ backend |
| **npm** | يأتي مع Node.js | — | إدارة المكتبات |
| **PostgreSQL** | v16 | postgresql.org | قاعدة البيانات |
| **pgAdmin 4** | يأتي مع PostgreSQL | — | واجهة رسومية للـ DB |
| **Git** | latest | git-scm.com | إدارة الكود |
| **VS Code** | latest | code.visualstudio.com | محرر الكود |
| **Postman** | latest | postman.com | اختبار الـ API |

### VS Code Extensions المطلوبة
- Prisma (رسمي)
- ESLint
- Prettier
- REST Client (أو Thunderclient)
- DotENV

---

## 2. ACCOUNTS & SERVICES (حسابات خارجية)

### 🔴 إلزامي قبل البدء

| الخدمة | الغرض | التكلفة | الموقع |
|---|---|---|---|
| **Moyasar** | بوابة الدفع (SAMA licensed) | مجاني + 2.1% عمولة | moyasar.com |
| **AWS** | Hosting + Storage + Email | ~200 SAR/شهر للبداية | aws.amazon.com |
| **ZATCA Developer Portal** | e-Invoice sandbox | مجاني | fatoora.zatca.gov.sa |
| **GitHub** | كود source control | مجاني | github.com |

### 🟡 مطلوب قريباً

| الخدمة | الغرض | التكلفة |
|---|---|---|
| **WhatsApp Business API** | إرسال تنبيهات للموردين | ~0.05$ لكل رسالة |
| **Twilio** (بديل) | SMS + WhatsApp | Pay as you go |
| **SendGrid** أو **Amazon SES** | إرسال إيميلات | مجاني للبداية |
| **Cloudflare** | DNS + CDN + حماية | مجاني للخطة الأساسية |

### 🟢 لاحقاً

| الخدمة | الغرض |
|---|---|
| **Sentry** | مراقبة الأخطاء في الـ backend |
| **Datadog** أو **Grafana** | مراقبة الأداء |
| **Redis** (AWS ElastiCache) | Caching + Rate limiting |

---

## 3. AWS SERVICES المطلوبة

> يجب استخدام **Region: me-south-1 (Bahrain)** أو **me-central-1 (UAE)** لضمان تخزين البيانات قريباً من KSA وامتثال PDPL

| الخدمة | الغرض | التكلفة التقديرية |
|---|---|---|
| **RDS (PostgreSQL)** | قاعدة البيانات في السحابة | ~150 SAR/شهر |
| **EC2** أو **Elastic Beanstalk** | تشغيل الـ Node.js server | ~100 SAR/شهر |
| **S3** | تخزين الملفات (PDFs، صور، شهادات) | ~10 SAR/شهر |
| **SES** | إرسال الإيميلات | ~1 SAR/1000 إيميل |
| **CloudFront** | CDN للملفات الثابتة | ~5 SAR/شهر |
| **Route 53** | DNS management | ~2 SAR/شهر |
| **Certificate Manager** | SSL مجاناً | مجاني |

**البديل الأبسط للبداية:** Railway.app أو Render.com (أسهل من AWS، مناسب للـ MVP)

---

## 4. NODE.JS PACKAGES (المكتبات)

### Core Framework
```
express              — API framework
cors                 — Cross-origin requests
helmet               — Security headers
compression          — Response compression
morgan               — Request logging
dotenv               — Environment variables
```

### Database
```
prisma               — ORM (مولّد الـ SQL تلقائياً)
@prisma/client       — Prisma client
```

### Authentication & Security
```
jsonwebtoken         — JWT tokens
bcryptjs             — تشفير كلمات المرور
express-rate-limit   — منع الـ spam
joi أو zod           — Validation للبيانات الواردة
```

### Payments (Moyasar)
```
axios                — HTTP requests للـ Moyasar API
```

### ZATCA e-Invoice
```
xmlbuilder2          — توليد XML للفاتورة
qrcode               — توليد QR Code للفاتورة
crypto               — تشفير وتوقيع الفاتورة (مدمج في Node.js)
```

### File Upload & Storage
```
multer               — استقبال الملفات
@aws-sdk/client-s3   — رفع الملفات إلى AWS S3
sharp                — ضغط الصور
```

### Email & Notifications
```
nodemailer           — إرسال الإيميلات
@sendgrid/mail       — (بديل) SendGrid
twilio               — WhatsApp + SMS
```

### Utilities
```
uuid                 — توليد IDs
dayjs                — التعامل مع التواريخ
winston              — Logging متقدم
express-async-errors — معالجة الأخطاء في async
```

### Development Only
```
nodemon              — إعادة تشغيل الـ server عند التعديل
jest                 — اختبارات
supertest            — اختبار الـ API
```

---

## 5. API ENDPOINTS المطلوبة (Phase 1)

### Auth
```
POST   /api/auth/register          — تسجيل حساب جديد
POST   /api/auth/login             — تسجيل دخول
POST   /api/auth/logout            — تسجيل خروج
POST   /api/auth/refresh           — تجديد الـ token
POST   /api/auth/forgot-password   — نسيت كلمة المرور
POST   /api/auth/reset-password    — إعادة تعيين كلمة المرور
GET    /api/auth/me                — بيانات المستخدم الحالي
```

### Companies & Suppliers
```
POST   /api/companies              — إنشاء شركة
GET    /api/companies/:id          — عرض شركة
PUT    /api/companies/:id          — تعديل شركة
GET    /api/suppliers              — قائمة الموردين (مع فلترة)
GET    /api/suppliers/:id          — ملف مورد
PUT    /api/suppliers/:id/pillars  — تحديث الأعمدة
POST   /api/suppliers/:id/certs    — إضافة شهادة
```

### Subscriptions & Payments
```
GET    /api/plans                  — عرض خطط الأسعار
POST   /api/subscriptions          — اشتراك جديد
GET    /api/subscriptions/current  — اشتراكي الحالي
DELETE /api/subscriptions/:id      — إلغاء اشتراك
GET    /api/invoices               — قائمة الفواتير
GET    /api/invoices/:id/pdf       — تحميل PDF الفاتورة
POST   /api/payments/webhook       — Moyasar webhook
```

### RFQs
```
POST   /api/rfqs                   — إنشاء RFQ
GET    /api/rfqs                   — قائمة الـ RFQs
GET    /api/rfqs/:id               — عرض RFQ
POST   /api/rfqs/:id/respond       — رد مورد على RFQ
PUT    /api/rfqs/:id/award         — ترسية العطاء
```

### Emergency
```
POST   /api/emergency              — طلب طارئ جديد
GET    /api/emergency/:id          — تفاصيل الطلب
PUT    /api/emergency/:id/assign   — تعيين مورد
PUT    /api/emergency/:id/resolve  — إغلاق الطلب
```

### Projects (Admin)
```
GET    /api/projects               — قائمة المشاريع (public)
POST   /api/projects               — إضافة مشروع (admin)
PUT    /api/projects/:id           — تعديل مشروع (admin)
DELETE /api/projects/:id           — حذف مشروع (admin)
POST   /api/projects/alerts        — الاشتراك في التنبيهات
```

### IKTVA
```
POST   /api/iktva/calculate        — حساب وحفظ النتيجة
GET    /api/iktva/history          — سجل الحسابات السابقة
```

---

## 6. ENVIRONMENT VARIABLES (.env)

```env
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/thevalvehubs

# JWT
JWT_SECRET=your-super-secret-key-minimum-32-chars
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=another-secret-key
REFRESH_TOKEN_EXPIRES_IN=30d

# Moyasar (Payment Gateway)
MOYASAR_API_KEY=sk_live_xxxxxxxxxxxx
MOYASAR_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
MOYASAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# ZATCA (e-Invoice)
ZATCA_ENVIRONMENT=sandbox          # sandbox | production
ZATCA_CERTIFICATE=-----BEGIN CERTIFICATE-----...
ZATCA_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
ZATCA_OTP=xxxxxx                   # One-time password from ZATCA portal

# AWS
AWS_REGION=me-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=thevalvehubs-files

# Email (Amazon SES)
SES_FROM_EMAIL=noreply@thevalvehubs.com
SES_REGION=me-south-1

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Frontend URL
FRONTEND_URL=http://localhost:5500
```

---

## 7. ZATCA e-INVOICE متطلبات خاصة

| المتطلب | التفاصيل |
|---|---|
| **التسجيل** | سجّل في بوابة fatoora.zatca.gov.sa |
| **الشهادة الرقمية** | ZATCA تصدر شهادة X.509 لكل منشأة |
| **صيغة الفاتورة** | XML بمعيار UBL 2.1 |
| **QR Code** | إلزامي على كل فاتورة (Base64 TLV encoding) |
| **التوقيع الرقمي** | كل فاتورة تُوقَّع بالمفتاح الخاص |
| **الإرسال** | real-time لفواتير B2B، batch لـ B2C |
| **الأرشفة** | الاحتفاظ بالفواتير 6 سنوات على الأقل |

---

## 8. SECURITY REQUIREMENTS

```
✓ HTTPS إلزامي — لا يعمل الموقع بدونه في Production
✓ Rate limiting — الحد: 100 طلب/دقيقة لكل IP
✓ Helmet.js — Security headers (XSS, CSRF, HSTS)
✓ Input validation — كل بيانات واردة تُتحقق منها بـ Zod
✓ SQL Injection حماية — Prisma يمنعها تلقائياً
✓ Password hashing — bcrypt بـ salt rounds 12
✓ JWT في HttpOnly Cookie — لا localStorage
✓ CORS مقيّد — فقط النطاقات المعتمدة
✓ Audit log — تسجيل جميع العمليات الحساسة
✓ Environment variables — لا secrets في الكود
```

---

## 9. FOLDER STRUCTURE (هيكل المشروع)

```
thevalvehubs-backend/
│
├── prisma/
│   ├── schema.prisma          ← تعريف الـ 21 جدول
│   └── migrations/            ← تاريخ تغييرات الـ DB
│
├── src/
│   ├── config/
│   │   ├── database.js        ← Prisma client
│   │   ├── aws.js             ← AWS SDK config
│   │   └── constants.js       ← VAT rate, limits, etc.
│   │
│   ├── middleware/
│   │   ├── auth.js            ← JWT verification
│   │   ├── validate.js        ← Zod validation
│   │   ├── rateLimiter.js     ← Rate limiting
│   │   └── errorHandler.js    ← Global error handler
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── company.routes.js
│   │   ├── supplier.routes.js
│   │   ├── subscription.routes.js
│   │   ├── payment.routes.js
│   │   ├── rfq.routes.js
│   │   ├── emergency.routes.js
│   │   ├── project.routes.js
│   │   └── iktva.routes.js
│   │
│   ├── controllers/           ← منطق كل endpoint
│   ├── services/
│   │   ├── moyasar.service.js ← الدفع
│   │   ├── zatca.service.js   ← الفاتورة الإلكترونية
│   │   ├── whatsapp.service.js← التنبيهات
│   │   ├── email.service.js   ← الإيميلات
│   │   └── s3.service.js      ← رفع الملفات
│   │
│   └── utils/
│       ├── invoiceNumber.js   ← توليد رقم الفاتورة
│       ├── vatCalculator.js   ← حساب 15% VAT
│       └── logger.js          ← Winston logger
│
├── tests/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── server.js                  ← نقطة البداية
```

---

## 10. SUMMARY — ما تحتاجه الآن

### تثبيت على جهازك (مرة واحدة)
- [ ] Node.js v20 LTS
- [ ] PostgreSQL 16 + pgAdmin
- [ ] Git
- [ ] VS Code + Extensions
- [ ] Postman

### حسابات تفتحها الآن
- [ ] GitHub (مجاني)
- [ ] Moyasar (مجاني)
- [ ] AWS (بطاقة ائتمان — free tier للبداية)
- [ ] ZATCA Developer Portal (مجاني)

### حسابات تفتحها عند الإطلاق
- [ ] WhatsApp Business API
- [ ] SendGrid أو Amazon SES
- [ ] Cloudflare
- [ ] Sentry

### معلومات قانونية تحتاجها
- [ ] رقم السجل التجاري (CR)
- [ ] رقم التسجيل في ZATCA (VAT)
- [ ] حساب بنكي تجاري
