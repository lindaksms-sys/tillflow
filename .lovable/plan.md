
User wants step-by-step Cloudflare CNAME instructions. This is a how-to guide, not a code change. Keep concise.

## Adding the CNAME for `tillflow.creativehauz.space` in Cloudflare

### Step 1 — Get the CNAME target from Lovable
1. In Lovable: **Project Settings → Domains**.
2. Remove `tillflow.creativehauz.space` if already added.
3. Click **Connect Domain** → enter `tillflow.creativehauz.space`.
4. Expand **Advanced** → check **"Domain uses Cloudflare or a similar proxy"**.
5. Lovable shows a CNAME target (looks like `xxx.lovable.app` or similar) and a TXT verification record. **Keep this dialog open** — you'll need both values.

### Step 2 — Open Cloudflare DNS
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Select the **creativehauz.space** zone.
3. Left sidebar → **DNS → Records**.

### Step 3 — Remove old conflicting records
Find any existing record where **Name = `tillflow`** (A, AAAA, or CNAME). Click **Edit → Delete**. Only one record can exist per subdomain.

### Step 4 — Add the CNAME record
Click **Add record**, then fill in:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `tillflow` (Cloudflare auto-appends `.creativehauz.space`) |
| Target | *(paste the CNAME target Lovable gave you)* |
| Proxy status | **Proxied** (orange cloud ON) |
| TTL | Auto |

Click **Save**.

### Step 5 — Add the TXT verification record
Click **Add record** again:

| Field | Value |
|---|---|
| Type | `TXT` |
| Name | `_lovable.tillflow` *(or whatever Lovable shows)* |
| Content | *(paste the `lovable_verify=...` value)* |
| TTL | Auto |

Click **Save**.

### Step 6 — Cloudflare SSL setting (important)
Sidebar → **SSL/TLS → Overview** → set encryption mode to **Full** or **Full (strict)**. *Flexible* will break the site.

### Step 7 — Verify in Lovable
1. Return to the Lovable Domains dialog → click **Verify** / wait.
2. Status progresses: Verifying → Setting up → **Active** (usually 5–30 min, can be up to 72h).

### Step 8 — Test Google sign-in
Once status is **Active**, open `https://tillflow.creativehauz.space`, click Sign in with Google. The `/~oauth/initiate` URL should now redirect to `oauth.lovable.app` and show the Google account picker.

### If it still fails after Active
- Cloudflare → **Caching → Configuration → Purge Everything**.
- Cloudflare → **Rules → Cache Rules** → add: *If URI Path matches `/~oauth/*` → Bypass cache*.
