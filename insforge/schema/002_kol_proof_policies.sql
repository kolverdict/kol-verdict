ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kols ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_metrics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read profiles" ON profiles;
CREATE POLICY "public read profiles" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read kols" ON kols;
CREATE POLICY "public read kols" ON kols
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "public read comments" ON kol_comments;
CREATE POLICY "public read comments" ON kol_comments
  FOR SELECT USING (moderation_status = 'published');

DROP POLICY IF EXISTS "public read evidence" ON comment_evidence;
CREATE POLICY "public read evidence" ON comment_evidence
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read metrics" ON kol_metrics_cache;
CREATE POLICY "public read metrics" ON kol_metrics_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "owner read watchlists" ON kol_watchlists;
CREATE POLICY "owner read watchlists" ON kol_watchlists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = kol_watchlists.profile_id
        AND profiles.auth_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "owner write watchlists" ON kol_watchlists;
CREATE POLICY "owner write watchlists" ON kol_watchlists
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = kol_watchlists.profile_id
        AND profiles.auth_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = kol_watchlists.profile_id
        AND profiles.auth_user_id = (SELECT auth.uid())
    )
  );
