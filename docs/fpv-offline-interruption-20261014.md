# Interrupted optional simulator update — 14 October 2026

A native browser update was deliberately stalled, then cancelled twice. The old prepared simulator and installed Reservoir world remained available. The [receipt](fpv-offline-interruption-20261014.json) binds exact versions and observation limits.

## Journey and preserved data

The fresh origin was http://127.0.0.1:9017, using the same stable installation root and distinct immutable v0.142.4 and v0.151.1 release directories as the [update qualification](fpv-package-update-20261014.md). Both frozen trees remained byte-identical. Only the mutable launcher/current pointer switched; a dedicated server delayed one new-version dependency without modifying response bytes.

The old version first reported **Ready offline** and installed Mountain Reservoir r16: eight challenges, digest `50ffbb0e5da7`. The first transfer stalled and the product displayed its existing 30-second stalled-download error while retaining the old launch action. A retry was cancelled during offline verification.

A second explicit cancellation occurred after the UI showed **Downloading 0%**. The server log confirms the new package reached the delayed dependency at 17:29:26.621 UTC and served five adjacent dependencies. This is transfer-phase cancellation evidence despite the coarse displayed percentage. The UI reported Cancelled and retained Open prepared practice.

After both cancellations, read-only worker verification returned the old exact revision ready, with only its installation pointer. Opening it launched the actual v0.142.4 player, and Library retained the same eight Reservoir challenges. No browser storage was cleared. The server delay was disabled afterward.

## Inconclusive readiness is not corruption

Before cancellation, a launcher Check transiently reported Needs repair and hid the old action. A separate exact-worker check then verified both the old runtime and mutable launcher as ready; another Check restored the action.

The previous status helper returned the same false value for a timeout, lookup error, malformed reply and confirmed missing files. The correction adds an optional detailed ready / unavailable / unknown result while preserving the existing fail-closed boolean interface. The launcher gives unknown results localized retry guidance, retains only already-verified matching actions, and does not claim Ready offline from an initial unknown result. Confirmed missing files still hide the affected action and take precedence over unknown status.

All 48 focused existing/extended installation, lifecycle, controls, access and navigation checks pass, including EN/UK initial unknown, ready-to-unknown retention, and confirmed failure alongside unknown. Scoped lint, formatting and whitespace checks pass. This verifies source changes, not new packaged bytes.

## Native corrected-launcher check

A separate review launcher/context from source 5db194727 used the same 9017 installation root and unchanged frozen players. A visible harness checkbox reduced the actual read-only status timeout to 1 ms. Normal verification first established the old prepared action. The deliberately short check then showed the English inconclusive warning and retained that action, without claiming new readiness or recommending repair. Switching to Ukrainian updated both warning and links. Restoring the normal timeout and checking returned Ready then Update available, with Check enabled and the old action retained. Following it opened the actual v0.142.4 player with Ukrainian locale and rendered home screen. The receipt binds review script/context/HTML hashes and screenshot. This is native mixed-harness evidence, not admission of a freshly packaged release.

## Remaining qualification

- The separate [corrected-package journey](fpv-corrected-package-20261014.md) now covers packaged update and recovery; its documented limits still apply.
- Actual quota/eviction, full browser process restart and network-wide outages.
- Hardware/controller and sustained rendering performance.

This controlled origin-local interruption does not substitute for those checks.
