

## Create `admin-stats` Edge Function for External Dashboard

### What it does
A secure API endpoint that returns aggregated TillFlow business data (signups, plan breakdowns, recent activity). Your dashboard Lovable project calls this endpoint to display stats — no direct database access needed.

### Security
- Protected by a shared API key (stored as a secret) — not public
- Returns only aggregated/read-only data
- No raw user credentials exposed

### Steps

**1. Add a secret: `ADMIN_STATS_KEY`**
A random API key that your dashboard will send in the `Authorization` header. Only requests with this key get data.

**2. Create edge function `supabase/functions/admin-stats/index.ts`**
- Validates `Authorization: Bearer <ADMIN_STATS_KEY>`
- Queries `business_profiles` for:
  - Total businesses count
  - Breakdown by plan (trial, pro, expired)
  - Recent signups (last 30 days with name, plan, created_at, trial_ends_at, pro_expires_at)
  - Businesses expiring in next 7 days
- Queries `manual_payments` for recent payment logs
- Queries `business_members` for total user count
- Returns JSON response

**3. In your dashboard Lovable project**
Call the endpoint:
```
GET https://cqlsebivxxngxxmysmdx.supabase.co/functions/v1/admin-stats
Authorization: Bearer <your-admin-stats-key>
```

### Response shape
```json
{
  "totals": { "businesses": 42, "users": 78 },
  "by_plan": { "trial": 30, "pro": 8, "expired": 4 },
  "expiring_soon": [ { "name": "...", "pro_expires_at": "...", "days_left": 3 } ],
  "recent_signups": [ { "name": "...", "plan": "trial", "created_at": "..." } ],
  "recent_payments": [ { "business_id": "...", "amount": 2.99, "note": "..." } ]
}
```

### Files
| File | Action |
|------|--------|
| `supabase/functions/admin-stats/index.ts` | New edge function |
| Secret: `ADMIN_STATS_KEY` | New — you choose the key value |

