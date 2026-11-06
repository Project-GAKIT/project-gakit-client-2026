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


## Streamlined map interaction follow-up

- Full-page loading is reserved for page/startup transitions. Layer and display
  changes show a pointer-transparent local indicator and keep the map usable.
- Building visibility updates apply as soon as the layer exists; unrelated
  source downloads no longer cause the requested toggle to be discarded.
- Land validation uses the tapped tile's rendered geometry when that source has
  other pending tiles. Water hits still reject the selection; missing local
  evidence produces an explicit retry message instead of silently dropping taps.
- Coastline validation warms after the basemap paints, is shared with the heat
  overlay, and has a ten-second request deadline. A local indicator shows an
  outstanding location check.
- Real map browser regressions exercise pin placement and building off/on while
  source/style readiness is forced pending, at 390px and 1440px. Sea, lake and
  land pin checks also run across Light, Bright, Dark and Satellite basemaps.
