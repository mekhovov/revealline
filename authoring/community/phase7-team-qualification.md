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
rejected. The production Team file picker accepts the portable MIME type and
`.rlteamcampaign` files, completes that replay verification, prepares the
existing Team picture boundary and still requires the player's separate Start
action before launching the first arena.

## Compatibility and limits

This addition does not change image/video `.rlpack` runtime semantics, and the
installed Custom player does not relabel Team campaigns as Solo content. The
portable Team artifact has its own explicit API and MIME type and can launch
through production Couch file intake. Exact portable bytes install under a
SHA-256 edition identity. Fresh library visits discover immutable installed
editions, replay their qualification before launch, and retain legal clear
receipts within the exact edition. Unfinished-attempt recovery, durable picture
rewards and creator media packaging remain integration work. Automated
feasibility is not human balance, first-attempt success,
physical-controller certification or mobile certification.
