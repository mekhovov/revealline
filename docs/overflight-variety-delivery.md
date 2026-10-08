# Overflight variety, armor and sound

Implementation of the reviewed 5 October plan. This remains a local review
candidate; publication, target-laptop certification and human acceptance are
separate from automated correctness evidence.

## Shared foundation

The branch incorporates main `e3e1e8b8d` and the shared mission browser from
PR #1108 at `55dc4c2dbe`, above the Overflight/audio stack ending at PR #1119.
Dependency integration commit: `c1008a793`. The merge preserves both native
destruction audio and the shared navigation/optional simulator projections.

V2 projects add explicit difficulty and a bounded shared combat profile. The
existing compilers admit V1 with legacy behavior. Creator's **Make updated copy**
keeps imported source and installed originals intact; authored positions and
encounters survive conversion. Both Studios edit the profile used by native play.

Raid V2 records use `overflight-hunt-records.v2`; historical projects continue to
use the original V1 bucket and pinned rules identity. Current history includes
difficulty, content, seed, airframe count and slow-resume settings. Appearance,
audio and display preferences do not fragment records.

## Review intent

- One Overflight home, with Survivor and Raid operations and shared mission browsing.
- Seeded formation variety, stronger Standard, immediate Veteran, and bounded relief.
- Distinct flank, interception and exposed-return approaches with honest telegraphs.
- Functional enemy guards/armor; optional 10%/20% player plating, exclusive with shields.
- Two finite guarded caches with physical repair/recalibration choices.
- Existing ESC start/retry and owned rotor audio; short optional humanoid reactions.
- Shared Settings/Studios, preserved old content, and native visual upgrade comparisons.

## Evidence policy

Automated probes establish exact damage, rewards, legal drafts, deterministic
state, old/new package coexistence, input transitions and source cleanup. Native
browser captures establish presentation and navigation behavior. Neither establishes
subjective enjoyment or recording quality.

The Iris Xe/Windows/Chrome 60 FPS target and five-player/two-run review remain
required before release qualification. Captures must run separately from frame
measurements; a controlled fixture does not establish actual encounter pacing.

Research references and adaptation rationale are in the approved chat plan:
Valve's Left 4 Dead pacing presentation, Subset's Into the Breach design interview,
Roll7's Rollerdrome combat guidance, and FMOD voice/playlist guidance. Numerical
values are initial project tuning, not values prescribed by those sources.

## Delivered review candidate

The source server runs on `http://127.0.0.1:8888/game/overflight/play.html`.
Implementation and source-bound evidence commit: `1d391584ca150d498104668370a72adce6ea1965`.
Survivor and Raid share the Overflight hub and mission browser. Settings expose
Standard/Veteran, the seven cosmetic drones, and all existing Studios. An installed
or authored project's difficulty is preserved rather than overwritten by the
official encounter preset.

Survivor's seeded formation windows are 30–45 seconds including their reduced
spawning interval (8 seconds Standard, 5 Veteran). Relief waits for already
committed warnings and provides its full interval. A successful mass clear also
earns space. Directional shields, segmented machinery armor and lane/fan/ground
warnings make positioning matter. Pulse charging now uses displacement from the
last release instead of cumulative tiny-circle distance; legacy rules retain
their previous behavior.

Reactive plating reduces received damage by 10%/20% and cannot stack with shield
support. Two independent guarded caches offer deliberate physical repair or
recalibration pickups; a clearing pass cannot accidentally spend the reward.
Pool exhaustion cannot retire their guards as if the player had defeated them.

Eight short acted humanoid reactions supplement the existing material impacts.
The shared gore setting and separate reaction toggle control them. Native and
optional modes use the same warning priority, shuffle/no-repeat policy and voice
limits. Existing ESC launch/retry and rotor ownership are reused. The
[audition page](../authoring/audio/human-reactions-v1/audition.html) includes original
and processed takes; provenance, CC0 evidence and a reproducible producer remain
with the assets. No listening-quality claim has been made.

Both Creator Studios edit the applicable V2 combat controls and preview the same
compiled definition as native play. Raid omits Survivor-only absorption, hull
partition and spawn-relief controls. New packages coexist with V1 projects and
records; updating old content is an explicit new-copy operation.

## Verification and remaining gates

- Integrated regression run: **437/437 passing**, covering gameplay, UI hosts,
  audio, preferences, packages and offline closure. The final cache-exhaustion
  correction has an additional **11/11 combat regression** run. Final UI access
  changes passed a separate **25/25 host/presentation** run.
- **44 deterministic route trials**, retained with source SHA-256 bindings and a
  reproducer: `node scripts/qualify-overflight-variety.mjs`. Raid's 24 trials
  include baseline kits; all complete. All 18 Survivor build/set/difficulty
  combinations have a viable route. Two failed Veteran routes are retained next
  to successful alternatives, rather than removed from the evidence.
- Native EN/UK navigation, Settings, drone selection, role guide and combat
  captures are in `qualification/overflight-variety-20261005/native/`. Root also
  verified editing guard integrity, validation, native Creator preview, updated
  copy preservation and Ukrainian Raid validation through visible controls.
- Creator package export/import into fresh profile backends preserves exact
  compiled identity alongside original V1 content. Revised Raid records remain
  separate from V1 history.
- Changed-source ESLint and formatting pass. Localization, game/content
  validation, presentation metadata and all generated optional-source checks
  pass. The stale shared-shell projection discovered by validation was regenerated.

The automated Raid pilot completes in roughly 20–56 seconds and the native
breaker capture in 59 seconds. These are expert deterministic routes, not evidence
of the intended 4–7-minute newcomer pacing. Winning Survivor probes peak at
221–447 visible enemies; 600–800 visible enemies in enjoyable actual play remains
unqualified.

Before release: run the Iris Xe protocol, 1,500-enemy renderer regression,
15-minute soak, repeated native retries/context recovery, physical gamepad review,
and five-player/two-run study. Review reaction recordings and warning/music mix on
real speakers/headphones. Check complete native Creator round-trips, including
manual import and cross-mode reuse. Automated simulation and package tests do not
replace those checks. No full distribution rebuild or publication was performed
because local disk headroom is unstable.

The implementation is stacked above draft dependency-integration PR #1120, which
combines #1119 and #1108. No upstream PR was merged. Existing worktrees, source
files, recordings and unpushed commits were preserved. To relieve disk pressure,
119 byte-identical generated build files were replaced with verified APFS
copy-on-write clones; both their paths and contents remain available. The local
receipt is `/tmp/overflight-cow-dedup-20261005.json`.
