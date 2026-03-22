

## Adding Google Sign-In and Phone Authentication to TillFlow

### Google Sign-In — Viable and straightforward

Lovable Cloud has **managed Google OAuth** built in, so no API keys or external setup are needed. This is fully viable.

**Steps:**
1. Run the **Configure Social Login** tool to generate the Lovable auth module for Google
2. Add a "Sign in with Google" button to the Login page that calls `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
3. Ensure the onboarding flow still triggers for new Google users (they won't have a business yet)

### Phone Number Authentication — Not viable

Phone/SMS authentication (OTP via text message) is **not supported** in Lovable Cloud. This would require a third-party SMS provider (like Twilio) and custom edge function infrastructure to handle OTP verification — significant complexity for uncertain benefit.

**Recommendation:** Skip phone auth and focus on Google sign-in, which covers the "easy signup" use case well.

---

### Implementation Plan

#### 1. Configure Google OAuth module
- Use the Configure Social Login tool to scaffold `src/integrations/lovable/` with the Google provider

#### 2. Update Login page
- Add a "Sign in with Google" button with the Google icon
- Place it above the email/password form with an "or" divider
- On click: call `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- Handle loading state during OAuth redirect

#### 3. Handle new Google users in onboarding
- The existing flow already redirects users without a business to `/onboarding` — verify this works for OAuth signups too
- Google provides `user.user_metadata.full_name` automatically, so pre-fill it during onboarding

#### Technical details
- No API keys needed — Lovable Cloud manages Google OAuth credentials automatically
- The `@lovable.dev/cloud-auth-js` package will be installed by the scaffold tool
- PWA consideration: the service worker's `sw.js` uses a basic fetch handler that shouldn't interfere, but if issues arise we may need to add `/~oauth` to a denylist

