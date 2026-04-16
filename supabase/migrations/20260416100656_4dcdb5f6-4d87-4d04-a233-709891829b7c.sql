
-- Create serial_items table
CREATE TABLE public.serial_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_number text,
  batch_number text,
  expiry_date date,
  status text NOT NULL DEFAULT 'in_stock',
  sale_id uuid REFERENCES sales(id),
  received_at timestamptz DEFAULT now(),
  sold_at timestamptz,
  note text,
  CONSTRAINT serial_or_batch CHECK (serial_number IS NOT NULL OR batch_number IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_serial_items_product ON serial_items(product_id);
CREATE INDEX idx_serial_items_business ON serial_items(business_id);
CREATE INDEX idx_serial_items_status ON serial_items(status);
CREATE INDEX idx_serial_items_batch ON serial_items(batch_number) WHERE batch_number IS NOT NULL;

-- Enable RLS
ALTER TABLE public.serial_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members read serial items" ON serial_items
  FOR SELECT USING (business_id = get_user_business_id());

CREATE POLICY "Owner/manager insert serial items" ON serial_items
  FOR INSERT WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role_for_business(business_id) IN ('owner','manager')
  );

CREATE POLICY "Owner/manager update serial items" ON serial_items
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND get_user_role_for_business(business_id) IN ('owner','manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role_for_business(business_id) IN ('owner','manager')
  );

-- Add tracking_type to products
ALTER TABLE products ADD COLUMN tracking_type text NOT NULL DEFAULT 'none';
