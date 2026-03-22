
-- 1. BUSINESS PROFILES
CREATE TABLE business_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('retail', 'bar', 'both')),
  currency      TEXT NOT NULL DEFAULT 'USD',
  country       TEXT NOT NULL DEFAULT 'Zimbabwe',
  logo_url      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  plan          TEXT NOT NULL DEFAULT 'trial' 
                  CHECK (plan IN ('trial', 'starter', 'pro', 'business')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own business" ON business_profiles
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 2. BUSINESS MEMBERS
CREATE TABLE business_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  full_name   TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_member UNIQUE (business_id, user_id)
);

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

-- 3. HELPER FUNCTIONS (created before policies that use them)
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM business_members
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM business_members
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Business members policies
CREATE POLICY "Members see own business" ON business_members
  FOR SELECT USING (business_id = get_user_business_id());
CREATE POLICY "Owner manages members" ON business_members
  FOR ALL USING (
    business_id = get_user_business_id() 
    AND get_user_role() = 'owner'
  ) WITH CHECK (
    business_id = get_user_business_id() 
    AND get_user_role() = 'owner'
  );

-- 4. ADD business_id TO EXISTING TABLES (nullable first)
ALTER TABLE products          ADD COLUMN business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE stock_levels      ADD COLUMN business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE stock_adjustments ADD COLUMN business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE sales             ADD COLUMN business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE expenses          ADD COLUMN business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;
ALTER TABLE promotions        ADD COLUMN business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE;

-- 5. INDEXES
CREATE INDEX idx_business_members_user     ON business_members(user_id);
CREATE INDEX idx_business_members_business ON business_members(business_id);
CREATE INDEX idx_products_business         ON products(business_id);
CREATE INDEX idx_sales_business            ON sales(business_id);
CREATE INDEX idx_expenses_business         ON expenses(business_id);

-- 6. DROP OLD RLS POLICIES
DROP POLICY IF EXISTS "Users manage own products" ON products;
DROP POLICY IF EXISTS "Users manage own stock levels" ON stock_levels;
DROP POLICY IF EXISTS "Users manage own stock adjustments" ON stock_adjustments;
DROP POLICY IF EXISTS "Users manage own sales" ON sales;
DROP POLICY IF EXISTS "Users manage own sale items" ON sale_items;
DROP POLICY IF EXISTS "Users manage own expenses" ON expenses;
DROP POLICY IF EXISTS "Users manage promotions for own products" ON promotions;

-- 7. NEW RLS POLICIES (business_id scoped)

-- Products
CREATE POLICY "Members read products" ON products
  FOR SELECT USING (business_id = get_user_business_id());
CREATE POLICY "Owner/manager write products" ON products
  FOR INSERT WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );
CREATE POLICY "Owner/manager update products" ON products
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );
CREATE POLICY "Owner/manager delete products" ON products
  FOR DELETE USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- Stock levels
CREATE POLICY "Members read stock" ON stock_levels
  FOR SELECT USING (business_id = get_user_business_id());
CREATE POLICY "Owner/manager write stock" ON stock_levels
  FOR INSERT WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );
CREATE POLICY "Owner/manager update stock" ON stock_levels
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- Stock adjustments
CREATE POLICY "Members insert adjustments" ON stock_adjustments
  FOR INSERT WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "Members read adjustments" ON stock_adjustments
  FOR SELECT USING (business_id = get_user_business_id());

-- Sales
CREATE POLICY "Members insert sales" ON sales
  FOR INSERT WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "Members read sales" ON sales
  FOR SELECT USING (business_id = get_user_business_id());
CREATE POLICY "Owner/manager update sales" ON sales
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- Sale items (filtered through sales join, but needs own policies)
CREATE POLICY "Members read sale items" ON sale_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.business_id = get_user_business_id()
  ));
CREATE POLICY "Members insert sale items" ON sale_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.business_id = get_user_business_id()
  ));

-- Expenses
CREATE POLICY "Owner/manager manage expenses" ON expenses
  FOR ALL USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- Promotions
CREATE POLICY "Owner/manager manage promotions" ON promotions
  FOR ALL USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- 8. SAAS ADMIN TABLE
CREATE TABLE saas_admin (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id)
);
ALTER TABLE saas_admin ENABLE ROW LEVEL SECURITY;

-- 9. UPDATE STOCK LEVEL TRIGGER to include business_id
CREATE OR REPLACE FUNCTION public.create_stock_level_for_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.stock_levels (product_id, quantity, business_id) VALUES (NEW.id, 0, NEW.business_id);
  RETURN NEW;
END;
$function$;
