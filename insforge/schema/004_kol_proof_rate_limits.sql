CREATE TABLE IF NOT EXISTS request_rate_limits (
  action TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (action, subject, window_seconds)
);

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_updated_at
  ON request_rate_limits(updated_at);

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_action TEXT,
  p_subject TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  retry_after_seconds INTEGER
) AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_reset_at TIMESTAMPTZ;
  v_record request_rate_limits%ROWTYPE;
BEGIN
  IF p_action IS NULL OR BTRIM(p_action) = '' THEN
    RAISE EXCEPTION 'p_action is required';
  END IF;

  IF p_subject IS NULL OR BTRIM(p_subject) = '' THEN
    RAISE EXCEPTION 'p_subject is required';
  END IF;

  IF p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_window_seconds must be positive';
  END IF;

  IF p_limit <= 0 THEN
    RAISE EXCEPTION 'p_limit must be positive';
  END IF;

  LOOP
    SELECT *
    INTO v_record
    FROM request_rate_limits
    WHERE action = p_action
      AND subject = p_subject
      AND window_seconds = p_window_seconds
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO request_rate_limits (
        action,
        subject,
        window_seconds,
        request_count,
        window_started_at,
        updated_at
      )
      VALUES (
        p_action,
        p_subject,
        p_window_seconds,
        1,
        v_now,
        v_now
      );

      RETURN QUERY
      SELECT TRUE, GREATEST(p_limit - 1, 0), v_now + make_interval(secs => p_window_seconds), 0;
      RETURN;
    END IF;

    v_reset_at := v_record.window_started_at + make_interval(secs => p_window_seconds);

    IF v_reset_at <= v_now THEN
      UPDATE request_rate_limits
      SET request_count = 1,
          window_started_at = v_now,
          updated_at = v_now
      WHERE action = p_action
        AND subject = p_subject
        AND window_seconds = p_window_seconds;

      RETURN QUERY
      SELECT TRUE, GREATEST(p_limit - 1, 0), v_now + make_interval(secs => p_window_seconds), 0;
      RETURN;
    END IF;

    IF v_record.request_count >= p_limit THEN
      RETURN QUERY
      SELECT
        FALSE,
        0,
        v_reset_at,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now)))::INTEGER);
      RETURN;
    END IF;

    UPDATE request_rate_limits
    SET request_count = v_record.request_count + 1,
        updated_at = v_now
    WHERE action = p_action
      AND subject = p_subject
      AND window_seconds = p_window_seconds;

    RETURN QUERY
    SELECT
      TRUE,
      GREATEST(p_limit - (v_record.request_count + 1), 0),
      v_reset_at,
      0;
    RETURN;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
