

## Fix: Google Sign-In Button Not Responding on Published App

### Root Cause
The `handleGoogleSignIn` function in `Login.tsx` has no `try/catch` around the `lovable.auth.signInWithOAuth` call. If the underlying `@lovable.dev/cloud-auth-js` library throws an exception (e.g., network error, configuration issue on the published domain), the error is silently swallowed, `googleLoading` stays `false` (or gets stuck `true` after first click), and the button appears dead.

Additionally, there's no console logging to help diagnose what's happening.

### Fix (1 file)

**`src/pages/Login.tsx`** — Update `handleGoogleSignIn`:
- Wrap the entire OAuth call in a `try/catch` block
- Add `console.log` statements to trace the flow (what `result` comes back)
- Ensure `setGoogleLoading(false)` runs in a `finally` block so the button never gets stuck disabled
- Add `prompt: "select_account"` to `extraParams` to force the Google account picker (helps when there's a stale session)

```typescript
const handleGoogleSignIn = async () => {
  setGoogleLoading(true);
  setError("");
  try {
    console.log("Starting Google sign-in...");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    console.log("Google sign-in result:", result);
    if (result?.error) {
      setError(result.error.message || "Google sign-in failed");
    }
  } catch (err: any) {
    console.error("Google sign-in error:", err);
    setError(err?.message || "Google sign-in failed. Please try again.");
  } finally {
    setGoogleLoading(false);
  }
};
```

This will either fix the silent failure or surface the actual error message on screen and in console logs so we can diagnose the exact issue.

