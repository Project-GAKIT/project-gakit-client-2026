# Published satellite feed

Satellite rendering runs in `.github/workflows/satellite-publication.yml`, using
a standard Linux runner in this public repository. Supabase Cron independently
dispatches the workflow every two minutes. The previous GitHub schedule produced
no scheduled runs and is no longer used. GitHub still executes the rendering job;
runner queue time and upstream publication lag can add delay. `workflow_dispatch`
also provides a manual retry. The free Render API is not involved.

The timer is installed by `scripts/install-satellite-scheduler.py` and
`scripts/sql/satellite-scheduler.sql`. It uses `pg_cron` and `http` and reads
the GAKIT account dispatch credential from Supabase Vault. The private HTTP call has a ten-second timeout and does not store authorization
headers in an HTTP queue. The dispatcher and
seven-day request history live in the private `satellite_scheduler` schema.
No browser role can execute the dispatcher or read its logs/credential. The job
command contains only a private function call; credentials are never embedded
in the job text or committed files. Prefer a dedicated GitHub Actions-write
credential through `GAKIT_SATELLITE_GITHUB_TOKEN`. An explicitly selected existing
GAKIT CLI account can be used with `--use-gh-account projectgakit2026`; Vault
then holds that account's existing OAuth credential and must remain restricted
to server administrators. Reinstall to rotate the credential if access changes.

Run the installer using the server's Python environment (psycopg and dotenv),
with `--env-file` pointing to its `.env`. `--status` shows recent dispatch HTTP
statuses without reading or printing secrets. HTTP 204 confirms GitHub accepted
the dispatch; the corresponding Actions run confirms publication completion.
The installer checks that the Database and Storage belong to the same project.
To stop the timer: `select cron.unschedule('gakit-satellite-publication');`.
Do not disable pg_cron/http globally, because other jobs may also use them.

The job uses the dedicated `SATELLITE_SUPABASE_URL` repository secret and the
worker-only `SATELLITE_SUPABASE_SERVICE_KEY` secret. These become `SUPABASE_URL`
and `SUPABASE_SERVICE_KEY` in the publisher process. The service credential is
never exposed to the browser or placed in a `NEXT_PUBLIC_` variable. The Next
reader needs only its existing public Supabase URL.

`node scripts/publish-satellite.cjs` compiles the existing TypeScript renderer
and publication modules with the locked TypeScript dependency. It requires
Node 22 or newer and installed project dependencies; it starts neither Next nor
the Python API. For a local maintenance run, after stopping the scheduler:

```powershell
node --env-file=.env.local scripts/publish-satellite.cjs --env-file ../project-gakit-server-2026/.env
```

## Publication and delivery

The worker provisions the dedicated public `satellite-frames` bucket if absent.
It refuses to change an existing private bucket. PNG, WebP and JSON uploads are
limited to 8 MB each. Supabase Storage access policies continue to govern writes;
no anonymous upload policy is added.

1. Discover recent CIRA scans and reuse previously uploaded completed frames.
2. Render missing scans using the existing crop, projection and cloud alpha,
   then encode lossless WebP with visible RGB and alpha preserved.
3. Upload immutable `himawari-v2/frames/YYYYMMDDHHMMSS.webp` objects with a long
   browser cache lifetime. Existing objects are not overwritten.
4. Publish `himawari-v2/latest.json` only after its images exist. It lists at most
   six scans with observation stamps, byte counts and SHA-256 checksums.
5. Clean up expired managed WebP images after manifest publication succeeds.

The browser fetches the manifest directly from the public Storage/CDN URL,
without a Next.js request. A 15-second query window avoids reusing an older CDN
response for this mutable file. The last validated manifest is saved locally,
scoped to the project and publication version. Returning visitors start their
image loads from that saved manifest while a fresh manifest is fetched in the
background. New scans update playback after the current batch finishes; explicit
retry bypasses saved data. Invalid, future-only or expired saved data is ignored.
Blocked browser storage falls back to direct network loading. Only public scan
metadata is saved; image URLs are constructed from the configured trusted origin.

The legacy Next manifest/image routes remain as compatibility readers and
redirectors. They never contact CIRA or render a frame, including during an outage.
The scheduled renderer owns all upstream fetching and image preparation.

The UI displays the latest completed scan's actual time in PHT. Scans older
than two hours are excluded from new public manifests. Generation time is separate from observation time. Local
cached playback also checks source age before reusing a batch. An open map
checks for a new manifest every two minutes, matching the publisher timer.

## Retention and failure behavior

Only filenames matching a valid 14-digit timestamp under `himawari-v2/frames/`
are cleanup candidates. Objects more than two hours old are removed unless the
active manifest references them. Listing is paginated before deletion, and
deletes use the Storage API in bounded batches. Unknown filenames, other
prefixes and other buckets are untouched.

At the measured approximately 0.35 MB per WebP scan, a normal two-hour window is
roughly 4–5 MB. Frame size can vary. During an upstream outage, the last six
referenced images remain protected even after two hours; the public reader then
reports unavailability rather than presenting them as current observations.
That fallback is bounded to six images. Failed publication never triggers
cleanup. Orphan uploads from an interrupted run can be reused on the next run
and otherwise expire through normal cleanup.

The PNG v1 publication remains intact during rollout. The publisher retires only
recognized old PNG paths and their old manifest after both the old manifest's
generation time and all its listed observation times are more than two hours
old. Unknown files are untouched. This temporary compatibility copy does not
accumulate indefinitely; the active WebP feed retains the normal two-hour window.

GitHub's concurrency group permits only one publisher at a time and does not
cancel an active publication. This does not coordinate an independently run
local/Render publisher: use one scheduler, and disable it before maintenance.
Before moving to another scheduler, disable the GitHub schedule first.

A successful job logs published, rendered and deleted counts. Upstream errors,
failed frame preparation, or observations beyond the two-hour usability limit
produce a failed run while preserving the last publication. The provider's
ordinary publication lag is recorded without failing an otherwise valid feed. Cleanup failure
also fails the run after publishing; a later run retries cleanup.

## Validation

Unit tests cover upload/publication/deletion ordering, publication failure,
active-frame protection during outages, orphan recovery, retention, manifest
bounds, stale reads, provider-free public requests, saved-manifest recovery,
legacy PNG retirement, and lossless visible-pixel/alpha preservation. The live browser check
is `tests/browser/himawari-published.smoke.cjs`; it checks actual image downloads
from shared Storage, first-image readiness, observation time, cached re-enable, and a returning visit
that draws a saved scan before a deliberately stalled manifest refresh.
It uses a stub map to isolate delivery and does not measure GPU upload or
production page startup. The startup smoke checks first-frame loader release
at mobile/desktop sizes. Live storage verification also checks PNG checksums,
anonymous-write rejection, and expiry of a deliberately created old test frame.

References: [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[public runner billing](https://docs.github.com/en/actions/concepts/billing-and-usage),
[Supabase CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals).

Local v2 delivery checks measured about 1.2 seconds to the first image on a fresh
visit and 0.2 seconds on a returning visit with the manifest response held back.
These isolate browser delivery with a stub map and are not production latency
guarantees. One live overlapping scan used 397,207 PNG bytes versus 347,926 WebP
bytes (12% less), with zero differences in visible RGB or alpha. Fully transparent
pixels may have different hidden RGB values.
