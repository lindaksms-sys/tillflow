
-- Security definer function to onboard existing user:
-- Creates business profile, adds owner as member, backfills all existing data
CREATE OR REPLACE FUNCTION public.onboard_business(
  _name TEXT,
  _type TEXT,
  _currency TEXT DEFAULT 'USD',
  _country TEXT DEFAULT 'Zimbabwe'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _biz_id UUID;
BEGIN
  -- Create business profile
  INSERT INTO business_profiles (owner_id, name, type, currency, country)
  VALUES (_user_id, _name, _type, _currency, _country)
  RETURNING id INTO _biz_id;

  -- Add owner as member
  INSERT INTO business_members (business_id, user_id, role, full_name)
  VALUES (_biz_id, _user_id, 'owner', _name);

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
$$;
