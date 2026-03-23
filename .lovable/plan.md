

## Implement `clients` Table for Dashboard Sync

### Overview
Create a `clients` table that mirrors signup data for your external dashboard. Auto-populate on new signups, backfill existing businesses, and expose via `admin-stats`.

### 1. Database Migration

**Create `clients` table:**
- `id` uuid PK
- `business_id` uuid (references business_profiles, unique)
- `name` text (business name)
- `owner` text (full name)
- `email` text (user email)
- `location` text (country)
- `status` text (default `'trial'`)
- `signup_date` date
- `trial_end` date
- `upgrade_date` timestamptz nullable
- `plan` text nullable
- `mrr` numeric default 0
- `features` text nullable
- RLS: admin-only read (via `saas_admin` check), no public access

**Backfill existing businesses** (in same migration):
```sql
INSERT INTO clients (business_id, name, owner, email, location, status, signup_date, trial_end)
SELECT bp.id, bp.name, bm.full_name, au.email, bp.country,
  bp.plan, bp.created_at::date, (bp.trial_ends_at)::date
FROM business_profiles bp
JOIN business_members bm ON bm.business_id = bp.id AND bm.role = 'owner'
JOIN auth.users au ON au.id = bp.owner_id;
```

### 2. Update `onboard_business` DB Function

Add an `INSERT INTO clients` at the end of the function, using the user's email from `auth.users`, the business name, country, and computed trial end date.

### 3. Update `admin-stats` Edge Function

Add a query to return all `clients` rows so your dashboard can consume them directly:
```json
{ "clients": [{ "name": "...", "owner": "...", "email": "...", ... }] }
```

### 4. Update Admin Page (optional sync)

When admin activates Pro or extends, also update the matching `clients` row (`status`, `plan`, `upgrade_date`, `mrr`).

### Files Changed
| File | Action |
|------|--------|
| Migration | Create `clients` table + backfill + update `onboard_business` function |
| `supabase/functions/admin-stats/index.ts` | Add `clients` query to response |
| `src/pages/Admin.tsx` | Update `clients` row on Pro activation/extension |

Zero disruption to existing users — purely additive.

