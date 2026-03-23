
-- Add pro_expires_at to business_profiles
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS pro_expires_at timestamptz DEFAULT NULL;

-- Create manual_payments table
CREATE TABLE public.manual_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.business_profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  note text,
  activated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

-- Admin-only read
CREATE POLICY "Admin reads manual_payments" ON public.manual_payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid()));

-- Admin-only insert
CREATE POLICY "Admin inserts manual_payments" ON public.manual_payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid()));

-- Admin can update all business_profiles
CREATE POLICY "Admin updates all businesses" ON public.business_profiles
  FOR UPDATE USING (EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid()));
