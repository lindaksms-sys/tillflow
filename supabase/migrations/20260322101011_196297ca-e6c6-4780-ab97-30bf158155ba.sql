-- Create logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow authenticated users to upload logos
CREATE POLICY "Auth users upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Allow public read access to logos
CREATE POLICY "Public read logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

-- Allow authenticated users to update/delete their logos
CREATE POLICY "Auth users manage logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Auth users delete logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos');

-- Add RLS for saas_admin SELECT for admin page queries
-- Admin needs to read all business_profiles
CREATE POLICY "Admin reads all businesses" ON business_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin reads all members" ON business_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM saas_admin WHERE user_id = auth.uid())
  );