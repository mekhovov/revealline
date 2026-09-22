# v0.82.0 integrated effects source review

September 22, 2026. Scope: functional presentation inputs in integration
`e2f0803c3797878bd30a2e59ac31ffacbea55a10`, compared with main `12224540`.
This is not final visual, human, physical-device, audio, offline or public approval.

## Failure and repair

PR run [35671873875](https://github.com/mekhovov/revealline/actions/runs/35671873875)
correctly rejected the stale production ledger. The incoming renderer changed
effects inputs without a composed production successor. Source-stage fpv55 and
fpv56 preserve that unreviewed state. The reviewed successor is fpv58; prior
records and all 127 original payloads remain unchanged. No PNG is regenerated.

The effects fingerprint now also includes the new relay/directional painters and
the actor-label catalogue. A helper edit must reopen the same review group.
The eight ordered inputs are:

1. `game/ui/classic-view.mjs`
2. `game/ui/event-feedback.mjs`
3. `game/content-design/actor-marker.mjs`
4. `game/ui/lane-presentation.mjs`
5. `game/ui/render.mjs`
6. `game/ui/relay-view.mjs`
7. `game/ui/directional-view.mjs`
8. `game/enemy-catalog.mjs`

Concatenated SHA-256:
`13a140c0872eaa646b79f26c068b90527a1d0034131284bbbe9f5b5a5e3829d9`.
The recipe-source regression verifies that changing each added helper invalidates
only its effects group, and missing input bytes cannot create an approval.

## Independent functional review

The independent reviewer recomputed that digest and found no gameplay, clock or
input mutation in these inputs. The event-feedback input is unchanged from main.
Views copy bounded, getter-free facts; painters preserve checkpoint authority and
canvas state. Reviewed interactions include terrain concealment/neutralization,
the inclusive lane-contact envelope, fixed-clock timed pickup cues and terminal
suppression, relay labels/open patterns, directional arrows, compact pressure
labels, optional robot silhouettes, and Team canvas-failure unwinding.

The independent presentation/transport/authoring and actor-guidance cohorts passed
132 checks per Node 20.19.5 and 22.22.2. Two additional actual Team-host cases
correctly failed while the regenerated theme no longer matched the old exact
fpv54 picture binding. They are explicitly not counted as passes. The repair
pins fpv58, retaining the exact Orchard/Foundry asset IDs, revisions and PNG
hashes; it does not admit arbitrary or latest revisions. Final host reruns and
full PR CI remain required.

The main agent's separate 100-check projection/painter/transport/authoring and
fingerprint cohort passes on both supported Node versions. All old ledger asset,
theme, base and collection records and all 127 original payload byte arrays were
compared against main; none changed. The build's asset directory also remains
byte-identical. These checks support scoped metadata compatibility, not approval
of new artwork or gameplay balance.

Before regeneration, native checks of this integrated source covered direct
Solo start/P pause, saved Solo-to-Team departure, exact Journey return links,
Team reclaimed-ground Help, direct Start and two-action Skip. They are not
represented as final fpv58 browser observations.

## Motion/material successor

Seven rotor recipe slots independently reopened their motion review because the
actor adapter now selects explicit Journey material bodies. The final fpv58
successor includes this separately reviewed group; intermediate fpv57 retains
effects approval but its source-stage motion entries are not a release pass.

Ordered inputs: `authoring/motion-lab/render-character.mjs`,
`game/ui/actor-presentation.mjs`, `game/presentation/journey-actor-materials.mjs`.
Concatenated SHA-256:
`ef5ede43180597ba413e26f2042d9f99a06c2f70a224b0d8d5543d384688ea76`.
The unchanged Motion painter and body-only adapter preserve clocks, positions,
radii and role badges. Explicit skins/uploads take precedence; historical theme
IDs and unknown roles retain their fallback. The fixed table contains 84 bounded
recipes, not per-tick allocations.

An independent six-suite cohort passes 54/54 on each supported Node version:
actor-presentation, journey-actor-materials, journey-actor-edition,
team-journey-actor-material, player-body-layout and enemy-body-motion. Coverage
includes seven connected role masks across twelve materials, 498 unchanged
Solo/Versus identities, 36 Team identities, contact/checkpoints, overrides,
pause/reduced behavior and fitted-edge envelopes. The main agent's separate
55-check actor/material/fingerprint cohort also passes both Nodes.

## Final repaired-byte verification

The independent full presentation/guidance cohort on stable fpv58 passes
**134/134 on Node 20.19.5 and 22.22.2**, with no failures, skips, cancellations
or todos. Both previously failing actual Team host cases now pass. The main
agent's 69-check Team binding/actor/history/fingerprint cohort passes on both
versions, retaining the old historical-oracle assertions and reproduction checks.

A direct independent import comparison against main verifies all 1,477 prior
asset records, 293 slots, 55 prior theme records, one collection and all 127
payloads are unchanged. The appended theme chain is 54 → 55 → 56 → 57 → 58.
Only the exact active picture theme revision changes, not its pack, mission,
asset identity or image bytes. Generated source is reproducible, and the ledger
declares all 194 required slots reviewed with 99 optional source slots.

Native localhost verification after final fpv58 generation confirms First
Connection reaches picture-ready and Start enters the shared playable board.
This is a narrow launch check, not a full final-byte visual or device audit.

## Limitations

Sentinel's Studio marker still uses brief isolation shorthand; detailed live
encounter guidance specifies CORE OPEN and no-live-line return conditions.
Whole-screen contrast, small devices, physical two-player controls, subjective
effects quality, voluntary retry and release verification remain open in the
completion ledger. This source approval cannot close those gates.
