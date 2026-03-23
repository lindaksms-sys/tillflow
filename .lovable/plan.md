

## Flutterwave Payment Integration for TillFlow

### Overview
Integrate Flutterwave to handle subscription payments (trial → paid plan upgrades). Flutterwave covers 30+ African countries with cards, mobile money, bank transfers, and USSD.

### Architecture

```text
User clicks "Upgrade" → Edge Function creates Flutterwave payment link → User pays on Flutterwave hosted page → Flutterwave webhook → Edge Function verifies & activates plan
```

### Steps

**1. Store Flutterwave API keys as secrets**
- `FLW_SECRET_KEY` — your Flutterwave secret key (from dashboard.flutterwave.com)
- `FLW_WEBHOOK_HASH` — webhook verification hash

**2. Create `create-checkout` edge function**
- Accepts `business_id` and `plan` from authenticated user
- Calls Flutterwave's `/v3/payments` API to generate a hosted payment link
- Sets amount based on plan (e.g. $9.99/month for "starter", $24.99 for "pro")
- Passes `redirect_url` back to `https://tillflow.creativehauz.space/settings?payment=success`
- Returns the Flutterwave checkout URL to the frontend

**3. Create `flutterwave-webhook` edge function**
- Receives Flutterwave payment notifications
- Verifies webhook hash for security
- Calls Flutterwave `/v3/transactions/{id}/verify` to confirm payment
- Updates `business_profiles.plan` from `"trial"` to the paid plan
- Optionally sets `trial_ends_at = null`

**4. Add `subscriptions` table (migration)**
- Columns: `id`, `business_id`, `flw_transaction_id`, `plan`, `amount`, `currency`, `status`, `paid_at`, `expires_at`
- RLS: owner can read own business subscriptions

**5. Update frontend**
- **TrialBanner**: "Upgrade" button calls `create-checkout` and redirects to Flutterwave
- **TrialExpired**: "Upgrade Now" button does the same
- **Settings**: Plan section shows current plan status and payment history
- **Settings**: Handle `?payment=success` query param to show success toast and refresh plan

### Pricing tiers (configurable)
- **Starter**: $9.99/month — up to 3 staff, 500 products
- **Pro**: $24.99/month — unlimited staff & products, priority support

These are initial values; you can adjust them before we build.

### Files changed/created
- `supabase/functions/create-checkout/index.ts` (new)
- `supabase/functions/flutterwave-webhook/index.ts` (new)
- `src/components/TrialBanner.tsx` (update)
- `src/components/TrialExpired.tsx` (update)
- `src/pages/Settings.tsx` (update)
- 1 database migration for `subscriptions` table

