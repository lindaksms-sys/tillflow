

## Implement Free Plan with Restrictions + Auto-Downgrade

Based on the pricing screenshot, the Free Plan restrictions are:
- Basic POS — cash only
- Up to 50 products
- 1 staff member
- 7-day sales history
- Credit client tracking (basic)

### What needs to change

**1. Update `check-plan-expiry` edge function**
- Also downgrade expired trials: where `plan = 'trial'` and `trial_ends_at < now()` → set `plan = 'free'`
- Also sync `clients` table: set `status = 'free'` for downgraded businesses

**2. Update `App.tsx` — stop blocking expired trials**
- Currently line 73 blocks users when trial expires. Instead, let them through with `plan = 'free'` (after the cron runs)
- For immediate frontend handling: if `plan === 'trial'` and trial has passed, treat as `'free'` in the UI
- Only block for `plan === 'expired'` (expired Pro)

**3. Create `usePlanLimits` hook**
Returns computed limits based on current plan:
- `isFree`: boolean
- `maxProducts`: 50 or unlimited
- `maxStaff`: 1 or 10
- `salesHistoryDays`: 7 or unlimited
- `allowedPaymentMethods`: `['cash']` or `['cash', 'card', 'mobile_money']`
- `hasInsights`: boolean
- `hasReceiptScan`: boolean
- `hasBulkUpload`: boolean

**4. Enforce limits across pages**

| Page/Feature | Free restriction | Implementation |
|---|---|---|
| Products | Max 50 products | Disable "Add Product" button + show upgrade nudge when at 50 |
| Sales (POS) | Cash only | Hide card/mobile money payment options, show lock icon + upgrade nudge |
| Staff | Max 1 member | Hide "Invite Staff" when 1 member exists |
| Insights | Blocked | Show upgrade wall instead of insights page |
| Sales history | 7 days only | Filter queries to last 7 days, show "Upgrade for full history" |
| Receipt scan | Blocked | Show upgrade nudge on scan button |
| Bulk stock upload | Blocked | Disable bulk upload option |

**5. Add `FreePlanBanner` component**
Replaces `TrialBanner` for free users: "You're on the Free plan — Upgrade to Pro for full access →"

**6. Update `TrialExpired` component**
- Rename/refactor: show different messages for expired Pro vs free plan nudge
- Free plan users should NOT be blocked — they get limited access
- Only expired Pro users see the blocking screen

**7. Database migration**
- Update `check-plan-expiry` to handle trial→free transition
- No new columns needed — `plan = 'free'` is a new valid value

### Files changed/created

| File | Action |
|---|---|
| `supabase/functions/check-plan-expiry/index.ts` | Add trial→free downgrade + clients sync |
| `src/hooks/usePlanLimits.tsx` | New — computed plan limits |
| `src/App.tsx` | Allow free plan users through (don't block) |
| `src/components/TrialBanner.tsx` | Handle free plan banner variant |
| `src/components/TrialExpired.tsx` | Only block expired Pro, not free |
| `src/pages/Products.tsx` | Enforce 50-product limit |
| `src/pages/Sales.tsx` | Cash-only for free plan |
| `src/pages/Staff.tsx` | 1-member limit |
| `src/pages/Insights.tsx` | Upgrade wall for free plan |
| `src/components/UpgradeNudge.tsx` | New — reusable "Upgrade to unlock" component |
| Migration | Downgrade existing expired trials to `'free'` |

