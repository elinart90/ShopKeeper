# Supabase migrations

Run these in order in **Supabase Dashboard → SQL Editor** (same as the dashboard edit feature).

## Pending: `008_password_reset_pins.sql`

Creates the `password_reset_pins` table for the forgot-password flow.

**To run manually:**
1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Copy the contents of `migrations/008_password_reset_pins.sql`
3. Paste and run

**Or via npm (if `DATABASE_URL` is in `.env`):**
```bash
npm run db:migrate
```
Get `DATABASE_URL` from Supabase → Project Settings → Database → Connection string (URI).
