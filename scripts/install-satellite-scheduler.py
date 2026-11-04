"""Install the independent satellite timer using the existing server Python environment.

Secrets are bound parameters sent to Vault, never embedded in SQL files or job
commands. Prefer GAKIT_SATELLITE_GITHUB_TOKEN for a dedicated Actions-write token.
--use-gh-account explicitly selects an already authenticated account instead.
"""
import argparse
import json
import os
import subprocess
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import psycopg
from dotenv import load_dotenv


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, required=True)
    parser.add_argument('--use-gh-account')
    parser.add_argument('--status', action='store_true')
    args = parser.parse_args()
    load_dotenv(args.env_file)
    database_url = os.environ['DATABASE_URL'].replace('postgresql+psycopg://', 'postgresql://')
    project_ref = urlparse(os.environ['SUPABASE_URL']).hostname.split('.')[0]
    db = urlparse(database_url)
    if project_ref not in ((db.username or '') + (db.hostname or '')):
        raise RuntimeError('Database and Storage project cannot be matched')
    token = None
    actor = None
    if not args.status:
        token = os.environ.get('GAKIT_SATELLITE_GITHUB_TOKEN')
        if not token:
            if not args.use_gh_account:
                parser.error('Set GAKIT_SATELLITE_GITHUB_TOKEN or explicitly select --use-gh-account')
            token = subprocess.check_output(
                ['gh', 'auth', 'token', '--hostname', 'github.com', '--user', args.use_gh_account],
                text=True, stderr=subprocess.DEVNULL).strip()
        request = urllib.request.Request('https://api.github.com/user', headers={
            'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'})
        with urllib.request.urlopen(request, timeout=15) as response:
            actor = json.load(response)['login']
        if args.use_gh_account and actor != args.use_gh_account:
            raise RuntimeError('Authenticated dispatch account differs from the requested account')
    with psycopg.connect(database_url, connect_timeout=15) as connection:
        with connection.cursor() as cursor:
            if args.status:
                cursor.execute("SELECT jobid, schedule, active FROM cron.job WHERE jobname = 'gakit-satellite-publication'")
                jobs = cursor.fetchall()
                cursor.execute("""SELECT requested_at,http_status,transport_error FROM satellite_scheduler.dispatch_log
                    ORDER BY requested_at DESC LIMIT 3""")
                print(json.dumps({'jobs': jobs, 'dispatches': cursor.fetchall()}, default=str))
                return
            cursor.execute('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog')
            cursor.execute('CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions')
            # Vault must not be readable by browser roles; request headers are not queued.
            # Supabase's server-only service_role is an administrator role.
            for role in ['anon', 'authenticated']:
                cursor.execute("SELECT has_table_privilege(%s,'vault.decrypted_secrets','SELECT')", (role,))
                if any(cursor.fetchone()):
                    raise RuntimeError('Vault is readable by a browser role')
            cursor.execute(Path(__file__).with_name('sql').joinpath('satellite-scheduler.sql').read_text(encoding='utf-8'))
            cursor.execute("SELECT id FROM vault.secrets WHERE name = 'gakit_satellite_github_dispatch'")
            row = cursor.fetchone()
            if row:
                cursor.execute('SELECT vault.update_secret(%s, new_secret := %s)', (row[0], token))
            else:
                cursor.execute('SELECT vault.create_secret(%s,%s,%s)', (token,
                    'gakit_satellite_github_dispatch', 'GAKIT account credential for the fixed satellite workflow dispatcher'))
            cursor.execute("SELECT cron.schedule('gakit-satellite-publication','*/2 * * * *','SELECT satellite_scheduler.dispatch_publication();')")
            job_id = cursor.fetchone()[0]
            for role in ['anon', 'authenticated', 'service_role']:
                cursor.execute("SELECT has_schema_privilege(%s,'satellite_scheduler','USAGE'), has_function_privilege(%s,'satellite_scheduler.dispatch_publication()','EXECUTE')", (role, role))
                if any(cursor.fetchone()):
                    raise RuntimeError('Private dispatcher access is too broad')
        connection.commit()
    print(json.dumps({'job_id': job_id, 'schedule': '*/2 * * * *', 'dispatch_account': actor,
        'secret_storage': 'Supabase Vault', 'private_dispatcher': True}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never dump SQL parameters, connection strings, request headers or tokens.
        print(json.dumps({'error_type': type(error).__name__,
            'message': str(error) if type(error) is RuntimeError else 'Scheduler setup/status failed; no credential values were printed.',
            'sqlstate': getattr(error, 'sqlstate', None)}))
        raise SystemExit(1)
