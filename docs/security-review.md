# Security review

Reviewed 4 October 2026 against the repository and corresponding Lovable receipt implementation.

## Controls observed

Receipt scanning validates Supabase claims, image length and MIME type before the Gemini call. The frontend requires human confirmation before inventory writes. Business membership and role policies are present in migrations. Server credentials come from environment variables.

## Findings

1. `supabase/functions/check-plan-expiry/index.ts` uses service-role writes without an in-function authorization check. Deployed gateway policy was not inspected. Restrict invocation to an authenticated maintenance principal and test unauthorized requests.
2. `src/components/ReceiptScanner.tsx` performs multiple inventory writes. Confirmation is not an atomic transaction; partial failures need reconciliation. Validate extracted quantities/prices and handle partial writes before treating the workflow as production-safe.
3. The tracked `.env` contains public frontend configuration; its JWT key role is `anon`, not `service_role`. Retaining it preserves deployment behavior. New local overrides should use ignored `.env.local` files.
4. Test tooling exists, but the example test is a scaffold. Provider accuracy and tenant isolation require dedicated runtime tests.

## Scope

Static current-source review, not a penetration test, history-wide secret scan, dependency vulnerability audit or live database-policy verification. No receipt was uploaded, inventory mutated or provider request made. This PR changes documentation, ignore rules and an environment example only; it does not fix or deploy the runtime issues above.
