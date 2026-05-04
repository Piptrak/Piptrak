# ============================================================
# PIPTRAK — Vercel Deployment Guide
# Full step-by-step to go live in under 30 minutes
# ============================================================

## STEP 1 — SUPABASE SETUP (10 min)

1. Go to https://supabase.com → New project
2. Name it "piptrak", choose a region close to your users
3. Copy your credentials:
   - Project URL: https://xxxx.supabase.co
   - Anon key: eyJ...
   - Service role key: eyJ... (keep secret!)

4. Go to SQL Editor → paste contents of:
   supabase/migrations/001_initial_schema.sql
   → Run it

5. Deploy Edge Functions:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook
   supabase functions deploy get-portal
   supabase functions deploy trade-webhook
   ```

---

## STEP 2 — STRIPE SETUP (10 min)

1. Go to https://stripe.com → Create account
2. Dashboard → Products → Add product for each plan:

   | Product        | Price    | Billing   | Copy Price ID |
   |----------------|----------|-----------|---------------|
   | Piptrak Pro    | $15/mo   | Monthly   | price_xxx     |
   | Piptrak Pro    | $135/yr  | Annual    | price_xxx     |
   | Piptrak Elite  | $39/mo   | Monthly   | price_xxx     |
   | Piptrak Elite  | $351/yr  | Annual    | price_xxx     |

3. Developers → Webhooks → Add endpoint:
   URL: https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
   Events to listen for:
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
   - checkout.session.completed

4. Copy the Webhook Signing Secret

---

## STEP 3 — ENVIRONMENT VARIABLES

### Supabase Edge Function secrets:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
supabase secrets set STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx
supabase secrets set STRIPE_ELITE_MONTHLY_PRICE_ID=price_xxx
supabase secrets set STRIPE_ELITE_ANNUAL_PRICE_ID=price_xxx
supabase secrets set APP_URL=https://piptrak.com
```

### Vercel environment variables (add in dashboard):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

---

## STEP 4 — VERCEL DEPLOYMENT (5 min)

1. Push your code to GitHub

2. Go to https://vercel.com → New Project → Import from GitHub

3. Framework: React (or Next.js if converted)
   Build command: npm run build
   Output directory: dist (or build)

4. Add environment variables from Step 3

5. Click Deploy → your app is live!

6. Add custom domain:
   Vercel Dashboard → Domains → Add piptrak.com
   Update your DNS:
   Type: A, Name: @, Value: 76.76.21.21
   Type: CNAME, Name: www, Value: cname.vercel-dns.com

---

## STEP 5 — POST-LAUNCH CHECKLIST

- [ ] Test signup flow end-to-end
- [ ] Test Stripe checkout with test card: 4242 4242 4242 4242
- [ ] Test webhook by simulating a payment in Stripe dashboard
- [ ] Verify plan upgrades update in Supabase profiles table
- [ ] Test broker CSV import
- [ ] Set up Stripe → email receipts
- [ ] Enable Supabase → email confirmations (Auth settings)
- [ ] Set up error monitoring (Sentry free tier)
- [ ] Set up uptime monitoring (UptimeRobot free tier)
- [ ] Submit sitemap to Google Search Console

---

## ESTIMATED COSTS AT LAUNCH

| Service       | Free Tier Limit        | Paid if exceeded   |
|---------------|------------------------|--------------------|
| Supabase      | 50,000 MAU, 500MB DB   | $25/mo             |
| Vercel        | Unlimited deployments  | $20/mo (Pro)       |
| Stripe        | No monthly fee         | 2.9% + 30¢/charge  |
| MetaApi       | 5 accounts free        | $30/mo             |

→ You can run Piptrak for $0/month until ~500 users.
→ At $15/user on Pro, 10 users covers all costs.
