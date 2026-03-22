
-- 1. Credit Customers
CREATE TABLE credit_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  id_number TEXT,
  credit_limit NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  total_outstanding NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read credit customers" ON credit_customers
  FOR SELECT USING (business_id = get_user_business_id());

CREATE POLICY "Owner/manager write credit customers" ON credit_customers
  FOR INSERT WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "Owner/manager update credit customers" ON credit_customers
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- 2. Credit Sales
CREATE TABLE credit_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES credit_customers(id),
  sale_id UUID REFERENCES sales(id),
  amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance NUMERIC(10,2) GENERATED ALWAYS AS (amount - amount_paid) STORED,
  status TEXT DEFAULT 'outstanding',
  due_date DATE,
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read credit sales" ON credit_sales
  FOR SELECT USING (business_id = get_user_business_id());

CREATE POLICY "Members insert credit sales" ON credit_sales
  FOR INSERT WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "Owner/manager update credit sales" ON credit_sales
  FOR UPDATE USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  ) WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- 3. Credit Payments
CREATE TABLE credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  credit_sale_id UUID NOT NULL REFERENCES credit_sales(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  received_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read credit payments" ON credit_payments
  FOR SELECT USING (business_id = get_user_business_id());

CREATE POLICY "Members insert credit payments" ON credit_payments
  FOR INSERT WITH CHECK (business_id = get_user_business_id());

-- 4. Add credit settings columns to business_profiles
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS default_credit_limit NUMERIC(10,2) NOT NULL DEFAULT 50.00;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS max_cashier_credit_amount NUMERIC(10,2) NOT NULL DEFAULT 20.00;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS require_owner_approval_credit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS allow_cashier_record_payments BOOLEAN NOT NULL DEFAULT TRUE;

-- 5. Indexes
CREATE INDEX idx_credit_customers_business ON credit_customers(business_id);
CREATE INDEX idx_credit_sales_business ON credit_sales(business_id);
CREATE INDEX idx_credit_sales_customer ON credit_sales(customer_id);
CREATE INDEX idx_credit_payments_credit_sale ON credit_payments(credit_sale_id);
