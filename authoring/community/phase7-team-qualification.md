# Phase 7 generated Team qualification

Phase 7 adds a separate `creator-team-layouts.v1` registry. It does not relabel
the Solo/Versus templates. A generated Team campaign contains two intentionally
cooperative layouts:

- **Mirrored crossing** starts the pilots on opposite outside borders. Both
  pilots must close meaningful cuts to reach the shared coverage target.
- **Relay pincer** gives each pilot a mirrored pillar approach and anchor. Both
  anchors open the shield before the pilots jointly secure the relay core.

The generation seed chooses campaign order among these bounded authored
layouts. It does not perturb arbitrary Team fields. Provenance pins each level
to its template and `mirrored-v1` variant; changed spawns, walls, goals, enemies
or objective geometry invalidate qualification.

## Automated acceptance

Every layout is replayed on the real cooperative engine for Gentle, Standard
and Expert with both advertised generated-content presets:

- Full teamwork: joint cuts, assisted captures and advanced cooperation.
- Joint cuts and ordinary cover: joint cuts and assisted captures without the
  advanced recharge/rescue layer.

The public input policy is Direction + Boost + Support. A passing record needs
a legal win, no knockdowns, at least one closed cut from each seat and at least
one two-seat joint cut. Coverage records must meet their exact target.
Stronghold records must disable the shield and secure the core after both
anchors. The current acceptance run passes all 12 combinations.

The Individual cuts experiment is deliberately absent from the qualification
allowlist. Existing historical Team packs may still expose that experiment;
this phase makes no completion claim for generated campaigns under it.

## Retry, Next and transfer

Retry creates a fresh run from the same level, difficulty, preset and runtime
seed. The acceptance test loses a real Expert attempt by exhausting shared
reserves through legal self-trail failures, then verifies that Retry restores
the exact cells, actors and summary.

Next follows the immutable level order stored in the cooperative pack and
returns no successor after the last level. The portable
`revealline-creator-team-portable.v1` JSON carries the strict Team pack,
generation provenance and all route evidence. Import passes through the public
cooperative pack parser and replays every qualification; changed evidence is
rejected.

## Compatibility and limits

This addition does not change `revealline-creator-runtime.v1` Solo packages or
`revealline-creator-runtime.v2` Solo/Versus packages. It also does not claim
that the existing installed Custom player launches generated Team campaigns.
The portable Team artifact currently has its own explicit API and MIME type;
wiring it into the production Couch library, picture rewards, saved progress
and creator media packaging remains integration work. Automated feasibility is
not human balance, first-attempt success, physical-controller certification or
mobile certification.
