-- Installed by install-satellite-scheduler.py with credentials bound separately.
-- Private, invoker-only operations: no public RPC or report/user-table access.
CREATE SCHEMA IF NOT EXISTS satellite_scheduler;
REVOKE ALL ON SCHEMA satellite_scheduler FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS satellite_scheduler.dispatch_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  request_id bigint NOT NULL,
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
  queued_id bigint;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(70403269014::bigint) THEN RETURN NULL; END IF;

  UPDATE satellite_scheduler.dispatch_log AS d
  SET http_status = r.status_code, transport_error = r.error_msg
  FROM net._http_response AS r
  WHERE d.request_id = r.id AND d.http_status IS NULL AND d.transport_error IS NULL;

  -- Only this job's diagnostic history is pruned. No other jobs are touched.
  DELETE FROM satellite_scheduler.dispatch_log WHERE requested_at < pg_catalog.now() - interval '7 days';
  DELETE FROM cron.job_run_details
  WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'gakit-satellite-publication')
    AND end_time < pg_catalog.now() - interval '7 days';

  SELECT decrypted_secret INTO STRICT dispatch_token
  FROM vault.decrypted_secrets WHERE name = 'gakit_satellite_github_dispatch';

  SELECT net.http_post(
    url := 'https://api.github.com/repos/gattosazio/project-gakit-client-2026/actions/workflows/satellite-publication.yml/dispatches',
    body := '{"ref":"main","inputs":{"trigger_source":"supabase_cron"}}'::jsonb,
    headers := pg_catalog.jsonb_build_object(
      'Authorization', 'Bearer ' || dispatch_token,
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'GAKIT-satellite-scheduler'),
    timeout_milliseconds := 10000
  ) INTO queued_id;
  INSERT INTO satellite_scheduler.dispatch_log (request_id) VALUES (queued_id);
  RETURN queued_id;
END;
$function$;
REVOKE ALL ON FUNCTION satellite_scheduler.dispatch_publication() FROM PUBLIC, anon, authenticated, service_role;
