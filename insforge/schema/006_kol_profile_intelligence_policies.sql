ALTER TABLE kol_profile_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_reasoning_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_recent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_x_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_admin_policy" ON kol_profile_metrics;
CREATE POLICY "project_admin_policy" ON kol_profile_metrics
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public read profile metrics" ON kol_profile_metrics;
CREATE POLICY "public read profile metrics" ON kol_profile_metrics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "project_admin_policy" ON kol_reasoning_points;
CREATE POLICY "project_admin_policy" ON kol_reasoning_points
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public read reasoning points" ON kol_reasoning_points;
CREATE POLICY "public read reasoning points" ON kol_reasoning_points
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "project_admin_policy" ON kol_recent_signals;
CREATE POLICY "project_admin_policy" ON kol_recent_signals
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public read recent signals" ON kol_recent_signals;
CREATE POLICY "public read recent signals" ON kol_recent_signals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "project_admin_policy" ON kol_data_sources;
CREATE POLICY "project_admin_policy" ON kol_data_sources
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public read data sources" ON kol_data_sources;
CREATE POLICY "public read data sources" ON kol_data_sources
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "project_admin_policy" ON kol_x_profiles;
CREATE POLICY "project_admin_policy" ON kol_x_profiles
  FOR ALL
  TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public read x profiles" ON kol_x_profiles;
CREATE POLICY "public read x profiles" ON kol_x_profiles
  FOR SELECT USING (true);
