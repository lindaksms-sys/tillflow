

## Replace Flutterwave with "Contact Sales" Upgrade Flow

No Flutterwave code exists yet, so this is purely additive.

### Database Changes (1 migration)

1. Add `pro_expires_at` column to `business_profiles` (timestamptz, nullable)
2. Create `manual_payments` table:
   - `id` (uuid PK), `business_id` (uuid), `amount` numeric, `note` text, `activated_by` uuid, `created_at` timestamptz
   - RLS: admin-only read/insert (via `saas_admin` check)

### New Components

**`src/components/UpgradeModal.tsx`**
- Dialog with pricing info ($2.99/month) and 4 payment option cards (International Card/PayPal, Mobile Money, Bank Transfer, Other)
- WhatsApp CTA button: `wa.me/263XXXXXXXXX?text=...` with auto-filled business name + email from `useBusiness()` and `useAuth()`
- Email fallback: `mailto:info@creativehauz.space?subject=...&body=...`
- Footer help text
- Exported `useUpgradeModal` hook (open/close state) or simple props

### Updated Components

**`src/components/TrialBanner.tsx`** — "Upgrade" button opens UpgradeModal

**`src/components/TrialExpired.tsx`** — "Upgrade Now" button opens UpgradeModal

### Admin Page (`src/pages/Admin.tsx`) — Major Update

- Add search input (filter by business name or owner email — will need to join `business_members` or query separately)
- Per-business row shows: name, plan, `pro_expires_at`, color-coded status badge (green/yellow/red)
- "Activate Pro" button: sets `plan = 'pro'`, `pro_expires_at = now + 30 days`, inserts into `manual_payments`
- "Extend 30 days" button: adds 30 days to `pro_expires_at`, inserts log
- Payment note text field per activation
- Uses service-role via edge function or direct admin RLS (owner_id check won't work for admin — will use existing `saas_admin` policy + add UPDATE policy for admin on `business_profiles`)

Need an additional RLS policy: **Admin can update all business_profiles** (currently only owner can).

### Auto-Expiry — Cron Edge Function

**`supabase/functions/check-plan-expiry/index.ts`**
- Runs daily via `pg_cron`
- Queries `business_profiles` where `plan = 'pro'` and `pro_expires_at < now()`
- Sets `plan = 'expired'` for those businesses
- Uses service role key

### useBusiness Hook Update

- Expose `proExpiresAt` from business context
- Handle `plan === 'expired'` same as expired trial (show TrialExpired-like screen but with "Pro expired" messaging)

### Files Summary

| File | Action |
|------|--------|
| Migration | Add `pro_expires_at`, create `manual_payments` table, add admin UPDATE policy on `business_profiles` |
| `src/components/UpgradeModal.tsx` | New — modal with payment options + WhatsApp/email CTAs |
| `src/components/TrialBanner.tsx` | Update — wire upgrade button to modal |
| `src/components/TrialExpired.tsx` | Update — wire upgrade button to modal, handle expired pro |
| `src/pages/Admin.tsx` | Major update — search, activate/extend pro, payment notes, color-coded statuses |
| `src/hooks/useBusiness.tsx` | Add `proExpiresAt`, handle `expired` plan |
| `supabase/functions/check-plan-expiry/index.ts` | New — daily cron to downgrade expired pro plans |
| pg_cron setup | Schedule daily invocation |

### Question needed
- What WhatsApp number should the CTA link to?

