
The custom domain `tillflow.creativehauz.space` is on Cloudflare. The `/~oauth/initiate` URL hits the SPA instead of the Lovable proxy worker — meaning Cloudflare is serving the request itself (likely from cache or via its proxy) and never reaching Lovable's edge where the `/~oauth/*` path interception happens.

### Root cause
When a custom domain is proxied through Cloudflare (orange cloud) without enabling Lovable's **Proxy Mode**, the OAuth proxy worker at `/~oauth/initiate` and `/~oauth/callback` is bypassed. Cloudflare strips/caches the request before Lovable can intercept it.

### Fix (no code changes — settings only)

1. **In Lovable** → Project Settings → Domains → remove `tillflow.creativehauz.space`, then re-add it via **Connect Domain**:
   - Expand **Advanced**
   - Check **"Domain uses Cloudflare or a similar proxy"**
   - This switches setup from A-record to CNAME-based verification compatible with Cloudflare proxy.

2. **In Cloudflare DNS** → replace the existing A record with the CNAME Lovable provides. Keep the orange cloud (proxied) ON.

3. **In Cloudflare → Rules / Page Rules / Cache** → ensure no rule caches `/~oauth/*`. Add a Cache Rule: bypass cache for URI path matches `/~oauth/*` if any aggressive caching is enabled.

4. Wait until the domain shows **Active** in Lovable Domains, then retest Google sign-in on `https://tillflow.creativehauz.space`.

### Verification
- `https://tillflow.creativehauz.space/~oauth/initiate?...` should redirect to `oauth.lovable.app` (not show a blank SPA).
- Google account picker appears → sign-in completes.

### Alternative
If you don't need the custom domain for OAuth specifically, keep using `https://tillflow.lovable.app` for sign-in — it works today.
