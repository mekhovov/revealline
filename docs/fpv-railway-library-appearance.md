# Railway Library preview and trusted appearance

The standard regional Library now offers the bounded Railway Valley study: a
384 × 384 m early free-flight preview with static freight stock, a trestle,
station canopy, cutting and open maintenance hall. It is unscored and remains
a stylized representative study, not a completed large-world art standard.

## Exact installation

The first-party row pins the immutable descriptor at commit
`31c0b54b668fa004be03f46f7ddcfa195ee734b3`, path
`authoring/fpv-worlds/regions/railway-valley/delivery-structure-r1/delivery.json`.
Its 6,661 bytes hash to
`431b2dfb4be228e094174f1ccdd8eb72f906f09eb39a62c31b16e2bfb1239f15`.
The complete transfer is 5,691,267 bytes including that descriptor. The public
immutable URL returned HTTP 200 with exactly those bytes and hash on 2026-10-15.
Existing strict delivery-v1 validation, asset verification, storage and rollback
remain unchanged; no appearance field was added to the downloaded descriptor.

The source pair is the already verified `railway-structure-r4` output. Terrain
manifest SHA256 is `ed0ea8d9a7dcde8453fd89186c1e8f1982c122e91deee8cc3b33daa6fba5980c`;
scenery is `1cfd2659a7bf1429a47d2652274d437204ffebc3f2ed5bc7a7d48a8959c59f3d`.
Source/license receipts accompany the immutable payload. Earlier commanded-flight
evidence covers fourteen routes in Self-level and Acro, with 25,614 accepted ticks
and no contacts; that does not substitute for normal-player browser qualification.

## Trusted presentation

After an installed revision verifies, `applyRegionalAppearance` matches its exact
region ID, descriptor SHA256 and configuration manifest ID against the first-party
registry. Only that Railway revision receives the existing `railway` ground style.
Unknown or mismatched revisions explicitly receive `plain`, including previously
saved revisions. Downloaded metadata cannot request arbitrary styles or URLs.

`regionalPresentationOptions` maps the player's `low`, `balanced`, or `high`
selection to `performance`, `balanced`, or `quality` at launch/restart. It preserves
the verified geometry, source loader, scenery and control configuration. This
helper is applied at the normal host's regional session launch, including restart,
before its existing mode and input overrides. Changing quality during flight does
not yet rebuild regional surface materials.

## Verification and limits

Run `node authoring/fpv-worlds/regions/verify-library-appearance.mjs <exact-r4-directory>`.
The check passed actual production regional session preparation for all three
tiers plus the unknown-pin fallback. Every session started paused with zero ticks
and contacts, then disposed its resources. All four produced identical geometry
digest `3f9571a30dab78cd4a8ab9d016aea7f589e6835a8fa61dfa3d433e9ad6954e4b`,
845,688 geometry bytes and 2,446,676 texture bytes in the initial loaded window.
The three approved sessions contained the expected named Railway ground material;
the fallback did not. Wrong IDs, wrong hashes, malformed trusted styles and unknown
quality values were also checked. Source files and collision are unchanged.

### Native Library launch correction

The exact `d33a1cc3c8` CI optional package reproduced a first-Fly failure after a
successful verified Railway download. An isolated copy with diagnostic tracing
located the cancellation in `advanceFrame`'s execution-gap guard: initial shader
preparation took longer than the flight stall threshold and `pauseFlight` aborted
the still-disarmed preparation. Explicit Restart succeeded because compilation
was then warm. The original downloaded package remains unchanged.

The host resets elapsed flight time for a delayed callback only when regional
preparation is pending and the flight is already paused/disarmed. Explicit focus
loss and menu cancellation still call the unchanged `pauseFlight`. The final
integration retains #1314's stricter main implementation and five production
callback tests unchanged, superseding the earlier two clock-boundary checks.
These cover cold preparation, both clocks, active/inconsistent states, ordinary
flight policy and explicit cancellation; all five pass on the combined source.

Native browser verification used that exact package plus only this host change.
First Fly reached Ready to arm, paused with zero input and the expected Railway
surface. Reload retained the 5.4 MiB structure-r1 installation, and Fly reached
Ready to arm again without Restart or another download. This is local integration
evidence, not a claim that refreshed CI or final release-package checks passed.

This increment does not claim packaged offline acceptance, device FPS, live
material-tier updates, or finished realism. Those require their respective release
checks. No module count, package byte ceiling, physics, scoring, source geometry
or texture was added.
