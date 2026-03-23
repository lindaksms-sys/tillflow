

## Fix: Staff Invite Emails Linking to Wrong Domain

### Root Cause

The edge function source code on line 84 already has the correct URL (`https://tillflow.creativehauz.space/accept-invite`), but the **deployed** version of the function is stale — it still has the old URL. Edge functions serve the last **deployed** code, not what's in the project files.

### Fix

1. **Redeploy the `invite-staff` edge function** — this is the only step needed. The code is already correct; it just needs to be pushed to the live environment.

2. **Verify the auth configuration** — confirm the site URL and redirect URLs in the backend config are set to `tillflow.creativehauz.space` (already done in config.toml, but worth confirming it took effect).

No code changes required — just a redeployment.

