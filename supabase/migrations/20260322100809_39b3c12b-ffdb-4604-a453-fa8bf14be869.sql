UPDATE products SET business_id = (SELECT id FROM business_profiles LIMIT 1) WHERE business_id IS NULL;
UPDATE sales SET business_id = (SELECT id FROM business_profiles LIMIT 1) WHERE business_id IS NULL;
UPDATE expenses SET business_id = (SELECT id FROM business_profiles LIMIT 1) WHERE business_id IS NULL;
UPDATE promotions SET business_id = (SELECT id FROM business_profiles LIMIT 1) WHERE business_id IS NULL;
UPDATE stock_levels SET business_id = (SELECT id FROM business_profiles LIMIT 1) WHERE business_id IS NULL;
UPDATE stock_adjustments SET business_id = (SELECT id FROM business_profiles LIMIT 1) WHERE business_id IS NULL;