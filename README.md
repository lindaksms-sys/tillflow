# TillFlow

Mobile-first retail operations application with AI-assisted supplier receipt processing, built by Linda Kisimisi.

## Problem and solution

Retail and hospitality businesses need to connect supplier purchases, product stock and sales records. TillFlow combines point-of-sale, inventory, stock taking, expenses and reports. Its receipt workflow turns an uploaded image into suggested line items while leaving product matching and inventory updates under human control.

[Published Lovable preview](https://id-preview--e8d71aa3-53b2-46bd-a3c2-ffe08513a237.lovable.app)

The configured custom domain is `tillflow.creativehauz.space` in the application metadata and Supabase auth configuration. Its availability was not independently confirmed in this portfolio review.

## AI receipt workflow

1. An authenticated user captures or uploads a supplier receipt.
2. `scan-receipt` validates Supabase token claims, image presence, MIME type and a base64 size limit.
3. The Edge Function sends the image to `google/gemini-2.5-flash` through the Lovable AI Gateway and parses the structured response.
4. `ReceiptScanner.tsx` compares extracted product names with the business catalogue and offers candidate matches.
5. The user checks or edits quantities, prices and product matches.
6. Confirmed items create stock adjustments and update product stock. Extraction alone does not mutate inventory.

This workflow addresses receipt transcription and matching. Extraction accuracy and time saved have not been measured.

## Implemented product areas

POS sales, product management, stock taking and adjustments, barcode scanning, serial/batch tracking, credit customers, expenses, reports, staff access and business-scoped data.

## Architecture and stack

| Component | Implementation |
| --- | --- |
| Interface | React 18, TypeScript, Vite, React Router |
| State and UI | TanStack Query, Tailwind CSS, shadcn/ui |
| Identity and persistence | Supabase Auth, PostgreSQL and business-scoped policies |
| Server workflows | Deno Supabase Edge Functions |
| Receipt model | Gemini 2.5 Flash through Lovable AI Gateway |
| Supporting libraries | ZXing, jsPDF and Recharts |
| Check tooling | Vitest and Playwright configuration |

The receipt scanner orchestrates review in the browser; model credentials stay in the Edge Function. Database migrations define business membership and role-based access. Inventory writes occur in the confirmation handler and should not be described as one atomic server transaction.

## Security decisions and limitations

- Receipt scanning checks caller token claims before inference.
- Image inputs are limited by size and allowed MIME types.
- The model key and service-role credentials are server-held.
- Database migrations scope operational data by business and role.
- Human confirmation separates model output from stock mutation.
- The plan-expiry maintenance function uses service-role access without an in-function caller authorization check. Confirm its deployed gateway policy and restrict it to authorized maintenance callers.
- Authentication and MIME checks do not validate every model field or guarantee inventory consistency during partial writes.
- This is a source review. Deployed RLS, provider availability and transaction behavior were not independently tested.

See [security review](docs/security-review.md).

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Supply the public URL, project ID and publishable/anon key for a development Supabase project. `VITE_*` values are browser-visible. The tracked `.env` contains public configuration and is retained for connected deployment compatibility; local overrides and secrets are ignored.

For an independent backend, review migrations on a fresh development database and deploy the needed Edge Functions. Receipt scanning requires server-held `LOVABLE_API_KEY`; staff invitations and maintenance functions also need the appropriate Supabase runtime credentials. Admin statistics use `ADMIN_STATS_KEY`. Configure auth redirect URLs for the local and deployed app origins. Do not replay migrations against the existing production project.

```bash
npm run build
npm run test
npm run lint
```

Scripts and test tooling are present. The example test is a scaffold; it does not verify receipt quality or the inventory flow. This follow-up documentation review did not rerun application checks or make provider requests.

## Implementation evidence

- [Receipt authentication and inference](supabase/functions/scan-receipt/index.ts)
- [Product matching and confirmation](src/components/ReceiptScanner.tsx)
- [Business context](src/hooks/useBusiness.tsx)
- [Backend configuration](supabase/config.toml)
- [Database migrations](supabase/migrations)

The matching Lovable implementation and GitHub receipt files were compared. This update extends the existing `portfolio-readme` branch and PR #5 rather than creating a duplicate.
