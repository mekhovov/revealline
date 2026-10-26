# Final optional-art UI delivery check

Date: 2026-10-20 (Europe/Berlin). Evidence: `realistic-delivery-ui.json` and the four `realistic-delivery-*.png` captures.

## Scope

The already-established isolated QA entry at `http://127.0.0.1:8893/optional-practice/fpv-worlds/index.html?lang=en` mounted the production World app and proxied unchanged sources and final pinned assets from port 8768. A fresh `fpv-combat-delivery` browser profile was used. No user radio profile or browser was accessed. Main navigation, download, selection and Workshop preview used actual visible UI controls. The QA entry supplies its existing synthetic radio/preset fixture; keyboard was selected for the short progressed flight.

A fresh production entry showed the password form. Automatic approval review rejected writing a remembered-unlock cache; that action did not run and was not retried. The existing QA entry was then used as permitted. Password-form acceptance and the separately protected Creator tools iframe are outside this check. The built-in Workshop remains within the tested production host.

## Observed results

- Settings → Display & Language exposes “Download realistic characters · 13.0 MiB”. Selecting Realistic before installation keeps Current, explains the missing download, and makes no pack network request.
- Clicking the explicit download fetched the 52,499-byte manifest and 13,557,808-byte GLB. Installed state became ready without a storage warning.
- Fly now activated all 36 character identities with final manifest SHA256 `8121b18a0a6c1ea2c625cb355ef2d5efee0ed6c1486a835d415c3119fc555357`.
- Current → Realistic and back preserved the entire accepted flight snapshot byte for byte, including actors, run identity, health and counters, at tick 0 and paused tick 479. The shot/hit counters were zero in this delivery check; nonzero combat persistence is covered by separate acceptance.
- After blocking `**/fpv-character-art/**` in this isolated browser and reloading, the installed package restored from IndexedDB. A new flight activated all 36 identities; there were zero pack resource requests.
- Explore worlds → SIM tools → Workshop opened actual clean-impact and blood/remains previews with the installed realistic body. Closing the preview disconnected its canvas and emitted WebGL context loss.
- Final app disposal terminated both created workers, left zero live workers, and disposed the main renderer. Browser and worker errors: zero. The dedicated browser was closed.

## Limits

This is functional UI acceptance, not another performance qualification. Cancellation was not exercised during the fast local UI download; focused download/activation tests cover cancellation, missing data and failure. Protected password flows were untouched. Full-frame screenshots show the real preview framing; the separate roster galleries provide close visual inspection.
