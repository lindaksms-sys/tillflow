

## Add Serial Number and Batch Tracking to Inventory

### Overview
Add a `serial_items` table to track individual serial numbers and batch/lot numbers per product. Products can optionally be marked as "serialized" or "batch-tracked." When restocking, users enter serial numbers or batch info. When selling, specific serials/batches are selected and marked as sold.

### Database Changes

**1. New table: `serial_items`**
```sql
CREATE TABLE public.serial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  product_id uuid NOT NULL,
  serial_number text,          -- for per-unit tracking
  batch_number text,           -- for batch/lot tracking
  expiry_date date,            -- optional, mainly for batches
  status text NOT NULL DEFAULT 'in_stock',  -- in_stock, sold, damaged, returned
  sale_id uuid,                -- links to sale when sold
  received_at timestamptz DEFAULT now(),
  sold_at timestamptz,
  note text,
  CONSTRAINT serial_or_batch CHECK (serial_number IS NOT NULL OR batch_number IS NOT NULL)
);

ALTER TABLE public.serial_items ENABLE ROW LEVEL SECURITY;

-- RLS: business members can read
CREATE POLICY "Members read serial items" ON serial_items
  FOR SELECT USING (business_id = get_user_business_id());

-- RLS: owner/manager can insert
CREATE POLICY "Owner/manager insert serial items" ON serial_items
  FOR INSERT WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role_for_business(business_id) IN ('owner','manager')
  );

-- RLS: owner/manager can update (for marking sold/damaged)
CREATE POLICY "Owner/manager update serial items" ON serial_items
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND get_user_role_for_business(business_id) IN ('owner','manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role_for_business(business_id) IN ('owner','manager')
  );
```

**2. Add `tracking_type` column to `products`**
```sql
ALTER TABLE products ADD COLUMN tracking_type text NOT NULL DEFAULT 'none';
-- values: 'none', 'serial', 'batch'
```

### Frontend Changes

**3. Products page** — Add a "Tracking" dropdown (None / Serial / Batch) in the add/edit product form.

**4. Stock page — Restock flow** — When restocking a serialized product, show a text area to enter serial numbers (one per line). For batch products, show batch number + optional expiry date + quantity fields. Each entry creates rows in `serial_items`.

**5. Stock page — Serial/Batch viewer** — Add a tab or expandable section on each product card to view its serial numbers or batches with status (in stock / sold / damaged).

**6. Sales page** — When adding a serialized product to cart, prompt user to select which serial number(s) to sell. For batch products, auto-pick from oldest batch (FIFO). On sale completion, mark selected `serial_items` as `sold` with the `sale_id`.

**7. Stock adjustment** — When marking spoilage/theft on a serialized product, allow selecting which specific serials are affected and update their status to `damaged`.

### Files Changed

| File | Action |
|------|--------|
| Migration | Create `serial_items` table, add `tracking_type` to products |
| `src/lib/supabase-helpers.ts` | Add `SerialItem` type, update `Product` type |
| `src/pages/Products.tsx` | Add tracking type selector in product form |
| `src/pages/Stock.tsx` | Serial/batch entry on restock, viewer per product |
| `src/pages/Sales.tsx` | Serial selection when adding tracked products to cart |

