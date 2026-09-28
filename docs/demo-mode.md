# Demo mode

Demo mode presents normal gameplay on installed levels, with recorded routes, a small qualified live-autoplay pool, contextual tips, and an explicit invitation to play. It runs through the ordinary simulation and renderer. It does not change level rules, grant progress, or replace a suspended flight while watching.

This guide describes the working implementation. See the [verification record](verification/demo-mode-2026-09-28.md) for measured results and remaining release gates.

## Player behavior

- **Watch demo** starts immediately from the home screen. Automatic entry waits for 60 seconds of uninterrupted idle time on the eligible home screen. Activity, another dialog, an active flight, a transfer, hidden page, or lost focus prevents that entry.
- Automatic entry defaults on, except when reduced effects are already enabled. Settings can disable it. Automatic collection of personal recordings defaults off and is a separate setting.
- Scenes identify **Recorded play** or **Live autoplay**, name the real level, and show captured area, lives, elapsed time, and tips. Tips follow actual gameplay events and remain readable for at least six seconds before replacement. A completed scene remains for four seconds before rotation.
- A fresh key, controller action, or pointer press interrupts watching and is consumed. That gesture does not also select a menu action or move the practice craft. **Back** / Escape returns to home; **Keep watching** explicitly resumes.
- **Play from beginning** selects that installed level at ordinary Ready when mission access permits it. An unfinished ordinary flight must save successfully before this handoff. A locked level instead starts an isolated fresh practice attempt on the same map.
- **Take over · practice** reconstructs the precise displayed simulation tick, including an unfinished cut, equipment, encounter state, and recovery timing. The new practice run owns its state; neither the recorded run nor the preserved ordinary run advances with it. Terminal scenes cannot be taken over.
- Practice starts with neutral physical input and requires a fresh direction. It supports the applicable keyboard, touch/swipe and controller actions, and hangar craft selection. Practice has no score, picture, unlock, saved-flight or demo-cache writes, and no export control. **Return to demo** discards it.
- Blur, hidden page, native inactivity, controller loss, or a frame gap over 250 ms pauses playback/practice. Returning focus does not resume it. The existing music transport and the user's audio intent remain under the ordinary host; the demo does not start a new soundtrack.

Unearned artwork is a blurred teaser, including after a demo victory. Clear artwork requires the exact earned picture assignment for the installed owner; an old earned picture does not reveal a later replacement. This affects the picture layer, leaving the board and craft readable. Watching or practice never earns the picture.

## Actual content coverage

The base campaign supplies six bundled recordings on four unchanged maps, available without installing an optional pack. These are **human-authored input routes**, generated and verified through the real core; they are not recordings of human play sessions. All use Scout, seed 1, retain all three lives, win, and contain at least three closed cuts and three bends. Durations below are rounded for readability; the catalogue retains exact values.

| Clip ID                | Real level                  | Steering    | Duration | Showcase                                      |
| ---------------------- | --------------------------- | ----------- | -------- | --------------------------------------------- |
| `first-signal-left`    | First Signal (`signal-01`)  | Immediate   | 27.283 s | Left-side bent cuts and return to safe ground |
| `first-signal-right`   | First Signal (`signal-01`)  | Grid center | 27.283 s | Mirrored right-side capture route             |
| `relay-orchard-loop`   | Relay Orchard (`signal-02`) | Immediate   | 17.175 s | Bent loop through the relay layout            |
| `relay-orchard-stairs` | Relay Orchard (`signal-02`) | Grid center | 38.792 s | Staggered expanding capture route             |
| `crosswind-openings`   | Crosswind (`signal-03`)     | Immediate   | 38.392 s | Repeated openings around multiple enemies     |
| `night-patrol-loop`    | Night Patrol (`signal-05`)  | Grid center | 17.175 s | Bent capture with border patrol pressure      |

Bundled recordings keep their authored steering policy. Live autoplay uses the current steering policy and is qualified only for these unchanged Standard R5 map/roster identities:

| Map              | Level ID           | Live variants                            |
| ---------------- | ------------------ | ---------------------------------------- |
| Orchard Crossing | `orchard-crossing` | Seeds 1, 2 and 3; both steering policies |
| Courtyard Exits  | `courtyard-exits`  | Seeds 1, 2 and 3; both steering policies |

