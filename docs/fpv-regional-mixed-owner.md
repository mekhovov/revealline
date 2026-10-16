# Verified terrain and scenery in one regional frame

This is an unscored authoring prerequisite. It does not admit regional worlds to
the public SIM catalogue, change World.v1, or qualify a release package.

## Contract

`createRegionalFlightPrototype` accepts the explicit
`geometryProfile: 'terrain-scenery-v1'` option, the existing terrain `manifest`
and `source`, and `scenery: { manifest, source }`. The two standard
FPVRegionManifest.v1 documents must agree on region ID, revision, grid, cell
identities and spawn positions. Each retains its own canonical GLB/collision
assets, hashes and bounded source URL. No arbitrary geometry or preparation
callback can substitute for verified sources.

`createVerifiedMixedWindow` stages two private verified owners. Neither can
attach to the host by itself. Both finish source verification, canonical
geometry checks and collision construction before combined pose admission and
the synchronous frame transaction. The visible group contains both layers and
one origin. Only then are both previous owners disposed. Failure, supersession
or cancellation retains the entire previous pair and disables readiness and
queries. Retry remains deliberately paused until a fresh arm action.

The combined receipt retains terrain and scenery source hashes under every
resident `chunkId`. Its origin remains compatible with the existing shared
flight, input and camera presentation. Physics, command quantization, scoring,
recording and proof policies are unchanged.

## Query and resource policy

- Support chooses the nearest ground/roof below the query. Sweeps choose the
  earliest hit in either layer. Unknown geometry in either layer remains
  unknown; one clear layer cannot conceal a missing companion.
- Pose admission requires support and rejects a body intersecting scenery.
  Authored terrain supplies ground; the companion fixture removes duplicate
  scenery ground triangles.
- Hard combined source allowance is 32 MiB. Hard combined geometry allowance is
  10 MiB. Both include retained resources plus both staged successors. Callers
  can lower these through `geometryBudgets` but cannot raise the ceilings.
- Fresh required-only source owners prevent independent optional prefetch from
  escaping the combined allowance. The terrain grant is known from its fixed
  lattice; scenery receives only the remaining geometry grant, capped at its
  existing 8 MiB profile ceiling. Reservations are exposed in snapshots.
- Geometry accounting covers typed positions, normals and indices, as existing
  profiles do. It is not a claim about total browser heap, decoded temporary
  buffers, GPU allocation or Rapier internals.
- Both admission modules now use production `initWorldRuntime`. Previously each
  initialized the same pinned Rapier module independently; concurrent terrain
  and scenery construction could replace its WASM instance while query worlds
  were alive. One initialization authority preserves those worlds.

## Verification

Run `node authoring/fpv-worlds/regions/verify-mixed-window.mjs` for eight functional
scenarios using real canonical GLBs, pinned Three and Rapier, source hashes and
the shared production air transition. No fake collision or alternate physics:

1. Terrain ground, scenery roof and wall queries select the correct layer;
   unknown cells and copied paired provenance remain honest.
2. Corrupt terrain successor retains both old layers and permits a clean retry.
3. Corrupt scenery successor does the same.
4. Delayed scenery cannot publish terrain early; cancellation releases staging.
5. A cancelled host attachment rolls back the whole group.
6. Combined retained/staged source and geometry ceilings fail before fetching.
7. Mismatched companions reject before transport; blocked poses retain the frame.
8. Commanded flight crosses two origins in 2,145 ticks with zero contacts,
   preserving body position, velocity, orientation and ticks across preparation.

Pass the generated Urban companion directory as a second argument to verify all
nine actual paired cells and both authored spawns. The reviewed `urban-mixed-r2`
fixture reached a maximum committed geometry total of 821,388 bytes. Each spawn
also completed 50 active hover ticks without contacts. Fixture generation and
license provenance are owned by the separate Urban companion preparation.

Existing frame transaction (12), flight (6), input session (8), verified terrain
(12), and verified scenery (11) checks also passed after initialization reuse.
The original free-air parity, retained-frame cancellation and input ownership
checks remain applicable. These are local functional observations, not hardware,
GPU performance or package qualification.

Browser review of the real paired Urban study loaded both layers (260,472 bytes
at the mill-court start), then exercised Arm, 93 commanded throttle ticks, Pause,
FPV view, and Reset to zero ticks/disarmed. An invalid companion manifest left
the existing scene visible. Cancelling an explicit Load/restart after session
replacement left a paused empty new session; **Prepare** recovered both layers
at zero ticks/disarmed. That explicit restart path deliberately replaces the
session and is not evidence of same-owner streamed-frame retention. The latter
is covered by the functional corruption/cancellation scenarios above.

The cancellation feedback follow-up keeps setup open on cancellation or failed
preparation, ignores stale completion when deciding whether to collapse it, and
restates the paused recovery action after pending work settles. No unexpected
arming or console errors were observed in the browser review; the expected
missing-manifest network response was not counted as a renderer error.

## Review entry and remaining work

The authoring flight preview adds an explicit **Terrain + companion scenery**
selection and companion manifest URL. Both manifest downloads use the existing
bounded UTF-8/schema path and abort signal. **Cancel loading**, pause, reset,
shared cameras, keyboard, touch and controller adapters remain available.

This increment still uses strict canonical geometry profiles and required-only
window loading. It does not add texture decoding, empty scenery cells, predictive
streaming, production host admission, offline regional installation, device
performance qualification or scored regional recordings. Those need separate
reviewed increments. `playerReady` and `flightReady` remain false.
