-- Installed by install-satellite-scheduler.py with credentials bound separately.
-- Private, invoker-only operations: no public RPC or report/user-table access.
CREATE SCHEMA IF NOT EXISTS satellite_scheduler;
REVOKE ALL ON SCHEMA satellite_scheduler FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS satellite_scheduler.dispatch_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  http_status integer,
  transport_error text
);
ALTER TABLE satellite_scheduler.dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS satellite_dispatch_requested_at_idx
  ON satellite_scheduler.dispatch_log (requested_at);
REVOKE ALL ON TABLE satellite_scheduler.dispatch_log FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA satellite_scheduler FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION satellite_scheduler.dispatch_publication()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  dispatch_token text;
  response_status integer;
  log_id bigint;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(70403269014::bigint) THEN RETURN NULL; END IF;

  -- Only this job's diagnostic history is pruned. No other jobs are touched.
  DELETE FROM satellite_scheduler.dispatch_log WHERE requested_at < pg_catalog.now() - interval '7 days';
  DELETE FROM cron.job_run_details
  WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'gakit-satellite-publication')
    AND end_time < pg_catalog.now() - interval '7 days';

  SELECT decrypted_secret INTO STRICT dispatch_token
  FROM vault.decrypted_secrets WHERE name = 'gakit_satellite_github_dispatch';

  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '3000');
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '10000');
  BEGIN
    SELECT r.status INTO response_status FROM extensions.http((
      'POST',
      'https://api.github.com/repos/gattosazio/project-gakit-client-2026/actions/workflows/satellite-publication.yml/dispatches',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || dispatch_token),
        extensions.http_header('Accept', 'application/vnd.github+json'),
        extensions.http_header('X-GitHub-Api-Version', '2022-11-28'),
        extensions.http_header('User-Agent', 'GAKIT-satellite-scheduler')
      ],
      'application/json',
      '{"ref":"main","inputs":{"trigger_source":"supabase_cron"}}'
    )::extensions.http_request) AS r;
    INSERT INTO satellite_scheduler.dispatch_log (http_status) VALUES (response_status) RETURNING id INTO log_id;
  EXCEPTION WHEN OTHERS THEN
    -- Record only SQLSTATE, never curl diagnostics or request headers.
    INSERT INTO satellite_scheduler.dispatch_log (transport_error) VALUES (SQLSTATE) RETURNING id INTO log_id;
  END;
  RETURN log_id;
END;
$function$;
REVOKE ALL ON FUNCTION satellite_scheduler.dispatch_publication() FROM PUBLIC, anon, authenticated, service_role;
