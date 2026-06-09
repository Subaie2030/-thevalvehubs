# TheValveHubs — Backend Setup Guide
## From Zero to Live in ~10 Minutes

---

## STEP 1 — Create Free Neon Database (2 min)

1. Go to **https://neon.tech** → Sign up free (no credit card)
2. Click **"New Project"**
3. Name: `thevalvehubs` / Region: `AWS EU West (Ireland)` or `US East`
4. Click **"Create Project"**
5. Copy the **Connection String** — it looks like:
   ```
   postgresql://username:password@ep-xxx-xxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
   ```

---

## STEP 2 — Run the Database Schema (2 min)

1. In Neon dashboard → click **"SQL Editor"**
2. Paste the entire contents of `db/schema.sql`
3. Click **"Run"** — it creates all 21 tables + indexes + seed data
4. You should see: `INSERT 0 4` (subscription plans) and `INSERT 0 1` (admin user)

---

## STEP 3 — Add Environment Variables to Netlify (3 min)

1. Go to **https://app.netlify.com** → Your site → **"Site Settings"**
2. Click **"Environment Variables"** → **"Add a variable"**
3. Add these variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string from Step 1 |
| `JWT_SECRET` | Any 64+ character random string (generate below) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |

**Generate a JWT secret:**
Open browser console and run:
```javascript
Array.from(crypto.getRandomValues(new Uint8Array(64))).map(b=>b.toString(16).padStart(2,'0')).join('')
```

---

## STEP 4 — Install Dependencies & Deploy (2 min)

In your project folder (terminal):
```bash
npm install
git add -A
git commit -m "feat: add Netlify Functions backend"
git push
```

Netlify auto-deploys from GitHub. The functions will be live at:
`https://your-site.netlify.app/api/...`

---

## STEP 5 — Test the Backend (1 min)

Test in browser or Postman:

```bash
# Health check — list plans (public)
GET https://your-site.netlify.app/api/plans

# Register a user
POST https://your-site.netlify.app/api/auth/register
{
  "email": "test@example.com",
  "password": "Test1234!",
  "role": "supplier",
  "nameEn": "Test Supplier",
  "companyName": "Test Company SA"
}

# Login
POST https://your-site.netlify.app/api/auth/login
{
  "email": "test@example.com",
  "password": "Test1234!"
}
```

---

## Admin Account

Default admin:
- **Email**: admin@thevalvehubs.com
- **Password**: TVH@Admin2026!
- ⚠️ **Change immediately after first login**

Admin panel: `your-site.netlify.app/admin.html`

---

## API Endpoints Quick Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Get my profile |
| GET | `/api/suppliers` | No | List suppliers |
| GET | `/api/suppliers/:id` | No | Get supplier |
| POST | `/api/suppliers/profile` | Yes | Update supplier profile |
| GET | `/api/rfqs` | Yes | List RFQs |
| POST | `/api/rfqs` | Yes | Create RFQ |
| POST | `/api/rfqs/emergency` | No | Submit emergency |
| GET | `/api/projects` | No | List projects |
| POST | `/api/iktva/calculate` | No | Calculate IKTVA |
| GET | `/api/plans` | No | List pricing plans |
| GET | `/api/admin/stats` | Admin | Dashboard stats |

---

## Local Development

```bash
npm install -g netlify-cli
netlify dev
```

Then test at `http://localhost:8888/api/...`

Create `.env` file (copy from `.env.example`) with your Neon DATABASE_URL.

---

## Troubleshooting

**Function returns 500:**
- Check Netlify dashboard → Functions tab → View logs
- Most common: DATABASE_URL not set or wrong format

**"relation does not exist":**
- Run schema.sql in Neon SQL Editor

**CORS error:**
- CORS headers are already set in `_cors.js` and `netlify.toml`
- If still failing, check browser console for the exact error
