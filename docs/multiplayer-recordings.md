# Local Capture recordings: exact v1 and terminal-observation v2

New terminal Capture Versus/Team exports use
`revealline-local-capture-recording.v2`. Historical v1 recordings retain their
exact native-state verification. No imported v1 recording is automatically
converted, rounded or retried under a weaker contract.

The successor addresses the observed Chrome/Node difference in low-order native
floating-point values without claiming portable, bit-identical simulation.
It verifies an explicitly narrower terminal observation contract. Both formats
reconstruct the complete input timeline through the original native engines;
neither imports actor positions, restores a checkpoint, grants progression or
proves human play or publisher authority.

## What is compared

Every v2 export retains its exact accepted recipe, source ownership, seed,
options, build and ordered consumed commands/releases. The recipe and input
journal each have a SHA-256 digest. Limits remain 4 MiB, 240,000 ticks and 32,768
segments. Both paired boards and both Team seats remain covered.

The final record carries two separate digests:

| Field                 | Meaning                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `stateSha256`         | Exact complete native state, including typed arrays, maps and sets; a diagnostic whose equality is reported as `exactStateMatch`. |
| `observationContract` | Fixed `revealline-capture-terminal-observations.v1`; unknown versions are rejected.                                               |
| `observationSha256`   | Exact SHA-256 of the declared terminal observations, reported as `terminalObservationMatch`.                                      |

The observation implementation is
[`game/multiplayer-terminal-observation.mjs`](../game/multiplayer-terminal-observation.mjs).
It selects named fields; it does not discover numbers by size, round coordinates,
apply epsilon comparisons or erase arbitrary decimal places. Its scope is:

- Native terminal tick/status; Versus protocol, deadline, winner and reason;
  board scores/lives/medals/failure causes; integer claimed and claimable counts.
  Coverage and elapsed seconds are represented by their native counts/ticks,
  rather than an additional floating representation.
- Every field cell, terrain, permanent/revealed eligibility and claimed-history
  array; native live trail cell order; relay gates and objective IDs/states.
- Accepted class history, held native action flags, queued directions and loadout
  ammunition/capacity. Team additionally includes seat status/cell/direction,
  live cuts, input-neutral flags, reserves, capture credits, rescue and Support
  counters, stronghold/anchor states and discrete emitter/impact ownership.
- Hunt counters, ordered actor IDs/alive states, native actor RNG words, phase
  names and integer phase deadlines, projectile IDs/owners/expiry ticks, ordered
  elimination IDs/causes/ticks/Team attribution. Pursuit includes discrete
  behavior/cursor/heading/partner state. Timed pickups include collection ticks,
  schedule phases/anchors/counts and integer effect windows.
- Capture-Snake catch IDs/counts/order, chains/bonus score and per-seat capacity.
  This is the Capture extension, not the separate Classic Snake session format.

Continuous actor/projectile coordinates and velocities, pursuit destination
coordinates, computed movement paths, exact cable shape/length, second-based
cooldowns/timers, presentation clocks, event payloads and other unlisted internal
fields are outside this contract. They remain in the raw state digest. Even a
large difference in an excluded coordinate cannot be called an exact-state
match merely because the declared observations agree. The reconstructed state is
always the verifier's native state; excluded uploaded positions are never used.

The contract does not certify identical intermediate trajectories or future
deterministic behavior. If runtime differences affect a declared observation
(a hit, objective, cell, phase, score, target or completion tick), v2 rejects it.
Supported cross-runtime behavior still requires native exported-file review.
Changing the declared fields requires a new observation contract version.
This contract explicitly admits Capture rulesets `xonix-core.v2` through `.v16`
and Team rulesets `revealline-coop.v3` through `.v16`. The list is pinned rather
than derived from the engine registry; new native generations fail admission
until their observation contract is reviewed. Both Versus boards must use the
same accepted ruleset. V1's exact native-state reader is unaffected by this guard.

## Result and qualification semantics

For v1, `match` means the exact recorded native state matched;
`terminalObservationMatch` is `null` and `verificationScope` is
`exact-native-state.v1`. The existing strict digest is unchanged.

For v2, `match` means terminal tick/status and the declared observation digest
matched. `exactStateMatch` is always reported independently. A mismatch in only
the raw digest produces a visible diagnostic, not a claim that the full state
matched. Playground uses distinct EN/UK result text and exposes both booleans.
`authority` is `local-terminal-observations-only`.

The pilot verifier still pins the exact official recipe/source/seed/pace and
requires a reconstructed won Team mission or at least one won Versus board.
A valid loss or timer/collision-only Versus win does not establish a completion
route. V2 qualification emits `pursuit-pilot-recording-receipt.v2` with
`native-terminal-observation-completion` and the separate exact-state result.
V1 and other native proof receipts keep their original interpretation.

## Evidence boundary

The retained 4 October Crossing Post and Pincer Yard files are genuine v1 exports.
They are not relabelled as v2 evidence. Their Chrome success/Node failure remains
recorded in the original review. A fresh v2 Crossing Post clear now passes the declared observations in both Chrome
and Node 22; Chrome also matches the raw state digest, while Node reports it
as different. See [the continuation evidence](qualification/industrial-art/briefing-studio-2026-10-04/README.md).
This demonstrates this one route, not universal cross-runtime simulation. Team
v2 exports and additional native engines/devices still need equivalent review.

Regression sources cover strict historical handling, v2 mismatched topology,
objectives, actor identities, RNG, elimination attribution, Team seats/counters,
input hashes, cancellation and honest UI labels. They are authored but unrun
under the repository's automated-suite waiver. Static validation and source
build checks do not substitute for those native cross-runtime observations.
