-- Fix 1: Restrict credit_sales INSERT to owner/manager only (cashiers use RPC)
DROP POLICY IF EXISTS "Members insert credit sales" ON credit_sales;
CREATE POLICY "Owner/manager insert credit sales" ON credit_sales
  FOR INSERT WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('owner', 'manager')
  );

-- Fix 2: Enforce allow_cashier_record_payments setting at DB level
DROP POLICY IF EXISTS "Members insert credit payments" ON credit_payments;
CREATE POLICY "Members insert credit payments" ON credit_payments
  FOR INSERT WITH CHECK (
    business_id = get_user_business_id()
    AND (
      get_user_role() IN ('owner', 'manager')
      OR (
        get_user_role() = 'cashier'
        AND (SELECT allow_cashier_record_payments FROM business_profiles WHERE id = get_user_business_id())
      )
    )
  );