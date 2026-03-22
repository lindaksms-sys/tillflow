
-- 1. Create the new scoped role function
CREATE OR REPLACE FUNCTION public.get_user_role_for_business(p_business_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM business_members
  WHERE user_id = auth.uid()
    AND business_id = p_business_id
    AND is_active = TRUE
  LIMIT 1;
$$;

-- 2. Update all RLS policies that use get_user_role()

-- stock_levels: Owner/manager write stock
DROP POLICY IF EXISTS "Owner/manager write stock" ON stock_levels;
CREATE POLICY "Owner/manager write stock" ON stock_levels
FOR INSERT TO public
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- stock_levels: Owner/manager update stock
DROP POLICY IF EXISTS "Owner/manager update stock" ON stock_levels;
CREATE POLICY "Owner/manager update stock" ON stock_levels
FOR UPDATE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- credit_payments: Members insert credit payments
DROP POLICY IF EXISTS "Members insert credit payments" ON credit_payments;
CREATE POLICY "Members insert credit payments" ON credit_payments
FOR INSERT TO public
WITH CHECK (
  business_id = get_user_business_id()
  AND (
    get_user_role_for_business(business_id) IN ('owner', 'manager')
    OR (
      get_user_role_for_business(business_id) = 'cashier'
      AND (SELECT allow_cashier_record_payments FROM business_profiles WHERE id = get_user_business_id())
    )
  )
);

-- promotions: Owner/manager manage promotions
DROP POLICY IF EXISTS "Owner/manager manage promotions" ON promotions;
CREATE POLICY "Owner/manager manage promotions" ON promotions
FOR ALL TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- expenses: Owner/manager manage expenses
DROP POLICY IF EXISTS "Owner/manager manage expenses" ON expenses;
CREATE POLICY "Owner/manager manage expenses" ON expenses
FOR ALL TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- credit_sales: Owner/manager update credit sales
DROP POLICY IF EXISTS "Owner/manager update credit sales" ON credit_sales;
CREATE POLICY "Owner/manager update credit sales" ON credit_sales
FOR UPDATE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- credit_sales: Owner/manager insert credit sales
DROP POLICY IF EXISTS "Owner/manager insert credit sales" ON credit_sales;
CREATE POLICY "Owner/manager insert credit sales" ON credit_sales
FOR INSERT TO public
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- sales: Owner/manager update sales
DROP POLICY IF EXISTS "Owner/manager update sales" ON sales;
CREATE POLICY "Owner/manager update sales" ON sales
FOR UPDATE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- credit_customers: Owner/manager write credit customers
DROP POLICY IF EXISTS "Owner/manager write credit customers" ON credit_customers;
CREATE POLICY "Owner/manager write credit customers" ON credit_customers
FOR INSERT TO public
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- credit_customers: Owner/manager update credit customers
DROP POLICY IF EXISTS "Owner/manager update credit customers" ON credit_customers;
CREATE POLICY "Owner/manager update credit customers" ON credit_customers
FOR UPDATE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- business_members: Owner manages members
DROP POLICY IF EXISTS "Owner manages members" ON business_members;
CREATE POLICY "Owner manages members" ON business_members
FOR ALL TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) = 'owner'
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) = 'owner'
);

-- products: Owner/manager write products
DROP POLICY IF EXISTS "Owner/manager write products" ON products;
CREATE POLICY "Owner/manager write products" ON products
FOR INSERT TO public
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- products: Owner/manager update products
DROP POLICY IF EXISTS "Owner/manager update products" ON products;
CREATE POLICY "Owner/manager update products" ON products
FOR UPDATE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- products: Owner/manager delete products
DROP POLICY IF EXISTS "Owner/manager delete products" ON products;
CREATE POLICY "Owner/manager delete products" ON products
FOR DELETE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- 3. Update record_credit_payment to use the new function
CREATE OR REPLACE FUNCTION public.record_credit_payment(
  p_credit_sale_id UUID,
  p_business_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_received_by UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role TEXT;
  v_allow_cashier_payments BOOLEAN;
  v_credit_sale credit_sales%ROWTYPE;
  v_new_amount_paid NUMERIC;
  v_new_status TEXT;
BEGIN
  IF p_received_by != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: received_by must be the authenticated user';
  END IF;

  SELECT get_user_role_for_business(p_business_id) INTO v_user_role;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: not a member of this business';
  END IF;

  IF v_user_role = 'cashier' THEN
    SELECT allow_cashier_record_payments INTO v_allow_cashier_payments
    FROM business_profiles
    WHERE id = p_business_id;

    IF NOT COALESCE(v_allow_cashier_payments, false) THEN
      RAISE EXCEPTION 'Access denied: cashiers are not permitted to record payments';
    END IF;
  END IF;

  SELECT * INTO v_credit_sale
  FROM credit_sales
  WHERE id = p_credit_sale_id
    AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit sale not found';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_amount > v_credit_sale.balance THEN
    RAISE EXCEPTION 'Payment exceeds outstanding balance';
  END IF;

  v_new_amount_paid := v_credit_sale.amount_paid + p_amount;

  IF v_new_amount_paid >= v_credit_sale.amount THEN
    v_new_status := 'paid';
  ELSIF v_new_amount_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'outstanding';
  END IF;

  INSERT INTO credit_payments (
    business_id, credit_sale_id, amount,
    payment_method, received_by
  ) VALUES (
    p_business_id, p_credit_sale_id, p_amount,
    p_payment_method, p_received_by
  );

  UPDATE credit_sales
  SET amount_paid = v_new_amount_paid,
      status = v_new_status
  WHERE id = p_credit_sale_id;

  UPDATE credit_customers
  SET total_outstanding = total_outstanding - p_amount
  WHERE id = v_credit_sale.customer_id;

  RETURN json_build_object(
    'success', true,
    'new_status', v_new_status,
    'new_balance', v_credit_sale.amount - v_new_amount_paid,
    'recorded_by_role', v_user_role
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
