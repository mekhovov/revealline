# Team complementary specialist candidate

Status: implemented candidate; balance and public-device review pending.

The final three missions of the current Team Journey now have an explicit successor edition. Seat one is the **Interceptor**, whose Support pulse removes nearby travelling trail impacts. Seat two is the **Disruptor**, whose pulse slows nearby moving enemies. Both players retain the existing hold-to-rescue action.

The roles intentionally divide an existing hybrid ability instead of adding unrelated equipment. This makes position and communication matter: the Interceptor covers an exposed partner line, while the Disruptor creates a movement window. Neither pulse silently performs the other job.

## Compatibility boundary

- `TeamMissionV6` compiles to `revealline-coop-level.v7`, pack v7 and ruleset v9.
- Earlier Team missions and every historical runtime edition remain unchanged.
- The successor keeps the existing twelve-mission order, maps, pictures, actors and objectives.
- Only `twin-depots`, `changing-courtyard` and `last-rendezvous` receive specialist roles.
- The first nine missions retain hybrid Support, giving players established impact and slowdown practice before the split. This also preserves `shared-lookout` as the sole new-roamer lesson instead of introducing two mandatory rules at once.
- The final three form a separate authored runtime campaign because Team campaigns cannot mix historical V5 hybrid levels with V6 specialist levels. Next crosses that boundary directly; no picker or menu interrupts play.
- Specialist progress uses its own candidate profile. It does not mint official completion.

## Review route

Open `game/couch/relay-rescue.html?journey=team-specialist-originals-1`. This is an explicit candidate route and is also linked from Studio. It is not a claim of human balance validation.

Focused automated verification covers exact edition boundaries, pack/runtime identities, fail-closed role authoring, asymmetric pulse behavior and player-facing briefing copy. Human and device qualification remains required before promoting this route as the default Team edition.
