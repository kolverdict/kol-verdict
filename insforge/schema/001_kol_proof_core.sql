CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_address TEXT UNIQUE,
  wallet_chain TEXT NULL CHECK (wallet_chain IN ('solana')),
  username TEXT,
  avatar_url TEXT,
  avatar_storage_key TEXT,
  reputation_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  influence_weight NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  x_username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  wallet_address TEXT,
  avatar_url TEXT,
  avatar_storage_key TEXT,
  bio TEXT,
  initial_trust_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by_profile_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kol_id UUID NOT NULL REFERENCES kols(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('love', 'hate')),
  tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, kol_id)
);

CREATE TABLE IF NOT EXISTS kol_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kol_id UUID NOT NULL REFERENCES kols(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  tag TEXT,
  fee_amount NUMERIC(18,8) NOT NULL DEFAULT 0.05,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'failed')),
  moderation_status TEXT NOT NULL DEFAULT 'published' CHECK (moderation_status IN ('published', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES kol_comments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('tweet', 'tx', 'image', 'link')),
  url TEXT NOT NULL,
  storage_key TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kol_id UUID NOT NULL REFERENCES kols(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, kol_id)
);

CREATE TABLE IF NOT EXISTS kol_metrics_cache (
  kol_id UUID PRIMARY KEY REFERENCES kols(id) ON DELETE CASCADE,
  love_count INTEGER NOT NULL DEFAULT 0,
  hate_count INTEGER NOT NULL DEFAULT 0,
  total_comments INTEGER NOT NULL DEFAULT 0,
  trust_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  controversy_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  trending_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kols_slug ON kols(slug);
CREATE INDEX IF NOT EXISTS idx_kols_x_username ON kols(x_username);
CREATE INDEX IF NOT EXISTS idx_kol_votes_kol_id ON kol_votes(kol_id);
CREATE INDEX IF NOT EXISTS idx_kol_comments_kol_id ON kol_comments(kol_id);
CREATE INDEX IF NOT EXISTS idx_kol_comments_profile_id_kol_id ON kol_comments(profile_id, kol_id);
CREATE INDEX IF NOT EXISTS idx_comment_evidence_comment_id ON comment_evidence(comment_id);
CREATE INDEX IF NOT EXISTS idx_kol_watchlists_profile_id ON kol_watchlists(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kol_metrics_cache_trust ON kol_metrics_cache(trust_score DESC, trending_score DESC);

CREATE OR REPLACE FUNCTION refresh_kol_metrics_cache(p_kol_id UUID)
RETURNS VOID AS $$
DECLARE
  v_love_count INTEGER;
  v_hate_count INTEGER;
  v_total_comments INTEGER;
  v_initial_trust NUMERIC(10,2);
  v_trust_score NUMERIC(10,2);
  v_controversy_score NUMERIC(10,2);
  v_trending_score NUMERIC(10,2);
BEGIN
  SELECT COALESCE(initial_trust_score, 0)
  INTO v_initial_trust
  FROM kols
  WHERE id = p_kol_id;

  SELECT COUNT(*) FILTER (WHERE direction = 'love'),
         COUNT(*) FILTER (WHERE direction = 'hate')
  INTO v_love_count, v_hate_count
  FROM kol_votes
  WHERE kol_id = p_kol_id;

  SELECT COUNT(*)
  INTO v_total_comments
  FROM kol_comments
  WHERE kol_id = p_kol_id
    AND moderation_status = 'published';

  v_trust_score := CASE
    WHEN v_love_count + v_hate_count = 0 THEN v_initial_trust
    ELSE GREATEST(
      0,
      LEAST(
        100,
        50 + (((v_love_count - v_hate_count)::NUMERIC / GREATEST(v_love_count + v_hate_count, 1)) * 50)
      )
    )
  END;

  v_controversy_score := CASE
    WHEN v_love_count + v_hate_count = 0 THEN 0
    ELSE 100 - (ABS(v_love_count - v_hate_count)::NUMERIC / GREATEST(v_love_count + v_hate_count, 1) * 100)
  END;

  v_trending_score := GREATEST(
    0,
    ROUND((v_love_count * 0.62) + (v_total_comments * 1.8) - (v_hate_count * 0.25), 2)
  );

  INSERT INTO kol_metrics_cache (
    kol_id,
    love_count,
    hate_count,
    total_comments,
    trust_score,
    controversy_score,
    trending_score,
    updated_at
  )
  VALUES (
    p_kol_id,
    COALESCE(v_love_count, 0),
    COALESCE(v_hate_count, 0),
    COALESCE(v_total_comments, 0),
    COALESCE(v_trust_score, v_initial_trust),
    COALESCE(v_controversy_score, 0),
    COALESCE(v_trending_score, 0),
    NOW()
  )
  ON CONFLICT (kol_id) DO UPDATE SET
    love_count = EXCLUDED.love_count,
    hate_count = EXCLUDED.hate_count,
    total_comments = EXCLUDED.total_comments,
    trust_score = EXCLUDED.trust_score,
    controversy_score = EXCLUDED.controversy_score,
    trending_score = EXCLUDED.trending_score,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
