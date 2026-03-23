

## Instant Pro Unlock Without Refresh

### Problem
When you activate Pro for a business via the Admin page, the business user's app still shows Free plan restrictions until they refresh. This is because `useBusiness` only fetches the plan on login/mount.

### Solution
Add a Realtime subscription on the `business_profiles` table inside the `BusinessProvider`. When the `plan` column changes (e.g. from `free` → `pro`), the provider automatically re-fetches — all components using `useBusiness()` and `usePlanLimits()` re-render instantly with the new plan.

### Steps

**1. Enable Realtime on `business_profiles`**
Database migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_profiles;
```

**2. Update `src/hooks/useBusiness.tsx`**
Add a `useEffect` that subscribes to Postgres changes on `business_profiles` filtered to the current `businessId`. On any `UPDATE` event, call `loadBusiness()` to refresh all plan-related state. Clean up the subscription on unmount.

### Files changed
| File | Action |
|------|--------|
| Migration | Enable realtime on `business_profiles` |
| `src/hooks/useBusiness.tsx` | Add realtime subscription (~15 lines) |

No other files need changes — `usePlanLimits`, `TrialBanner`, and all page-level restrictions already derive from `useBusiness()` reactively.

