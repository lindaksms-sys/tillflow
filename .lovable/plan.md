
Add Google Sign-In to the login page using Lovable Cloud's managed OAuth (no API keys needed).

## Plan

**1. Configure Social Login**
Run the Configure Social Login tool for Google. This installs `@lovable.dev/cloud-auth-js` and generates `src/integrations/lovable/index.ts` (already present in the project).

**2. Update `src/pages/Login.tsx`**
- Add a "Continue with Google" button below the email/password form, separated by a divider ("or")
- On click, call `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- Handle `result.error` (show error message) and `result.redirected` (return — browser handles redirect)
- Style the button with the Google logo and outline variant to match the dark glassmorphism theme

**3. Existing flow handles the rest**
- After Google redirects back, `useAuth`'s `onAuthStateChange` listener picks up the session
- New users with no `business_id` are routed to `Onboarding` automatically
- Returning users land on Dashboard

## Files Changed
| File | Action |
|------|--------|
| `src/pages/Login.tsx` | Add Google button + divider + handler |

No database changes, no new secrets — Lovable Cloud manages Google OAuth credentials by default.
