# KAYPITAL STUDIOS

Converted from the original Kaypital Music beat-store project. Same
skeleton (Vercel + Supabase auth/admin/storage), new purpose: a
clothing brand site for the ARCHIVE 001 collection. No payments yet —
Stripe has been removed entirely.

## What changed from the original project

- **Removed**: `beats.html`, `store.js` (old version), `success.html`,
  `api/checkout.js`, `api/webhook.js`, `api/fulfill.js`, the `stripe`
  dependency, and all beat/license/BPM/key copy.
- **Kept**: Supabase auth + `public.admins` gate, the Vercel API-route
  pattern, `config.js`'s public-key-only pattern, the single global
  `style.css`.
- **Added**: `products` / `product_variants` / `product_images` /
  `collections` / `site_content` tables (`supabase/schema.sql`),
  `shop.js` (public data layer), `shop.html`, `archive-001.html`,
  `product.html` (dynamic via `?slug=`), `lookbook.html`, `about.html`,
  `contact.html`, a reworked `admin.html`/`admin.js`, and
  `api/admin-products.js` (server-side delete-with-storage-cleanup).

## Setup

1. In Supabase SQL editor, run `supabase/schema.sql` on your existing
   project (it's additive — it doesn't touch `admins` or drop the old
   beat tables; see the comment at the bottom of the file for the
   manual cleanup once you've verified everything works).
2. Create the `product-images` storage bucket (public) if the SQL
   comment's bucket insert didn't run automatically.
3. Fill in `config.js` with your Supabase URL/anon key (same as
   before).
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your Vercel
   project env vars (drop `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
   — no longer used).
5. Add a `collections` row with slug `archive-001` (via the Supabase
   table editor, until a "Collections" admin tab is built) so
   `archive-001.html` has something to filter on.
6. `npm install && npm run dev`, then open `/admin.html`, sign in with
   your existing admin account, and add your first product.

## Still placeholder / needs your input

- `about.html` and `contact.html` have placeholder copy and generic
  email addresses — swap in the real brand story and the real contact
  info from the old site (not guessed here on purpose).
- `TStar-Bold.woff2` isn't included — drop your font file at
  `/fonts/TStar-Bold.woff2` for the `@font-face` in `style.css` to
  pick it up; it falls back to a system sans until then.
- `/product/[product]`-style routing was written as `/product.html?slug=`
  instead, since this project has no framework/router — Vercel can be
  configured to rewrite pretty URLs to this if you want that later.
- Collections admin UI (a "Collections" tab to create/edit
  `archive-001` etc. from the dashboard, instead of the Supabase table
  editor) isn't built yet — flagged in the original plan as a next
  step, not core to this pass.