Installing the corresponding R5 content gives six live source descriptors in addition to the six bundled clips. An installed themed owner may use the same qualified geometry, but remains a separate campaign identity in rotation. Gentle variants, revised geometry, and different rosters do not inherit bot qualification. **Night Crossfire is not bot-qualified.** Night Patrol in the table above is a different base-campaign map.

Other installed levels are eligible only when a compatible, qualifying personal recording exists in the local demo cache. This implementation does not autoplay every installed level. It never installs or downloads a pack to expand coverage, and it ignores recordings whose owner, level revision, map or class roster no longer matches installed content.

The live bot searches a bounded set of straight and bent capture routes, simulates candidate input sequences in a Worker, and executes normal directional input in the live run. It does not write captured cells or manufacture wins. Planning has a deadline and finite work budget; unavailable Workers, unsafe plans or failed sources fall back to other compatible scenes. The director starts with an approachable recording and avoids immediately repeating the same campaign/level when alternatives exist. Failed sources are skipped for the current demo session.

## Personal recording cache

**Keep for demo** on a completed ordinary run saves that run explicitly. It does not enable **Use my successful runs in demos**. The latter opt-in setting enables future automatic collection; disabling it stops collection while previously saved eligible recordings remain available. **Clear my demo recordings** removes the personal cache without touching ordinary progress, suspended flights, or bundled clips.

The disposable cache is local to the device/origin, in the separate IndexedDB database `revealline-demo-recordings-v1`. It stores at most **12 recordings / 32 MiB**, deduplicates exact owner/run recordings, and evicts the oldest when necessary. It is not part of the ordinary session store or portable player backup. Demo preferences use the channel-specific `revealline.demo.${channel}.v1` settings key. Storage denial, quota failure, cancellation or corruption leaves ordinary game data untouched and preserves the bundled fallback.

Admission requires a completed, non-practice win that passes full replay verification and still matches installed content. The movement heuristic requires 8–180 seconds, at least four direction changes, at least three directions, at most 25% neutral-input ticks, no neutral-input sequence over three seconds, and at most one life lost. These are recorded-input criteria, not a measured guarantee of enjoyable viewing. A selected recording is verified again when playback prepares.

## Implementation interfaces

| Module                                    | Responsibility and principal interface                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game/demo-catalog.mjs`                   | Bounded `loadDemoCatalog`, `resolveDemoCatalog(catalog, entries)`, `demoIdentity`, `demoReplayMatchesEntry`, and `loadDemoRecording(clip, { fetch, signal })`. Catalogue descriptors pin campaign owner, level revision, map/roster identity, provenance, tags and a bundled relative replay URL.             |
| `game/demo-sources.mjs`                   | `loadDemoSources({ entries, library, turnPolicy, signal, fetch, WorkerClass })` resolves only the supplied installed execution catalogue. Returns lazy scene descriptors with `create({ signal })`; preparation and catalog fetches are cancellable.                                                          |
| `game/demo-director.mjs`                  | Owns rotation, one current player, cancellation generations, failure quarantine and disposal. The host owns the result dwell and presentation.                                                                                                                                                                |
| `game/replay-player.mjs`                  | Existing verified playback plus `forkForPractice({ signal, onProgress })`, owned `exportRecording()`, and idempotent `dispose()`. A fork reconstructs a private recorded prefix, checks its exact authoritative checkpoint, and rejects playback changes, mutation, terminal state, disposal or cancellation. |
| `game/demo-bot*.mjs`                      | Qualified map checks, bounded planner, Worker transport and ordinary-input live player. The player provides the same `state`, `phase`, `play`, `pause`, `advance`, `forkForPractice`, `exportRecording` and `dispose` capabilities.                                                                           |
| `game/demo-library.mjs`                   | `createDemoLibrary({ storage, enabled, now })` exposes `setEnabled`, `keep`, `list`, `clear`, `dispose`. `keep(replay, { entry, practice: false, manual, signal })` separates one-off retention from automatic opt-in. Storage is lazy and injectable for tests.                                              |
| `game/demo-experience.mjs`                | Idle eligibility clock, event captions, settings defaults and the ephemeral practice runner. No progression or persistence adapter is available to practice.                                                                                                                                                  |
| `game/ui/demo-host.mjs`, `demo-input.mjs` | Modal lifecycle, focus and first-gesture boundaries, settings, handoffs, rendering and shared controller sampling. `app.mjs` owns ordinary session preservation and permission to enter a normal level.                                                                                                       |
| `game/ui/demo-picture.mjs`                | Exact earned-picture visibility and media ownership. The renderer applies the bounded blurred picture layer.                                                                                                                                                                                                  |

A replay fork returns `{ run, origin }`, where origin identifies its source, level, tick and ruleset. The replay controller stays paused and unchanged. The practice adapter releases held input on the new run only. Exact reconstruction preserves input-release markers at RLE boundaries; it does not depend on a shallow copy or serialize/restore a suspended game.

The ordinary build collects the `game/` tree, excluding tests, so the catalogue, six replay assets and Worker module ship in source and distribution builds. Dynamic asset inclusion has a regression test. New clips must be added with compatible installed identities and real verified recordings; widening the bot whitelist requires new map/roster qualification rather than an ID-only match.

## Commands and automated coverage

From the repository root:

```sh
# Reproduce and compare the six committed authored recordings.
node scripts/build-demo-recordings.mjs

