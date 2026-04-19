
You currently have **$1 free monthly AI balance** included with Lovable Cloud (until early 2026). This project already uses AI for receipt scanning (`scan-receipt` edge function with Gemini 2.5 Flash) via the Lovable AI Gateway — no API key needed.

**Google Sign-In does NOT use AI credits.** OAuth is handled by Lovable Cloud's auth service, completely separate from AI usage.

### Where to check your AI balance
Settings → Cloud & AI balance (paid plans can top up; Free plan cannot add funds).

### Plan
No code changes needed — this is informational. If Google sign-in is still failing on the live URL, the issue is OAuth configuration (redirect URI / provider setup), not AI credits. To debug that, I'd need the actual error message or screenshot from the published site.
