# ShopKeeper – Deployment Guide

Deploy the **backend** (Node/Express) and **frontend** (Vite/React) separately. Supabase is already hosted; no database deployment needed.

---

## 1. Backend deployment

The backend is a Node.js app. Use any host that runs Node (Railway, Render, Fly.io, a VPS, etc.).

### Build & run

- **Build:** `npm run build` (runs `tsc`, outputs to `dist/`)
- **Start:** `npm run start` (runs `node dist/server.js`)
- **Root:** run commands from the `backend` folder

### Environment variables (backend)

Set these on your backend host (do **not** commit real secrets).

| Variable | Required | Example | Notes |
|----------|----------|---------|--------|
| `PORT` | Yes | `3001` or host default | Host often sets this |
| `NODE_ENV` | Yes | `production` | |
| `JWT_SECRET` | Yes | long random string | Use a strong secret in production |
| `FRONTEND_URL` | Yes | `https://your-app.vercel.app` | Exact URL of your deployed frontend (for CORS) |
| `SUPABASE_URL` | Yes | `https://xxx.supabase.co` | From Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJ...` | From Supabase → Settings → API |
| `PAYSTACK_SECRET_KEY` | Optional | `sk_live_...` | If using Paystack |
| `PAYSTACK_WEBHOOK_SECRET` | Optional | | For webhooks |
| `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | Optional | | For forgot-password emails etc. |

### Example: Railway

1. Create a project, connect the repo, set **Root Directory** to `backend`.
2. Build: `npm run build`, Start: `npm run start`.
3. Add all env vars above; set `FRONTEND_URL` to your frontend URL.
4. Deploy; note the backend URL (e.g. `https://your-app.up.railway.app`).

### Example: Render

1. New **Web Service**, connect repo, **Root Directory** `backend`.
2. Build: `npm run build`, Start: `npm run start`.
3. Add env vars; set `FRONTEND_URL` to your frontend URL.
4. Deploy; note the backend URL.

---

## 2. Frontend deployment

The frontend is a static Vite app. Use Vercel, Netlify, Cloudflare Pages, or any static host.

### Build

- **Build:** `npm run build` (runs `tsc -b && vite build`, outputs to `frontend/dist/`)
- **Root:** run from the `frontend` folder

### Environment variables (frontend)

| Variable | Required | Example | Notes |
|----------|----------|---------|--------|
| `VITE_API_URL` | Yes (production) | `https://your-api.railway.app/api` | Full backend API base URL (no trailing slash) |

Build-time only: set these in the host’s “Environment variables” for the **build** step.

### Example: Vercel

1. Import the repo; set **Root Directory** to `frontend`.
2. Build: `npm run build`, Output: `dist` (Vite default).
3. Add env: `VITE_API_URL` = `https://your-backend-url/api`.
4. Deploy. Use the Vercel URL (e.g. `https://shopkeeper.vercel.app`) as `FRONTEND_URL` in the backend.

### Example: Netlify

1. Connect repo; **Base directory** `frontend`.
2. Build: `npm run build`, Publish directory: `frontend/dist`.
3. Add env: `VITE_API_URL` = `https://your-backend-url/api`.
4. Deploy. Use the Netlify URL as `FRONTEND_URL` in the backend.

---

## 3. After deployment

1. **CORS:** Backend uses `FRONTEND_URL` for allowed origins. Keep it exactly the same as the frontend URL (including `https://`).
2. **API URL:** Frontend must have `VITE_API_URL` pointing at the backend (e.g. `https://api.yoursite.com/api`). No trailing slash.
3. **Supabase:** Ensure all migrations are applied in the Supabase project (e.g. run SQL from `backend/supabase/migrations/` in the SQL Editor if needed).
4. **Paystack webhooks:** If you use payments, set the webhook URL to `https://your-backend-url/api/webhooks/paystack`.

---

## 4. Quick checklist

- [ ] Backend deployed; `PORT` / `NODE_ENV` / `JWT_SECRET` / `FRONTEND_URL` / Supabase vars set
- [ ] Frontend deployed with `VITE_API_URL` = backend API URL
- [ ] Backend `FRONTEND_URL` = frontend production URL
- [ ] Supabase migrations applied
- [ ] Test sign-in and main flows on the live URL
