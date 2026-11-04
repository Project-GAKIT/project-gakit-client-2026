# Published satellite feed

Satellite rendering runs in `.github/workflows/satellite-publication.yml`, using
a standard Linux runner in this public repository. The schedule checks every
five minutes at minutes 2, 7, 12, etc. GitHub can delay runs or disable schedules
after prolonged repository inactivity; check Actions if observations fall behind.
`workflow_dispatch` provides a manual retry. The free Render API is not involved.

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
It refuses to change an existing private bucket. PNG and JSON uploads are
limited to 8 MB each. Supabase Storage access policies continue to govern writes;
no anonymous upload policy is added.

1. Discover recent CIRA scans and reuse previously uploaded completed frames.
2. Render missing scans using the existing crop, projection and cloud alpha.
3. Upload immutable `himawari-v1/frames/YYYYMMDDHHMMSS.png` objects with a long
   browser cache lifetime. Existing objects are not overwritten.
4. Publish `himawari-v1/latest.json` only after its images exist. It lists at most
   six scans with observation stamps, byte counts and SHA-256 checksums.
5. Clean up expired managed PNGs after manifest publication succeeds.

The manifest has a zero browser cache lifetime. Public readers additionally
use a 15-second query window and a bounded process cache to avoid serving a
long-cached mutable manifest. Images are downloaded directly from Storage/CDN
using the manifest's URLs. The old image proxy URL redirects to published images.
Public routes never contact CIRA or render a frame, including during an outage.

The UI displays the latest completed scan's actual time in PHT. Scans older
than two hours are excluded from new public manifests. Generation time is separate from observation time. Local
cached playback also checks source age before reusing a batch.

## Retention and failure behavior

Only filenames matching a valid 14-digit timestamp under `himawari-v1/frames/`
are cleanup candidates. Objects more than two hours old are removed unless the
active manifest references them. Listing is paginated before deletion, and
deletes use the Storage API in bounded batches. Unknown filenames, other
prefixes and other buckets are untouched.

At the measured approximately 0.4 MB per scan, a normal two-hour window is
roughly 5 MB. Frame size can vary. During an upstream outage, the last six
referenced images remain protected even after two hours; the public reader then
reports unavailability rather than presenting them as current observations.
That fallback is bounded to six images. Failed publication never triggers
cleanup. Orphan uploads from an interrupted run can be reused on the next run
and otherwise expire through normal cleanup.

GitHub's concurrency group permits only one publisher at a time and does not
cancel an active publication. This does not coordinate an independently run
local/Render publisher: use one scheduler, and disable it before maintenance.
Before moving to another scheduler, disable the GitHub schedule first.

A successful job logs published, rendered and deleted counts. Upstream errors,
failed frame preparation, or a delayed latest observation produce a failed run
for visibility while preserving the last usable publication. Cleanup failure
also fails the run after publishing; a later run retries cleanup.

## Validation

Unit tests cover upload/publication/deletion ordering, publication failure,
active-frame protection during outages, orphan recovery, retention, manifest
bounds, stale reads, and provider-free public requests. The live browser check
is `tests/browser/himawari-published.smoke.cjs`; it checks actual image downloads
from shared Storage, first-image readiness, observation time and cached re-enable.
It uses a stub map to isolate delivery and does not measure GPU upload or
production page startup. The startup smoke checks first-frame loader release
at mobile/desktop sizes. Live storage verification also checks PNG checksums,
anonymous-write rejection, and expiry of a deliberately created old test frame.

References: [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[public runner billing](https://docs.github.com/en/actions/concepts/billing-and-usage),
[Supabase CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals).
