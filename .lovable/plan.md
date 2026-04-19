
## Root cause
The error `Unsupported provider: missing OAuth secret` comes from Supabase Auth when Google is enabled but the **Client Secret** field is empty. This happens when:
- Custom credentials toggle is ON but only Client ID was pasted (Secret missing/blank).
- Or credentials were saved with trailing whitespace / partial paste.

## Fix (settings only — no code change)

You have two paths. Pick one.

### Path 1 — Use Lovable's managed Google OAuth (easiest, recommended)
1. Open **Lovable → Cloud → Users → Auth Settings → Sign In Methods → Google**.
2. Toggle **"Use custom credentials"** OFF.
3. Save. Lovable's managed Google credentials will be used automatically — works on `tillflow.lovable.app` AND your active custom domain `tillflow.creativehauz.space`.
4. Retest sign-in.

### Path 2 — Keep your own Google credentials (BYOK)
1. Open **Lovable → Cloud → Users → Auth Settings → Google**.
2. Confirm **Client ID** is filled.
3. Paste the **Client Secret** from Google Cloud Console → APIs & Services → Credentials → your OAuth Client → click the client → copy **Client Secret** (if you lost it, click **Reset Secret** and copy the new one).
4. Make sure neither field has leading/trailing spaces.
5. Save → retest.

## Verification
- `https://tillflow.creativehauz.space` → Continue with Google → Google account picker → signed in.
- No `missing OAuth secret` error.

## Recommendation
Go with **Path 1** unless you specifically need branded Google credentials. The managed flow now works on your custom domain since you added it in Lovable.
