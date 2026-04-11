UPDATE kols
SET
  bio = CASE slug
    WHEN '0xalec' THEN COALESCE(bio, 'Macro-focused Solana analyst sharing structured thesis threads and execution notes.')
    WHEN '0xauri' THEN COALESCE(bio, 'Narrative-driven trader covering momentum rotations and rapidly changing market sentiment.')
    WHEN '0xb1' THEN COALESCE(bio, 'High-velocity commentator with uneven call quality and a thinner disclosure history.')
    ELSE bio
  END,
  verified = CASE
    WHEN slug IN ('0xalec', '0xauri') THEN TRUE
    ELSE verified
  END,
  updated_at = NOW()
WHERE slug IN ('0xalec', '0xauri', '0xb1');

INSERT INTO kol_profile_metrics (
  id,
  kol_id,
  trust_score,
  followers_count,
  following_count,
  tweets_count,
  verified_followers_count,
  global_rank,
  activity_label,
  verdict_label,
  verdict_summary,
  risk_level,
  data_source,
  data_confidence,
  is_placeholder,
  updated_at
)
SELECT
  seed.id,
  k.id,
  seed.trust_score,
  seed.followers_count,
  seed.following_count,
  seed.tweets_count,
  seed.verified_followers_count,
  seed.global_rank,
  seed.activity_label,
  seed.verdict_label,
  seed.verdict_summary,
  seed.risk_level,
  seed.data_source,
  seed.data_confidence,
  FALSE,
  NOW()
FROM (
  VALUES
    (
      '77000000-0000-0000-0000-000000000001'::UUID,
      '0xalec'::TEXT,
      92.00::NUMERIC,
      128400,
      912,
      8415,
      6420,
      4,
      'High-conviction coverage'::TEXT,
      'Low Risk / High Trust'::TEXT,
      'Manual research indicates disciplined market commentary, cleaner disclosures, and stronger verified audience quality than most tracked peers.'::TEXT,
      'low'::TEXT,
      'manual'::TEXT,
      'high'::TEXT
    ),
    (
      '77000000-0000-0000-0000-000000000002'::UUID,
      '0xauri'::TEXT,
      67.00::NUMERIC,
      48300,
      1204,
      12690,
      1480,
      17,
      'Mixed signal profile'::TEXT,
      'Moderate Risk / Mixed Signals'::TEXT,
      'Manual review shows strong reach but inconsistent conviction quality, so profile trust should stay conditional on current-market accuracy.'::TEXT,
      'moderate'::TEXT,
      'manual'::TEXT,
      'medium'::TEXT
    ),
    (
      '77000000-0000-0000-0000-000000000003'::UUID,
      '0xb1'::TEXT,
      41.00::NUMERIC,
      17800,
      204,
      4220,
      190,
      88,
      'Risk watchlist'::TEXT,
      'High Volatility / Review Carefully'::TEXT,
      'Manual review found weaker disclosure patterns, sharper sentiment swings, and fewer trusted followers backing the account''s public calls.'::TEXT,
      'high'::TEXT,
      'manual'::TEXT,
      'medium'::TEXT
    )
) AS seed(
  id,
  slug,
  trust_score,
  followers_count,
  following_count,
  tweets_count,
  verified_followers_count,
  global_rank,
  activity_label,
  verdict_label,
  verdict_summary,
  risk_level,
  data_source,
  data_confidence
)
JOIN kols k
  ON k.slug = seed.slug
ON CONFLICT (kol_id) DO UPDATE SET
  trust_score = EXCLUDED.trust_score,
  followers_count = EXCLUDED.followers_count,
  following_count = EXCLUDED.following_count,
  tweets_count = EXCLUDED.tweets_count,
  verified_followers_count = EXCLUDED.verified_followers_count,
  global_rank = EXCLUDED.global_rank,
  activity_label = EXCLUDED.activity_label,
  verdict_label = EXCLUDED.verdict_label,
  verdict_summary = EXCLUDED.verdict_summary,
  risk_level = EXCLUDED.risk_level,
  data_source = EXCLUDED.data_source,
  data_confidence = EXCLUDED.data_confidence,
  is_placeholder = FALSE,
  updated_at = NOW();

INSERT INTO kol_reasoning_points (id, kol_id, content, sort_order)
SELECT
  seed.id,
  k.id,
  seed.content,
  seed.sort_order
FROM (
  VALUES
    ('78000000-0000-0000-0000-000000000001'::UUID, '0xalec'::TEXT, 'High-quality followers and verified accounts make up a healthier share of the audience than the current queue median.'::TEXT, 0),
    ('78000000-0000-0000-0000-000000000002'::UUID, '0xalec'::TEXT, 'Recent posts show tighter thesis discipline and fewer abrupt narrative pivots than comparable profiles.'::TEXT, 1),
    ('78000000-0000-0000-0000-000000000003'::UUID, '0xalec'::TEXT, 'Disclosure patterns are stronger than most active registry profiles with similar reach.'::TEXT, 2),
    ('78000000-0000-0000-0000-000000000004'::UUID, '0xauri'::TEXT, 'Engagement is strong, but recent calls show uneven follow-through across different market regimes.'::TEXT, 0),
    ('78000000-0000-0000-0000-000000000005'::UUID, '0xauri'::TEXT, 'Audience quality is mixed, with fewer trusted followers relative to total reach than high-conviction accounts.'::TEXT, 1),
    ('78000000-0000-0000-0000-000000000006'::UUID, '0xauri'::TEXT, 'Profile is promising but still needs more consistent, evidence-backed execution to move into high-trust territory.'::TEXT, 2),
    ('78000000-0000-0000-0000-000000000007'::UUID, '0xb1'::TEXT, 'Disclosure history is thin, making it harder to validate the intent behind promoted ideas.'::TEXT, 0),
    ('78000000-0000-0000-0000-000000000008'::UUID, '0xb1'::TEXT, 'Follower quality is weaker than similarly visible accounts, which lowers confidence in signal integrity.'::TEXT, 1),
    ('78000000-0000-0000-0000-000000000009'::UUID, '0xb1'::TEXT, 'Recent commentary shows sharper sentiment swings and less supporting evidence than higher-trust profiles.'::TEXT, 2)
) AS seed(id, slug, content, sort_order)
JOIN kols k
  ON k.slug = seed.slug
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  sort_order = EXCLUDED.sort_order;

