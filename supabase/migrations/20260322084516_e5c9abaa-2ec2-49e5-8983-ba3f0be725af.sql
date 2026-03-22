
DROP POLICY "Auth users full access" ON public.promotions;

CREATE POLICY "Users manage promotions for own products" ON public.promotions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = promotions.product_id AND products.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products WHERE products.id = promotions.product_id AND products.user_id = auth.uid()));
