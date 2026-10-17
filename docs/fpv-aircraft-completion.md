# Aircraft implementation and remaining evidence gates

This record follows the approved twelve-aircraft plan of 17 October 2026. The
first live-testing release is independent of later archive and endurance work.
Publication is complete only after protected checks, deployment, and public-player
acceptance; a local test or open pull request does not establish availability.

## Delivered software increments

| Plan area                 | Implementation                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compatibility and catalog | Twelve immutable reference revisions, installed component accounting, separate propeller diameter and wheelbase, per-field evidence, and bounded numerical configurations. Existing backends and recordings remain supported.                                                                                                                                                         |
| First playable release    | Aircraft-aware Academy, World, Regional, lesson/course and draft practice; independent editable setups; starter rates or retained rates; physical camera/battery edits; complete collision geometry; continuous practice and bounded recent clips. [First-release acceptance](fpv-aircraft-presets.md).                                                                               |
| Persistent recording      | Atomic local segment archives, bounded exports, explicit deletion, cancellable verification in a separate worker, durable-range reporting, and checkpoint-origin versus complete-session results. Storage failure leaves flying available. [Archive design and evidence](fpv-aircraft-archives.md).                                                                                   |
| Ghost memory              | A verified reference retains at most 8,192 geometry samples, including its exact endpoints. Deterministic sampling increases the interval for longer flights; position/quaternion interpolation is for display only. The UI labels sampled ghosts as approximate. Every underlying simulation interval is still replayed and verified.                                                |
| Propulsion evidence       | Bounded local datasets with explicit components, units, conditions, provenance, license and uncertainty; deterministic interpolation within declared coverage; no fabricated extrapolation. The Advanced panel inspects data and compares equivalent thrust only within the selected aircraft's battery-voltage range. [Evidence format and limitations](fpv-propulsion-evidence.md). |
| Optional depletion        | Off by default; explicit saved choice, real simulated charge consumption, fresh-battery restart, and preserved charge on resume/recovery. Mass, sag and power limits remain active when depletion is off. [Battery behavior](fpv-aircraft-endurance.md).                                                                                                                              |
| Optional challenges       | Explicit timed or battery-endurance attempts, accepted-tick clocks, frozen rules, full-aircraft contact checks, resumable progress and independent archive outcome verification. A result never imposes a flight cutoff. [Challenge rules](fpv-aircraft-challenges.md).                                                                                                               |

The archive initialization regression found during integration is corrected:
background boundary reads preserve the player's Arm request, while restoration and
final-tail sealing retain their stronger guards. The World host's file-input styling
also covers archive imports mounted directly in Advanced practice.

Live Regional testing found a second recording issue: the Canyon Badlands checkpoint
was about 1.8 MB, exceeding the 1 MiB segment threshold before new inputs were added.
After the first timed rotation this caused a new checkpoint every mission interval
and retained only 0.04 seconds. Segment rotation now counts appended inputs and
verification hashes separately from checkpoint overhead. Checkpoints still count
fully toward the total retained-memory limit. Saved formats, physical state hashes
and historical playback identities are unchanged; restore reconstructs the same
stream counter from the saved events and hashes.

The source-pinned [Canyon recording check](fpv-regional-aircraft-recording-qualification.json)
ran the production Regional session for 65 simulated seconds with recording enabled
and disabled. The 1,794,160-byte loaded terrain checkpoint produced exactly two
segments, retaining 0–65 seconds in 2,276,715 bytes. All 65 per-second physical
hashes matched between runs. Recording-enabled execution took 24.443 seconds
(2.659 times real time), compared with 24.132 seconds without recording. This
single-machine check includes preparation, terrain admission, physics and recording
through an in-process client. It excludes browser rendering, worker transport,
IndexedDB and travel across the full region; it is not wider-platform qualification.

The corrected local browser build subsequently retained the complete 0–87.90-second
Canyon clip, saved a recovery point at 85 seconds, and durably archived the first
60-second segment. Finishing saved the remaining segment; independent worker replay
reported complete-session physics verified from reset. This exercises the player UI,
worker transport and local archive storage, without claiming a browser timing result.

## Public first-release acceptance

The GitHub Pages deployment of `20459d449713ffc4d20143e39a8ea0cd0be90bb2`
passed its build, deployment and exact-source verification on 17 October 2026.
The public browser checks confirmed all twelve picker entries, a new Meteor75 setup
with Actual starter rates and touch-controlled takeoff in World, an X650 setup with
300 degrees/second starter rates in Academy's Lift and land practice, and X650
Regional practice in the downloaded Canyon Badlands preview. Shared setups were
retained between hosts; Academy and Regional both saved durable recovery points.
These checks used an existing authenticated browser session, not a new password entry.
The recording correction above and the archive/challenge additions are a separate
follow-up release; this first-release receipt does not establish their publication.

## What numerical qualification establishes

The source-pinned [numerical](fpv-aircraft-numerical-qualification.json) and
[browser](fpv-aircraft-browser-qualification.json) reports compare 250, 500 and
1,000 Hz with a 2 kHz reference. The selected 500 Hz backend passes the 2% response,
contact-consistency and twice-real-time gates on the recorded qualification machine.
Direct and worker traces match across the recorded Node, Chrome, Firefox and WebKit
versions. These tests establish the consistency and capacity of this implementation.
They do not measure a real quadrotor or qualify every browser/device architecture.

The catalog remains a specification-based model. Static tables in the active
physics record are numerical model inputs; the separate evidence inspector does
not activate imported observations. No measured whole-aircraft fidelity is inferred
from deterministic replay, a synthetic dataset, or another motor/propeller pair.

## Evidence-dependent work retained for later

These are explicit qualification gates, not hidden limitations on ordinary practice:

1. Activate measured propulsion maps only after matching motor, propeller, ESC,
   voltage, density and flow conditions, validating the electrical solver and
   allocation, and versioning any changed simulation behavior. The current
   one-dimensional evidence path cannot establish a multidimensional map.
2. Fit motor transients, inertia and directional drag against appropriate bench
   measurements or aircraft logs. Published static curves alone cannot validate
   high-speed response or complete-aircraft handling.
3. Add measured propwash and ground effect when supporting evidence is available.
4. Complete radio/device, wider-platform and experienced-pilot comparison sessions.
   The user explicitly made their current absence nonblocking.
5. Promote Advanced aircraft to scored comparison classes only after those separate
   gates pass. Current physics/challenge verification remains unscored, and old
   competitive and replay identities retain their original rules.

Current manufacturer checks reconfirm the [Pavo20 Pro II camera-equipped variant](https://betafpv.com/products/pavo20-pro-ii-brushless-whoop-quadcopter)
and [X650 V2 MN4014/Gemfan configuration](https://holybro.com/products/x650-development-kit).
The component inventory follows the lesson from [Liftoff's Air65 weight correction](https://www.liftoff-game.com/news/full-release-liftoff-micro-drones):
installed motors and propellers must not be added again to an assembled mass.
These sources support configuration choices, not a claim that our simulator matches
the manufacturer's flight behavior.
