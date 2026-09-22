# Relay/Fracture stronger-pressure refinement

All33 configurations left unresolved by the historical route-reuse audit now have
new no-loss clears, public replays and independent equal paired-board races.
The51 historical passing cases are preserved and rerun, giving **84/84** across
seven Relay and seven Fracture missions, three presets and two control policies.
Exact whole-pressure revision remains `pressure-v2-629ea4ba0500d271`; no authored
level, capture rule, enemy recipe, quota, artwork or runtime code was changed.

## Verification

`node scripts/probe-relay-fracture-pressure.mjs <mission> <preset> <steering> --max-ms=90000`

This uses the same bounded, omniscient public-input probe as Crosswind/Apex, now
shared in `scripts/lib/pressure-route-probe.mjs`. Input bounds, supported chapters,
seed, preset, controls and matching identity/checkpoint prefix are validated.
Invalid CLI domains reject before compiling the catalogue. No state injection.
Time-budgeted search is not exhaustive; recorded paths reproduce deterministically.

All33 new paths collect zero bonuses.12 achieve existing optional mastery;
21 do not. Every fixture reproduces metrics, closure/event sequence and goal
evidence. The historical successful paths are not replaced by slower new paths.
New route/opening packet plus existing Relay/Fracture routes, Relay goal evidence
and pressure catalogue: **127/127 on Node20.19.5 and22.22.2**. The shared probe's
resume/CLI bounds tests also pass2/2 on both versions. Lint/format/whitespace pass.

Combined with the original audit and Livewire/Crosswind/Apex follow-ups:
**416/498 configurations**, **55/83 missions with all six configurations**,
**82 unresolved**. Remaining: Horizon19, Border11, Signal12, Neon10, Rover12,
Phaseworks15, unchanged Sentinel3. Separate Sentinel spatial successors are not
counted as clears of original geometry.

## What the opening probes actually show

The84 seed1 observations include immediate first-return paths and no-input
10second checks.82 old first-return paths close without loss. Two Districts
Expert loses at tick353 on the old straight-left departure in both controls.
The new Expert clear takes a different legal approach: wait240ticks, move up216,
left96, down414; first closure at tick966. This is evidence of an alternative,
not justification for claiming the old opening safe or mandating a hidden wait.

78 idle checks survive10seconds. Keep the Network's hub already contains a
reclaimed-ground roamer: idle loss occurs at tick913/687/573 on Gentle/Standard/
Expert in both policies (7.61/5.73/4.78seconds). Its immediate Down return closes
at tick210 without loss in all six. The pressure is avoidable in these cases,
but must be readable in native/human teaching; reclaimed ground is not immunity.
Fixtures intentionally record these risks, not an all-safe acceptance claim.

## Balance findings

| Mission | New route duration range | Specific concern |
|---|---:|---|
| First fracture |20.65–20.75s|Neither new Expert path repairs anything; early clear can bypass the repair lesson.|
| Five anchors |18.75–33.65s|Only one of three new paths meets early-anchor mastery.|
| Two districts |17.45–24.85s|All four new paths meet mastery despite very short play; geometry is the next redesign target.|
| Island reserve |44.15–53.55s|Two of four meet repair/link mastery; more useful pacing evidence, not human signoff.|
| Keep the network |30.35–37.85s|Only new Standard/immediate meets mastery; roamer opening needs clear communication.|
| First link |22.65–24.45s|New Expert clears do not use the connector; Standard/grid uses it but never visits the lower landing.|
| Second approach |26.85–37.35s|Neither new Expert path demonstrates optional eastern-first ordering.|
| Three compounds |40.15–44.45s|None of four new paths demonstrates both post-link yard visits.|
| Watchpost exchange |28.55–39.25s|All four use both junctions and satisfy mastery; short band10 clears still need review.|
| Switchback exchange |48.15–78.15s|Required relays finish45.8–75.8s before victory; impact-on-relay mastery absent.|

Switchback's long post-objective interval is not automatically tedious cleanup:
both new Expert paths use both connectors; Standard/immediate uses the east one;
Standard/grid uses neither. Inspect actual threat exposure and shortcut usefulness
before lowering quota or imposing additional objectives. First Link is the clearer
connector-bypass issue. No optional mastery requirement was made mandatory.

Next spatial study: [Two Districts successor](../superpowers/specs/2026-09-21-two-districts-spatial-design.md).
Then revisit First Link/short clears and unresolved earlier chapters. Broader
seeds/delays, full native plays, physical controls, Team support, accessibility,
human pacing/understanding/retry, art/host integration and reviewed public release
remain open. No native full-play or GitHub Pages deployment is claimed here.
