# Loading audit

Scope: public map startup, route transitions and Back/Forward navigation,
basemap switching, layer updates, scenario data/images, satellite first-frame
readiness, timeout recovery, and listener/timer cleanup.

## Findings and fixes

- Startup readiness was registered after optional overlay setup. It now starts
  independently when the basemap style loads.
- Startup waited for every peripheral basemap tile/label. A painted map center
  can now release the page; genuinely blocked maps retain recovery controls.
  Only the original basemap layers count, including when overlays reuse a source.
- Layer toggles waited on unrelated feeds and tiles. Each action now waits only
  for its own data and visible sources. Historical typhoon fetches are included.
- A second navigation during an existing load reused the old recovery timer.
  Each navigation now starts its own recovery cycle, including after an earlier
  timeout. Fallback cleanup is idempotent.
- Basemap style fetches had no deadline. They now time out after 15 seconds,
  retain the working map, and expose the existing Retry action.
- Live scenario timeline requests had no deadline. They now time out after
  20 seconds while preserving user cancellation and the existing retry/error UI.
- A malformed preparing-response Retry-After header could schedule immediate
  repeat polling. Invalid values now use a bounded two-second retry delay.

## Validation

Unit regressions cover center-tile readiness, blocked maps, source-scoped readiness,
style timeouts/cancellation, and scenario retry handling. Browser regressions at
390px and 1440px cover initial startup with stalled reports/buildings, route
fallback handoffs and snapshots, repeated timeout recovery, scoped layer readiness,
asynchronous display changes, errors, and unmount cleanup. Satellite fixtures
cover first-frame readiness and cached re-enabling without extra downloads.

Scenario/browser recovery checks cover failed initial loads, Retry, switching,
return navigation, browser Back, and a deliberately stalled basemap that resumes.

Public deployment probes showed intermittent cold-load delays and normal warm
loads. Initial weather overlays were off, so their data requests did not explain
the initial map gate. A displayed recovery message alone cannot identify whether
the delay is network transfer, basemap requests, or the app's readiness gate.
The fixes remove avoidable app-level gating without dismissing a blank map merely
because a timer elapsed.

Not a whole-system availability guarantee: external tile/auth services and cold
backend startup remain network dependencies. Protected-route auth checks were
reviewed and remain enforced. No authentication bypass was introduced to speed up
loading.
