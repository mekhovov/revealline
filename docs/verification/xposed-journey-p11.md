# P11 Sentinel Crown — isolated implementation evidence

Status: local technical increment, not a released or human-qualified campaign.
Publication remains with the release coordinator. No public Journey enrollment,
version bump, PR, tag, release or Pages promotion is implied by this record.

## Versioned multi-shield encounter

The legacy encounter supports one shield relay. The successor pins
`xonix-level.v8` / `xonix-core.v9` / `xonix-replay.v10` /
`fnv1a64-state-v9`, with `xonix-encounter.v2`. Earlier level editions retain
their v1 descriptor and reject v2; the successor rejects v1. No historical replay
is reinterpreted. Geometry remains the shared foundation/relay/directional
contract, not a fourth new map mechanic.

One to four distinct, visible, required shield objectives must occupy distinct
earned-field cells outside the core. All must be captured before the single
shield-opening transition. A capture of several relays is one atomic transition;
list order is not a prescribed objective order. The release cut remains fresh
live trail closed during the advertised opening, or the existing isolated-core
fallback. A field-retaining Sentinel is not removed by ordinary enclosure.
New release-cut bounds exclude permanent foundations and gate connectors.

The runtime descriptor describes exact timings for deterministic transport.
Journey authoring selects the frozen `shield-relays-v1` recipe from actor catalog
`journey-actors-v6`, not per-level timing or speed overrides. Existing roles
retain their exact recipes. MissionDesignV4 / ResolvedMissionV4 use MapDesignV3
geometry, with an explicit nullable encounter. The new stationary role retains
its field until the explicit release; presets never shorten its warning.

Scenario/pack v9 transport preserves that runtime edition through Studio preview,
import, editor model, expansion export and installed-pack resolution. Old formats
reject the new descriptor. Foundations, gates, marked fields and flight
information recognize the successor. The legacy one-relay timing form is disabled
for the multi-relay edition; it cannot silently downgrade the encounter.

Studio adds an atomic encounter form: select a core and one to four visible
required shields; place the Sentinel on the core cell, optionally replacing the
explicitly selected field keeper. Other field anchors are not silently removed.
The shared compiler validates every supported preset/mode before adoption.
Older geometry is copied on write; unrelated missions keep their exact manifests.
Replacement preserves geometry. Two-action removal deletes the boss and encounter
links, but retains objectives and map geometry, warns about newly empty-region
fill, and remains undoable. Stale fields and cancelled adoption do not apply.

The functional visual language gains a static three-point crown silhouette,
shield counts and remaining-link cues, plus reclaimed-ground wording. These are
read-only projections. Native visual/layout qualification is still pending.

## Verification

Node 20.19.5 and 22.22.2 each pass **63/63** tests across:

- `game/test/sentinel-core.test.mjs` (eight new tests).
- `game/test/encounter-core.test.mjs` (historical encounter semantics).
- `game/test/directional-core.test.mjs` and `directional-lifecycle.test.mjs`.

New cases cover edition mismatch, owned/accessor-safe bounded shield lists,
distinct eligible placements, one-to-four relay counts, either transaction
order, one transition, freeze/pause clock behavior, and actual legal-input
two-relay clears in Immediate and Grid + Buffer. Public replay reproduces the
clears. Save/restore preserves first-shield and transition states and rejects
changed encounter definitions. An independent legal-input life-loss branch
preserves the first relay; a fresh attempt resets it.

The first route probe incorrectly started its second long cut late in a rest
window and lost a life in both steering modes. The accepted route waits for the
advertised full rest window. Collision, warning and movement rules were not
weakened. These are engine fixtures, not campaign balance or enjoyment evidence.

Local outputs: `.cache/p11-core-node20-r1.tap` and
`.cache/p11-core-node22-r1.tap`.

The combined core/compiler/transport/Studio regression cohort now passes
**122/122 on each Node version**. This includes seven atomic-authoring/control
tests, four compiler/catalog tests and three transport/cue tests, alongside the
eight new core tests and earlier encounter/directional/editor regressions.
Outputs: `.cache/p11-core-authoring-node20-r1.tap` and
`.cache/p11-core-authoring-node22-r1.tap`.
The transport probe found a separate mastery-catalog source-format allowlist;
it now recognizes the new pack only with its matching core and an empty optional
equipment-mastery array. A canvas test initially passed a context instead of the
documented canvas argument; its fixture was corrected without changing rendering.

## Remaining gates

Reference-led greyboxes and optional Remix; all-preset routes,
paired race parity, mastery and lifecycle coverage; final original artwork;
Team qualification; native/accessibility checks; human capture comprehension,
failure explanation and voluntary retry; phase PR/review/version/release/Pages.
No completed phase or whole-plan claim is warranted yet.
