# Parallel follow-up qualification

This follow-up is stacked above the native Overflight candidate. It does not
accept the target-hardware, physical-gamepad or five-player review gates.

## Balance

The 27 previously successful routes all included pulse. The new matrix adds four
strict no-pulse policies (Fan/Echo × Scanner/Shield), three encounter sets, three
seeds and both airframe presets: 72 routes before and 72 after the correction.
The selector cannot silently acquire pulse to rescue its results.

Only evolved Fan damage changes, from 45 to 60. Two overlapping impacts can now
clear an ordinary 120-hull late enemy, rewarding a well-positioned pass. Starter
and earlier ranks, cadence, geometry and spawning remain unchanged. Three-airframe
Fan no-pulse wins improve from 4/18 to 17/18; Echo remains 18/18. Single-airframe Fan
still wins only 1/18 after the change. These are one deterministic pilot's results,
not human difficulty guarantees. All 72 fixed stationary/tiny-circle/wall/edge
probes lose; that is bounded exploit coverage, not a proof against every strategy.

The original 1,048-visible-enemy route now peaks at 694 through effective clearing.
A different pulse Fan route still peaks at 912, including 11.45 seconds above 800.
This remains an explicit pacing review item; no sampling or forced spawn cap was
added. See [the summary](balance-summary.json), its referenced raw matrices, and
[the replay driver](balance-audit.mjs) for commands and source hashes. Large raw
matrices are losslessly gzip-compressed; use `gzip -dc <file>.json.gz` to inspect
them. Reproduction commands emit the equivalent uncompressed JSON.

## Native qualification tools

- Explicit no-pulse browser review presets: `fan-scanner`, `fan-shield`,
  `echo-scanner`, `echo-shield` in `?reviewBuild=...`.
- `?fixture=reference&trial=1&diagnostics=1` performs one independent 30-second
  warm-up and 120-second measurement, then freezes its complete record. Use new
  page loads for trials 2 and 3. The stress fixture uses the same protocol.
- `trial=soak` performs a 30-second warm-up plus a 15-minute resource observation.
  Owned pools, sprites, atlas bytes and canvas count are recorded; exposed browser
  heap is not total graphics/process memory.
- Pauses, visibility loss, graphics interruption, overflow and dropped simulation
  time invalidate unfinished trials. Raw foreground stalls remain in the data.
- `scripts/report-overflight-trials.mjs` checks three matching fresh-trial records
  from raw intervals rather than accepting consecutive windows of one run.
- Shared saved controller bindings and explicit raw-radio profile admission now
  feed Overflight through the existing controller router. No separate settings
  store is introduced. Physical devices still need review.
- Native Overflight is an explicit offline core entry. Studio remains optional
  authoring content. The adjacent navigation-bootstrap ceiling failure is
  reproduced on exact main in [the baseline proof](creator-offline-baseline.json).

The [device/player packet](device-review.md) gives the remaining hardware protocol,
physical-input checks and five-player worksheet. A blank worksheet is not a playtest.

## Reuse and browser evidence

The [reuse surface](reuse.html) and [browser capture](reuse-browser.png) show one
source PNG decoded once and drawn through Capture's existing BoardPainter and the
Asset Studio adapter. Generate its temporary compiled bundle with
`node scripts/build-overflight-reuse-review.mjs`, then serve the repository.
The renderer does not mutate authoritative gameplay state. This is a paused native
renderer demonstration, not an additional game mode or player trial.

`trial-ui-smoke.json` verifies automatic stop/export on the local Mac during parallel
work, before final source freeze. It is deliberately not clean performance evidence.
Further build/browser receipts will identify their tested source and device.
