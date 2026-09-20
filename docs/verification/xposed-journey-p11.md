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

The runtime descriptor still describes exact timings for deterministic transport.
Journey authoring will select a shared catalog recipe, not per-level timing or
speed overrides. This core increment alone does not expose Studio authoring.

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

## Remaining gates

Shared actor/encounter catalog and compiler; transport and Studio controls;
multi-shield cues; reference-led greyboxes and optional Remix; all-preset routes,
paired race parity, mastery and lifecycle coverage; final original artwork;
Team qualification; native/accessibility checks; human capture comprehension,
failure explanation and voluntary retry; phase PR/review/version/release/Pages.
No completed phase or whole-plan claim is warranted yet.
