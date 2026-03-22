
-- Fix saas_admin: only saas admins can read their own row
CREATE POLICY "Admin self-read" ON saas_admin
  FOR SELECT USING (user_id = auth.uid());
