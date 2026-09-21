# Twelve-mission Team pressure assessment

This is offline candidate verification, not human balance, a new public release,
or an exported Team replay format. Shared hosts, content recipes and published
editions are unchanged. The source is the explicit pressure-v2 projection of
`createTeamJourneyCandidates()`: twelve missions in five actual campaigns/packs,
grouped into three editorial learning arcs.

## What is stronger

| Preset   | Keeper cells/s | Reclaimed roamer cells/s | Shared reserves |
| -------- | -------------: | -----------------------: | --------------: |
| Gentle   |            2.4 |                      1.6 |               4 |
| Standard |           3.36 |                     2.24 |               2 |
| Expert   |            4.2 |                      2.8 |               1 |

Craft speed stays10 cells/s. The roamer warning stays120 fixed ticks (one second).
These qualified Team roles have no attack-rest cycle: this pass tests movement
pressure, not a nonexistent cadence change. All36 manifests survive exact export
and reimport through the real Team pack boundary with distinct candidate identities.
Old maps, objectives, terrain and runtime editions remain intact.

## Reproducible initial assessment

`node scripts/assess-team-pressure.mjs [mission-id|all]`

Sparse checkouts may add the existing read-only fixture adapter. The command only
prints JSONL. It first checks41 historical route templates with joint cuts on/off
(82 historical fresh runs), comparing recorded terminal hashes where available.
Opening routes have no historical terminal hash, so they must freshly clear with
both contributors and no knockdown. It then tries same-mission templates with
initial delays0/30/60/120/240/600 ticks, preferring the matching preset. There were
571 bounded template/delay trials. No runtime state is injected or edited.

Each selected route must clear without knockdowns in all four combinations of
joint cuts on/off and normal/relabelled seats. Relabelling reverses both spawns
and command streams: it is seat-label symmetry, not adaptation to the other side
of a map. The observer refuses artificial neutral braking and stops immediately
after the first knockdown's atomic step. Remaining reserves cannot hide damage.

Initial results: **13/36 mission/preset sets,52/144 ordinary configurations**.
All twelve Gentle sets pass; Switchback Partners Expert also passes. The remaining
23 sets are unresolved by reused paths, not proved impossible. Each chosen result
and the last failed trial have exact fresh-run repeat tests and pinned checksums.
The fixture keeps only the last failure per set, not every rejected attempt.

The Standard timing probe adds180 ticks to the final attempted route for all12
missions, in all four settings:48 probes, no shared no-loss clear (32 incomplete,
12 first-knockdown and four invalid transferred-input probes rejected before an
artificial brake). The invalid four are not valid completed attempts. Because these
start from already unsuccessful reused routes, they do not establish sensitivity
of an otherwise viable route, unavoidable spawn pressure or human difficulty.
Fresh-route work must follow; do not weaken content just to make old scripts pass.

## Pacing and cooperative quality are still open

The selected initial routes clear in20.47–43.78 seconds, all below the ordinary
45-second target. They contain no actual joint-cut events. Every recorded closure
in these selected routes is a self-return, but having both contributors does not
prove useful complementary roles: several routes let one craft remain stationary
for most of the attempt. Stepping Exchange, Divided Workshop and Gentle Switchback
have zero sampled simultaneous cutting ticks. Three selected sets miss optional
mastery: Divided Workshop Gentle, Switchback Gentle and Shared Detour Gentle.

This supports the user's concern that a speed multiplier alone is insufficient.
Next spatial work should remove cheap bypasses and improve complementary choices,
not force idle waits, inflate quotas or shorten warnings. Exact scripts are an
offline feasibility lower bound, not predicted player completion times.

Metrics are deliberately limited: first-closure counts use completed fixed steps
and can include assisted/joint closures; the original down event uses the engine's
zero-based event tick. Exposure and simultaneous activity are tick samples, not
continuous collision/reaction measurements. Stationary counts compare positions,
not null commands. Team stores a seed but does not currently consume it for enemy
movement RNG; additional seed labels would not provide new timing opportunities.

## Gates

The new97-test assessment suite passes on Node20.19.5 and Node22.22.2. It includes
all36 real export/import boundaries, exact outcome repeats, complete matrix checks,
unchanged inputs and invalid-command/braking guards. With37 fresh-opening tests
and77 historical/compiler/export regressions, **211 tests pass on each Node**.
An independent reviewer also passed the134 new tests on Node20 and approved this
assessment/opening snapshot. Review hardening now checks exact unique joint/seat
option pairs and explicitly distinguishes the invalid transferred-input probes.

## Fresh opening routes

Twin Landings and Shared Detour now have new Standard/Expert routes, without
changing any recipe or historical failure record. All four paths clear in all
four joint/seat-label configurations; each also clears after a30-tick later
departure. This adds16 ordinary and16 delayed configurations and raises current
ordinary coverage to **17/36 sets,68/144 configurations**, leaving19 sets open.

| Mission       | Preset   | Base clear seconds | Self-return counts | Optional mastery                    |
| ------------- | -------- | -----------------: | ------------------ | ----------------------------------- |
| Twin Landings | Standard |              26.66 | 3 +3               | Met                                 |
| Twin Landings | Expert   |              17.53 | 3 +3               | Met                                 |
| Shared Detour | Standard |              33.63 | 3 +3               | Met                                 |
| Shared Detour | Expert   |              24.11 | 2 +3               | Met; both material beds neutralized |

Inputs came from bounded offline search over safe-ground approaches and straight
return cuts. Branches clone legally reached states only; every accepted log is
then played again from a fresh public run. Shared Detour Expert required deliberate
above/below-material enclosures before a final cut. Its first greedy branch stopped
at69.93% with incomplete material mastery; all four failed outcomes remain pinned
and tested rather than being relabelled a clear. Node20/22 outputs match exactly.

Both-idle commands total at most34 ticks per base route, but this does not mean
both players are engaged: most continuation cuts alternate active seats while
the other stays on reclaimed ground. No Support or joint-cut event occurs. The
very short Expert clears are pacing/inversion flags, not proof Expert is easier
for humans or that the new multipliers are balanced. Separate route choices and
enemy positions change how much territory each closure earns.

Pending: remaining19 fresh-route sets, broader timing alternatives, optional
mastery, spatial/role redesign, native whole-mission play, two human players,
controller/reconnect, new Team bonus/combat semantics, accepted host integration,
reviewed release and GitHub Pages. No claim of P14 completion.
