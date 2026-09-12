# Round 11: roles that create different arcade decisions

Research checked 12 September 2026. This document separates public role descriptions from the fictional rules actually implemented in `xonix-core.v2`. It is a design and source record, not an inventory of all equipment or an operational reference. Equipment announcements describe the publishing organization’s claims; game values are chosen independently in cells and seconds.

## Public evidence and design mapping

| Public role or shape | Primary source and narrow observation | Implemented game mapping |
|---|---|---|
| Camera quadcopter | [DJI Mavic 3 Enterprise](https://enterprise.dji.com/mavic-3-enterprise) presents compact camera aircraft for mapping and inspection, with a thermal variant. | `scout`: reveal hidden relay markers and briefly display current enemy direction. Its scan does not freeze actors or reveal a guaranteed future path. Camera-body cosmetics may use this recipe. |
| Fiber-controlled FPV | [Ukraine MoD: Stalker](https://mod.gov.ua/en/news/stalker-drone-tracks-and-strikes-despite-ew), 30 May 2025, describes a fiber-control connection and resilience to electronic interference. | `fiber`: ignore visible signal zones, retain vulnerable live cable/trail and all geometric capture rules. Cable contact is deliberately a Xonix abstraction; the game does not claim to reproduce physical cable performance. |
| Larger multi-rotor carrier | [Ukraine MoD: Vampire](https://mod.gov.ua/en/news/the-vampire-a-drone-that-terrifies-enemies-and-assists-ukrainians), 24 April 2025, describes a six-rotor modular aircraft used both for carriage/strike roles and humanitarian supply delivery. | `carrier`: two supply charges. Each is a short local stun/support field. Covering a fictional emitter also suppresses its signal region. A six-rotor body changes appearance independently of this class. No source payload/range is copied. |
| Small payload carrier | The same carrier source establishes modular carriage as a role, rather than a universal loadout for every airframe. | `bomber`: one charge, deliberate supply pickup, a local timed field. The lighter class’s limitation is a clear reload trip rather than a harder aiming interface. |
| Interceptor | [Brave1 and the Air Force](https://brave1.gov.ua/en/news/brave1-air-force-air-defense-cooperation), 28 June 2026, identify interception as a distinct aerial-defense development track. | `interceptor`: one short protective window. An enemy contact discards the cut and returns the craft to spawn without a life loss. This is a readable defense ability, not a model of interception guidance. |
| Expendable strike role | [Rostec’s UMEX 2022 announcement](https://www.rostec.ru/en/media/news/rosoboronexport-to-showcase-russian-drones-at-umex-2022/) distinguishes reconnaissance, reconnaissance/strike and expendable aircraft in its advertised range. This is a manufacturer/state-industry claim, not independent performance evidence. | `impact`: a small stun pulse followed by craft redeployment and loss of the unfinished cut. It cannot close the map, add coverage or erase an enemy. The player trades unfinished work for space and timing. |
| Reconnaissance versus strike silhouettes | The same Rostec announcement distinguishes these role categories; it does not establish a complete or current fleet inventory. | Enemy body art can distinguish surveillance aircraft, vehicles and signal equipment while binding explicitly to registered bouncer, perimeter-patrol or warning-lane mechanics. A silhouette never silently supplies a new behavior. |
| Net/control role | No retrieved source is used to assert a universal physical net capability for all drones. | `trapper` remains an explicitly fictional slow field. Net imagery can communicate that effect. Literal net capture, gun aiming and projectile ballistics are not implemented by renaming an asset. |

The [Ukraine MoD demonstration of fiber-controlled aircraft](https://mod.gov.ua/en/news/the-ministry-of-defence-showcased-fpv-drones-controlled-using-fiber-optics-to-the-armed-forces-of-ukraine), 2 January 2025, confirms this is a distinct control category being evaluated. It is not used to derive radio settings, engagement methods, vulnerabilities, real equipment performance or a simulation model.

## Interactions now supported

The class roster contains seven recipes. All old IDs remain valid: `scout`, `bomber`, `carrier`, `interceptor`, `trapper`; `fiber` and `impact` add new decisions. Recipes and body rigs are separate choices. A map and a theme can combine them without a core rewrite.

A signal region makes routes legible: ordinary craft may move more slowly, lose boost, or have actions blocked inside it. A fiber craft can choose that route, but its cable can still be touched by a moving enemy. A carrier can deliver a timed field over an emitter to support the route. An impact craft can abandon an unfinished cut to gain a brief recovery window. None of those effects gives automatic capture. Completion still depends on reconnecting a live cut to safe ground, leaving enemy-containing regions unclaimed, meeting coverage, and restoring required relays.

Hangars connect the loadouts within a run. The player must return to an available safe pad. Switching preserves per-class ammunition and cooldown and uses its own cooldown. Existing board fields survive switching, while equipped shield/scan windows end. A newly selected class begins with empty ammunition. This prevents a menu switch from becoming an unlimited reload or permanent shield. Level authors can add an interior hangar that only becomes usable after its territory is secured, or explicitly omit switching by setting `hangars:[]`.

The twelve-map campaign now extends the initial eight levels with:

1. **Signal Garden:** an interference region plus a hidden required relay. It introduces the difference between route choice and resilient equipment.
2. **Supply Circuit:** two hangars, a second supply pad, a signal emitter and a perimeter patrol. Returning home is a movement decision.
3. **Short Fuse:** a mission timer, per-cut timer and cable budget. Shorter closures create safer launching positions.
4. **Relay Storm:** warning lanes, two interference regions, moving field enemies and bounded cut duration. The same capture loop remains the objective.

Each map has a verified input-only route with both steering modes. That proves a legal route exists under the recorded setup; it does not prove every loadout is balanced or every player finds that route enjoyable. The progression and gallery presentation belong to the shell, not the kernel.

## Presentation guidance for themes and AI assets

- Keep cable, dangerous live trail, safe ground, signal region and warning lane visually distinct at actual play size. A recognizable silhouette is useful only if it does not obscure those boundaries.
- Use three-blade rotor animation, larger six-rotor carriers, camera pods, wings or thrusters through existing rig bindings. The animation’s apparent speed must not change the simulation’s movement speed.
- A payload/support event should use a brief local ring, dust/pixel burst or signal shutdown, with a reduced-effects variant. Do not hide contacts behind a full-screen flash.
- In the FPV world, use non-graphic fictional equipment disabled by a pulse. In heritage, the same field can restore a lantern or calm a storm. In retro, it can suppress a neon interference node. In the business world, it can temporarily stabilize an exception hub. These are theme metaphors, not factual product capabilities.
- Use original artwork or artwork with documented reuse permission. These web sources establish role distinctions; they do not license their photographs, marks or footage for redistribution.
- A future fixed-wing, armed or net-based mechanical class must specify an understandable player decision, input, counterplay, mission compatibility and deterministic replay behavior before introducing a new primitive. Cosmetic examples can be created now without implying the behavior exists.

## Configuration and verification

See [the core contract](../../game/core/README.md) for accepted field ranges, `switchClass` commands, hazard timing, class history and replay compatibility. `validateLevel` and `validateClassRecipes` reject unsupported behavior instead of falling back. Corev2/replayv3 are explicit version changes; v0.1.x remains independently playable with its original rules.

Focused verification runs the core/replay/campaign tests. Tests exercise both steering policies, ordinary/fiber behavior in the same zone, cable contact, emitter suppression and expiry, pulse redeployment without score/life exploits, safe-hangar restrictions, ammunition/cooldown persistence, mission/closure deadline ties, replay tampering and recovery timing. The expanded route search found 24 completions after examining 2,964 candidate cuts and simulating 1,593,434 candidate ticks locally. Those search timings are not graphics performance measurements or evidence of player retention.
