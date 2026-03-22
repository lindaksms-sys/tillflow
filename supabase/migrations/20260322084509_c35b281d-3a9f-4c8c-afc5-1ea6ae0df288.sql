
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  bundle_qty INTEGER NOT NULL,
  bundle_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users full access" ON public.promotions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.sale_items ADD COLUMN promo_label TEXT;
