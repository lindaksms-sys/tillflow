

## Fix: /accept-invite Page — Force Password Setup Before Access

### Problem
The current page processes the invite token **on mount** (calling `setSession` or `verifyOtp`), which authenticates the user immediately. If they navigate away before completing the form, they're logged in without credentials and can't log back in after signing out.

### Solution
Store the token on mount but **don't authenticate** until form submit. After setup, redirect to `/login` instead of dashboard.

### Changes (1 file: `src/pages/AcceptInvite.tsx`)

1. **On mount**: Extract token from URL hash or query params, store in state. Call `signOut()` to clear any existing session. Do NOT call `setSession` or `verifyOtp` yet. If no token found, show error with redirect to `/login`.

2. **Form**: Show full name, password (min 8 chars), confirm password, and "Set Up My Account" button. Match TillFlow dark theme with TF logo.

3. **On submit only**:
   - Validate passwords match and min 8 chars
   - Process token: `setSession` for hash tokens, `verifyOtp` for query tokens
   - Call `updateUser({ password, data: { full_name } })`
   - Update `business_members.full_name`
   - Sign out again
   - Show success toast: "Account created! You can now log in with your email and this password."
   - Redirect to `/login` after 2 seconds

4. **Styling**: Use TF branded logo circle at top, consistent with Login page dark theme.