INSERT INTO kol_recent_signals (
  id,
  kol_id,
  signal_code,
  title,
  status_label,
  description,
  impact_label,
  published_at
)
SELECT
  seed.id,
  k.id,
  seed.signal_code,
  seed.title,
  seed.status_label,
  seed.description,
  seed.impact_label,
  seed.published_at
FROM (
  VALUES
    ('79000000-0000-0000-0000-000000000001'::UUID, '0xalec'::TEXT, 'SIG-AL-01'::TEXT, 'SOL liquidity thesis held'::TEXT, 'Manual review'::TEXT, 'Recent positioning stayed aligned with the posted thesis and broader market structure.'::TEXT, 'Constructive'::TEXT, NOW() - INTERVAL '1 day'),
    ('79000000-0000-0000-0000-000000000002'::UUID, '0xalec'::TEXT, 'SIG-AL-02'::TEXT, 'Risk disclosure stayed intact'::TEXT, 'Manual review'::TEXT, 'Posts continued to frame conviction with explicit downside conditions instead of unconditional hype.'::TEXT, 'Low risk'::TEXT, NOW() - INTERVAL '3 days'),
    ('79000000-0000-0000-0000-000000000003'::UUID, '0xauri'::TEXT, 'SIG-AU-01'::TEXT, 'Momentum calls turned mixed'::TEXT, 'Manual review'::TEXT, 'Recent signal quality varied more across fast-moving narratives than earlier periods.'::TEXT, 'Watch closely'::TEXT, NOW() - INTERVAL '18 hours'),
    ('79000000-0000-0000-0000-000000000004'::UUID, '0xauri'::TEXT, 'SIG-AU-02'::TEXT, 'Audience quality divergence'::TEXT, 'Manual review'::TEXT, 'Reach remains strong, but verified-follower density has not kept pace with overall audience growth.'::TEXT, 'Moderate risk'::TEXT, NOW() - INTERVAL '4 days'),
    ('79000000-0000-0000-0000-000000000005'::UUID, '0xb1'::TEXT, 'SIG-B1-01'::TEXT, 'Conviction quality weakened'::TEXT, 'Manual review'::TEXT, 'Recent posts showed more abrupt directional shifts without matching evidence depth.'::TEXT, 'Risk rising'::TEXT, NOW() - INTERVAL '12 hours'),
    ('79000000-0000-0000-0000-000000000006'::UUID, '0xb1'::TEXT, 'SIG-B1-02'::TEXT, 'Disclosure still limited'::TEXT, 'Manual review'::TEXT, 'Public commentary continues to provide less context and fewer caveats than safer peer accounts.'::TEXT, 'High caution'::TEXT, NOW() - INTERVAL '5 days')
) AS seed(id, slug, signal_code, title, status_label, description, impact_label, published_at)
JOIN kols k
  ON k.slug = seed.slug
ON CONFLICT (id) DO UPDATE SET
  signal_code = EXCLUDED.signal_code,
  title = EXCLUDED.title,
  status_label = EXCLUDED.status_label,
  description = EXCLUDED.description,
  impact_label = EXCLUDED.impact_label,
  published_at = EXCLUDED.published_at;

INSERT INTO kol_data_sources (id, kol_id, source_type, source_ref, notes, fetched_at)
SELECT
  seed.id,
  k.id,
  seed.source_type,
  seed.source_ref,
  seed.notes,
  seed.fetched_at
FROM (
  VALUES
    ('7A000000-0000-0000-0000-000000000001'::UUID, '0xalec'::TEXT, 'manual'::TEXT, 'research_note:0xalec'::TEXT, 'Manual analyst backfill for demo-ready intelligence.'::TEXT, NOW()),
    ('7A000000-0000-0000-0000-000000000002'::UUID, '0xauri'::TEXT, 'manual'::TEXT, 'research_note:0xauri'::TEXT, 'Manual analyst backfill for mixed-risk profile coverage.'::TEXT, NOW()),
    ('7A000000-0000-0000-0000-000000000003'::UUID, '0xb1'::TEXT, 'manual'::TEXT, 'research_note:0xb1'::TEXT, 'Manual analyst backfill for elevated-risk profile coverage.'::TEXT, NOW())
) AS seed(id, slug, source_type, source_ref, notes, fetched_at)
JOIN kols k
  ON k.slug = seed.slug
ON CONFLICT (id) DO UPDATE SET
  source_type = EXCLUDED.source_type,
  source_ref = EXCLUDED.source_ref,
  notes = EXCLUDED.notes,
  fetched_at = EXCLUDED.fetched_at;

-- NON-PRODUCTION FIXTURE.
-- Do not apply this seed file in production. Use it only for disposable local/demo environments.
