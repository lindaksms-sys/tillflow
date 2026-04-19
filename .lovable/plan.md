
The user sees a blank `/~oauth/initiate` URL on their custom domain `tillflow.creativehauz.space`. This means the Lovable OAuth proxy worker is not intercepting the path on that custom domain — it's hitting the SPA, which has no route for it, so nothing happens.

Per Lovable docs: managed OAuth works on custom domains only when the domain is properly configured and **active** in Lovable settings. If the custom domain is inactive/misconfigured, the proxy worker won't intercept `/~oauth/initiate` and the OAuth flow breaks exactly like this.

The published URL is `tillflow.lovable.app`. The custom domain `tillflow.creativehauz.space` is referenced in `supabase/config.toml` and memory but is NOT listed as an active custom domain on the project (project_urls shows none).

### Fix
1. Test Google sign-in on `https://tillflow.lovable.app` — it should work there.
2. To make it work on `tillflow.creativehauz.space`, reconnect/activate that domain in **Project Settings → Domains** in Lovable. Once it shows status **Active**, the `/~oauth/initiate` proxy will work automatically.

No code changes needed.
