
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
  -- 1. Enforce received_by is the caller
  IF p_received_by != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: received_by must be the authenticated user';
  END IF;

  -- 2. Check caller's role in this business
  SELECT role INTO v_user_role
  FROM business_members
  WHERE user_id = auth.uid()
    AND business_id = p_business_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied: not a member of this business';
  END IF;

  -- 3. Check if cashiers are allowed to record payments
  IF v_user_role = 'cashier' THEN
    SELECT allow_cashier_record_payments INTO v_allow_cashier_payments
    FROM business_profiles
    WHERE id = p_business_id;

    IF NOT COALESCE(v_allow_cashier_payments, false) THEN
      RAISE EXCEPTION 'Access denied: cashiers are not permitted to record payments';
    END IF;
  END IF;

  -- 4. Lock and validate the credit sale
  SELECT * INTO v_credit_sale
  FROM credit_sales
  WHERE id = p_credit_sale_id
    AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit sale not found';
  END IF;

  -- 5. Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_amount > v_credit_sale.balance THEN
    RAISE EXCEPTION 'Payment exceeds outstanding balance';
  END IF;

  -- 6. Calculate new status
  v_new_amount_paid := v_credit_sale.amount_paid + p_amount;

  IF v_new_amount_paid >= v_credit_sale.amount THEN
    v_new_status := 'paid';
  ELSIF v_new_amount_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'outstanding';
  END IF;

  -- 7. All updates atomically
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
