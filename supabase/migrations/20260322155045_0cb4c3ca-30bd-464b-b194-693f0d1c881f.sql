
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
  v_credit_sale credit_sales%ROWTYPE;
  v_new_amount_paid NUMERIC;
  v_new_status TEXT;
BEGIN
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
    'new_balance', v_credit_sale.amount - v_new_amount_paid
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
