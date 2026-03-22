-- Fix #2: Enforce user_id = auth.uid() on expense inserts
DROP POLICY IF EXISTS "Owner/manager manage expenses" ON expenses;

-- SELECT policy
CREATE POLICY "Owner/manager read expenses" ON expenses
FOR SELECT TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- INSERT policy: force user_id = auth.uid()
CREATE POLICY "Owner/manager insert expenses" ON expenses
FOR INSERT TO public
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
  AND user_id = auth.uid()
);

-- UPDATE policy
CREATE POLICY "Owner/manager update expenses" ON expenses
FOR UPDATE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
)
WITH CHECK (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);

-- DELETE policy
CREATE POLICY "Owner/manager delete expenses" ON expenses
FOR DELETE TO public
USING (
  business_id = get_user_business_id()
  AND get_user_role_for_business(business_id) IN ('owner', 'manager')
);