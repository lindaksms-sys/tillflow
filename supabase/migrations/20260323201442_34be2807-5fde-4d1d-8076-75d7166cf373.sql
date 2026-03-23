
-- Create clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid UNIQUE NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  owner text NOT NULL,
  email text NOT NULL,
  location text NOT NULL DEFAULT 'Zimbabwe',
  status text NOT NULL DEFAULT 'trial',
  signup_date date NOT NULL DEFAULT CURRENT_DATE,
  trial_end date,
  upgrade_date timestamptz,
  plan text,
  mrr numeric NOT NULL DEFAULT 0,
  features text
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Admin-only read
CREATE POLICY "Admin reads clients" ON public.clients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid()));

-- Admin-only insert/update
CREATE POLICY "Admin manages clients" ON public.clients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid()));

-- Service role can insert (for onboard_business function)
-- Using SECURITY DEFINER in the function handles this

-- Backfill existing businesses
INSERT INTO public.clients (business_id, name, owner, email, location, status, signup_date, trial_end)
SELECT bp.id, bp.name, bm.full_name, au.email, bp.country,
  bp.plan, bp.created_at::date, bp.trial_ends_at::date
FROM public.business_profiles bp
JOIN public.business_members bm ON bm.business_id = bp.id AND bm.role = 'owner'
JOIN auth.users au ON au.id = bp.owner_id;

-- Update onboard_business to insert into clients
CREATE OR REPLACE FUNCTION public.onboard_business(_name text, _type text, _currency text DEFAULT 'USD'::text, _country text DEFAULT 'Zimbabwe'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _biz_id UUID;
  _email TEXT;
BEGIN
  -- Create business profile
  INSERT INTO business_profiles (owner_id, name, type, currency, country)
  VALUES (_user_id, _name, _type, _currency, _country)
  RETURNING id INTO _biz_id;

  -- Add owner as member
  INSERT INTO business_members (business_id, user_id, role, full_name)
  VALUES (_biz_id, _user_id, 'owner', _name);

  -- Get user email
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;

  -- Insert into clients table for dashboard
  INSERT INTO clients (business_id, name, owner, email, location, status, signup_date, trial_end)
  VALUES (_biz_id, _name, _name, COALESCE(_email, ''), _country, 'trial', CURRENT_DATE, CURRENT_DATE + 14);

  -- Backfill existing data
  UPDATE products SET business_id = _biz_id WHERE user_id = _user_id AND business_id IS NULL;
  UPDATE sales SET business_id = _biz_id WHERE user_id = _user_id AND business_id IS NULL;
  UPDATE expenses SET business_id = _biz_id WHERE user_id = _user_id AND business_id IS NULL;
  UPDATE stock_levels SET business_id = _biz_id
    WHERE product_id IN (SELECT id FROM products WHERE user_id = _user_id) AND business_id IS NULL;
  UPDATE stock_adjustments SET business_id = _biz_id
    WHERE product_id IN (SELECT id FROM products WHERE user_id = _user_id) AND business_id IS NULL;
  UPDATE promotions SET business_id = _biz_id
    WHERE product_id IN (SELECT id FROM products WHERE user_id = _user_id) AND business_id IS NULL;

  RETURN _biz_id;
END;
$function$;
