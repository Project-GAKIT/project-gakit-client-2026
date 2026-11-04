# Live satellite loading

Himawari Band 13 uses the CIRA SLIDER renderer shared with Bakas. The full
1800 × 1180 Philippines crop needs all 16 native tiles. Projection coordinates
are reused, upstream tile downloads are limited to eight at once, and the
browser progressively loads six scans through two workers.

The loading improvements adapted from Bakas add:

- A best-effort rendered PNG cache under the system temporary directory, with
  two-hour retention and periodic cleanup. It survives local server reloads.
  Temporary storage is ephemeral on serverless hosts and is not shared between
  instances; existing CDN caching serves that role.
- Faster palette PNG encoding (`effort: 1`, compression level 3). The crop,
  projection and cloud-alpha rules are unchanged; palette quantization may
  choose different colors than the previous encoder settings.
- A browser cache of six decoded full-timestamp frames shared across map
  mounts. HHMM aliases and failed requests are not retained. Existing per-hook
  caching and progressive loading remain in use.
- Proxy `Server-Timing` headers for response and render stages, and an explicit
  60-second route execution allowance on hosts that support it. Stage durations
  describe the cached frame's original render; `frame` measures this request.

In a local live-scan check on 4 November 2026, encoding the same unquantized
crop took 266–312 ms with the previous settings and 133–145 ms with the new
settings (three runs each). PNG sizes were 348,197 and 348,116 bytes respectively.
The complete cold frame took 5.6 seconds, of which 5.3 seconds fetched and
stitched upstream tiles. Clearing the process frame cache and reading the saved
PNG took 2 ms and preserved identical bytes. These are local measurements for
one scan, not a production latency guarantee. CIRA latency and cold instances
remain the main limit on first-time loading.
