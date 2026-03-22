
-- Fix 1: Scope logo storage policies to owner's business
DROP POLICY IF EXISTS "Auth users upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users manage logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete logos" ON storage.objects;

CREATE POLICY "Owners upload own logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.business_profiles WHERE owner_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Owners update own logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.business_profiles WHERE owner_id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.business_profiles WHERE owner_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Owners delete own logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.business_profiles WHERE owner_id = auth.uid() LIMIT 1
    )
  );

-- Fix 2: Server-side credit sale validation RPC
CREATE OR REPLACE FUNCTION public.record_credit_sale(
  _customer_id uuid,
  _sale_id uuid,
  _amount numeric,
  _due_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _role text;
  _biz_id uuid;
  _settings record;
  _credit_sale_id uuid;
  _customer_outstanding numeric;
  _customer_limit numeric;
BEGIN
  -- Get caller's role and business
  SELECT role, business_id INTO _role, _biz_id
    FROM business_members
    WHERE user_id = _user_id AND is_active = TRUE
    LIMIT 1;

  IF _biz_id IS NULL THEN
    RAISE EXCEPTION 'No active business membership';
  END IF;

  -- Get business credit settings
  SELECT max_cashier_credit_amount, require_owner_approval_credit
    INTO _settings
    FROM business_profiles
    WHERE id = _biz_id;

  -- Enforce cashier restrictions
  IF _role = 'cashier' THEN
    IF _amount > _settings.max_cashier_credit_amount THEN
      RAISE EXCEPTION 'Amount exceeds cashier credit limit of %', _settings.max_cashier_credit_amount;
    END IF;
    IF _settings.require_owner_approval_credit THEN
      RAISE EXCEPTION 'Owner approval required for credit sales';
    END IF;
  END IF;

  -- Check customer credit limit
  SELECT total_outstanding, credit_limit INTO _customer_outstanding, _customer_limit
    FROM credit_customers
    WHERE id = _customer_id AND business_id = _biz_id;

  IF _customer_outstanding + _amount > _customer_limit THEN
    RAISE EXCEPTION 'Credit limit exceeded. Outstanding: %, Limit: %', _customer_outstanding, _customer_limit;
  END IF;

  -- Insert the credit sale
  INSERT INTO credit_sales (business_id, customer_id, sale_id, amount, created_by, approved_by, due_date)
  VALUES (
    _biz_id,
    _customer_id,
    _sale_id,
    _amount,
    _user_id,
    CASE WHEN _role IN ('owner', 'manager') THEN _user_id ELSE NULL END,
    _due_date
  )
  RETURNING id INTO _credit_sale_id;

  -- Update customer outstanding
  UPDATE credit_customers
    SET total_outstanding = total_outstanding + _amount
    WHERE id = _customer_id;

  RETURN _credit_sale_id;
END;
$$;
