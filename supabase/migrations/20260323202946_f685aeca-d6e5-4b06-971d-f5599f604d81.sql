-- Backfill existing expired trials to 'free' plan
UPDATE public.business_profiles
SET plan = 'free'
WHERE plan = 'trial'
AND trial_ends_at < now();

-- Sync clients table for those businesses
UPDATE public.clients c
SET status = 'free'
FROM public.business_profiles bp
WHERE c.business_id = bp.id
AND bp.plan = 'free'
AND c.status = 'trial';