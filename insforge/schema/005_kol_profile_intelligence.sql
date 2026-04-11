ALTER TABLE kols
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS kol_profile_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID NOT NULL UNIQUE REFERENCES kols(id) ON DELETE CASCADE,
  trust_score NUMERIC(10,2),
  followers_count INTEGER,
  following_count INTEGER,
  tweets_count INTEGER,
  verified_followers_count INTEGER,
  global_rank INTEGER,
  activity_label TEXT,
  verdict_label TEXT,
  verdict_summary TEXT,
  risk_level TEXT,
  data_source TEXT NOT NULL DEFAULT 'manual' CHECK (
    data_source IN ('manual', 'insforge_existing', 'x_api', 'synthetic_fallback')
  ),
  data_confidence TEXT NOT NULL DEFAULT 'medium' CHECK (
    data_confidence IN ('high', 'medium', 'low')
  ),
  is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_reasoning_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID NOT NULL REFERENCES kols(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_recent_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID NOT NULL REFERENCES kols(id) ON DELETE CASCADE,
  signal_code TEXT,
  title TEXT NOT NULL,
  status_label TEXT,
  description TEXT,
  impact_label TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID NOT NULL REFERENCES kols(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('manual', 'insforge_existing', 'x_api', 'synthetic_fallback')
  ),
  source_ref TEXT,
  notes TEXT,
  fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_x_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_id UUID NOT NULL UNIQUE REFERENCES kols(id) ON DELETE CASCADE,
  x_user_id TEXT,
  username TEXT,
  profile_image_url TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  tweets_count INTEGER,
  verified_followers_count INTEGER,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kol_reasoning_points_kol_id
  ON kol_reasoning_points(kol_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_kol_recent_signals_kol_id
  ON kol_recent_signals(kol_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_kol_data_sources_kol_id
  ON kol_data_sources(kol_id, fetched_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_kol_profile_metrics_global_rank
  ON kol_profile_metrics(global_rank);
CREATE INDEX IF NOT EXISTS idx_kol_x_profiles_username
  ON kol_x_profiles(username);
