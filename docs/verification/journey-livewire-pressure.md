# Livewire stronger-pressure route refinement

This follow-up resolves every Livewire feasibility case that the bounded
historical-route reuse audit left open. **No authored geometry, enemy roles,
speeds, warnings, attack rests, coverage, assets or runtime code is changed here.**
It is new legal-input evidence for the exact existing whole-Journey pressure
revision `pressure-v2-629ea4ba0500d271`, not another difficulty edition.

## Method and result

`node scripts/probe-livewire-pressure.mjs <mission> <preset> <steering> --max-ms=60000`

A bounded omniscient search considers reachable reclaimed-ground approaches,
straight cuts and0/60/120/240tick waits. Every candidate runs actual public engine
input and is rejected on first life loss. No claimed cells, actors or objectives
are injected. Chosen input sequences freshly reproduce their checkpoint and
verify through the public replay interface. The search budget is not exhaustive;
recorded inputs are deterministic even though a time-budgeted search can stop at
a different candidate under different machine load.

All seven maps × three presets × two steering policies now have **42 no-loss
clears,42 public replays and42 independent equal paired-board races**, seed1.
All42 collected zero bonuses.32 also achieved their existing optional goal;
41 closed an exposed trail during a lane warning. These are automated facts,
not human interpretation or reaction evidence. No Team qualification is added.

Focused new routes + existing Livewire authoring/route/pressure catalogue cohort:
**80/80 tests on Node20.19.5 and22.22.2**. ESLint, Prettier and whitespace pass.
The original498-case audit stays immutable. Merging this new evidence with its
passing cases yields347/498 covered cases,151 unresolved, and34/83 missions
covered in all six configurations. Long Wave and Returning Light are now the
only missions with no passing case in that combined evidence.

Clear seconds (immediate / Grid + Buffer):

| Mission | Gentle | Standard | Expert |
|---|---:|---:|---:|
| Read the lock |47.05 /44.05|52.15 /56.85|38.85 /49.45|
| Cross the afterglow |19.05 /19.35|17.05 /34.95|34.95 /35.55|
| Switchyard |22.15 /22.45|22.15 /19.45|21.45 /21.85|
| Split junction |30.25 /30.65|24.75 /25.15|30.95 /31.45|
| Cooling loop |47.65 /47.95|48.65 /45.65|39.05 /34.85|
| Crossbar depot |60.65 /58.85|46.05 /46.35|44.55 /52.85|
| Livewire Remix |63.75 /84.95|50.25 /63.25|62.55 /70.45|

Longest uninterrupted exposed intervals across those routes range3.1–5.8seconds.
Do not treat these as required human-perfect windows, minimum clear times, or
preset difficulty rankings: each selected route makes different spatial choices.

## Design implications and next work

- Preserve the existing readable1.5second lane warning and0.7second active period.
  This test does not justify making tells faster. Mike Stout's
  [attack-telegraphing guidance](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)
  emphasizes communicating the action the player must respond to. Rechecked2026-09-21.
- Role/terrain combinations should create distinct decisions, not just speed.
  [AirXonix's developer rules](https://www.axysoft.com/airxonix/) distinguish interior
  trajectory threats and mines on filled ground. This supports the existing
  domain separation, not a universal countdown or copied3D camera.
- Afterglow, Switchyard and Split Junction still have optimized17–35second clears.
  Review return-platform spacing and encounter consequences before inflating
  quotas or adding mandatory waits. This chapter is technically feasible, not
  accepted as a nontrivial band8–9 human experience.
- Ten routes did not achieve optional mastery: Read the Lock Gentle/immediate;
  Cooling Loop Gentle/Expert in both policies; Remix all except Gentle/grid.
  Optional goals remain optional; additional mastery evidence is still required.
- Next unchanged-pressure path investigation: Crosswind/Apex, beginning with
  Long Wave and Returning Light. Continue objective-tail review separately.
- Broader seeds/delays, native full plays, physical controls, accessibility,
  human learning/pacing/retry and reviewed public integration remain open.
  No native observation or GitHub Pages release is claimed by this offline packet.