# Targeted complete demo and existing replay-player tests.
node --test game/test/demo-*.test.mjs game/test/replay-player.test.mjs

# Accelerated simulation soak with real Node Worker threads.
node --expose-gc scripts/soak-demo.mjs --simulation-seconds 7200 --report .cache/demo-soak-report.json

# Repository checks and ordinary distributable.
npm test
npm run lint
npm run validate
npm run build

# Inspect the source or the generated distribution.
node scripts/game-cli.mjs serve --port 8768
node scripts/game-cli.mjs serve --root dist --port 8769
```

Run the accelerated soak without a concurrent CPU-heavy suite: the production planning watchdog deliberately drops sources that cannot finish within its deadline. The soak records tested source hashes and fails if those files change during qualification. Its simulation duration is not elapsed wall time.

`build-demo-recordings.mjs --write` creates new files only and refuses to overwrite committed assets. The default verification command is the appropriate routine check.

| Test area                                      | Coverage                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `demo-recordings` and `replay-player`          | All six authored wins; source identity; exact fork across four core branches and both steering policies; release markers, live cut, equipment bank, support field, Impact recovery and staged encounter phases; cancellation and disposal. |
| `demo-library`                                 | Manual/automatic distinction, practice/incomplete/tampered/stale rejection, quality admission, dedupe, bounded eviction, snapshots, opt-out during verification, missing storage and failed writes.                                        |
| `demo-sources`                                 | Real installed catalogue, lazy six-replay/six-bot pool, duplicate map IDs under distinct owners, unavailable Worker, cancellation, wrong fetched recording, local cache and dynamic build assets.                                          |
| `demo-bot` and `demo-director`                 | Qualified seeds/maps, ordinary-input wins and checkpoints, real Worker lifecycle/watchdog, no safe future macro, source rotation, failure fallback, stale preparation and lifecycle suspension.                                            |
| `demo-experience`, `demo-host`, `demo-picture` | Idle/settings/captions, real app handoffs and save preservation, consumed interruption, focus/cancellation, controls, locked-level practice, exact earned image access, blur and resource disposal.                                        |

## Release gates still required

Automated deterministic wins establish legal playback and state continuity. They do not establish attraction, understanding, comfort, rendering performance, or physical-device behavior.

1. **Three unfamiliar human viewers:** observe without prior instruction, then try the game. Record whether they understand leaving safe ground, bending and reconnecting a cut, exposed-line danger, pause/hand-off choices, and the difference between practice and normal progress. Ask which scenes held attention and where they became confused. Use those observations to revise pacing and tips.
2. **At least two wall-clock hours on the intended browser/native targets:** exercise actual rendered rotation, focus/background pauses, explicit resume, source failure and practice/return. Measure resource growth, frame pacing and battery/thermal behavior where relevant. Record exact build, OS, browser/runtime and device; the accelerated Node soak does not satisfy this gate.
3. **Physical input and native lifecycle:** verify keyboard, touch and real controllers where supported, remapped controls, Hold/Toggle behavior, disconnect/reconnect, OS background/foreground and safe return to the preserved flight. Software fixtures and viewport emulation do not qualify hardware.

Keep these results tied to the exact source/build being released. Final distribution/offline checks, broad repository results and browser observations belong in the verification record; pending gates must remain explicit.
