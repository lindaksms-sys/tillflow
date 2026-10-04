# TillFlow

Mobile-first retail operations platform combining point-of-sale, inventory management, reporting, and AI-assisted receipt processing.

## Overview

TillFlow is designed for small retail and hospitality businesses that need one operational view of products, stock, sales, expenses, and day-to-day business activity.

A key AI workflow converts supplier receipt images into structured inventory data. An authenticated Supabase Edge Function sends the receipt image to Gemini 2.5 Flash through the Lovable AI Gateway, extracts supplier and line-item data, and returns structured JSON for review before inventory is updated.

## Key features

- Point-of-sale and sales workflows
- Product and inventory management
- Stock taking and stock adjustments
- Barcode scanning
- Serial and batch tracking
- Expense tracking
- Business reports and dashboards
- Authenticated business access
- AI-assisted supplier receipt scanning
- Human review before AI-extracted items update stock
- Multi-business data model backed by Supabase

## AI receipt workflow

1. An authenticated user captures or uploads a supplier receipt.
2. The image is sent to a Supabase Edge Function.
3. Gemini 2.5 Flash extracts the supplier, products, quantities, and available unit prices.
4. Extracted product names are matched against the business product catalogue.
5. The user reviews and corrects the proposed matches.
6. Confirmed items create stock adjustments and update inventory quantities.

The workflow deliberately keeps a human confirmation step between AI extraction and inventory mutation.

## Tech stack

React, TypeScript, Vite, Supabase/PostgreSQL, Supabase Edge Functions, Gemini 2.5 Flash, TanStack Query, Tailwind CSS, shadcn/ui, ZXing, jsPDF, Vitest, and Playwright.

## Security and validation

The receipt-processing Edge Function validates the caller's Supabase authentication token before invoking the AI workflow. Uploaded images are checked against an allowed MIME-type list and size limit. Server-side API credentials are read from environment variables rather than embedded in application code.

## Running locally

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run build
npm run test
npm run lint
```

## Why I built it

Many small businesses still move supplier receipt data into inventory manually. TillFlow explores a practical use of multimodal AI where the model handles extraction while the business owner retains control over the final inventory update.

## Author

Built by Linda Kisimisi as an applied AI product and retail-operations project.
