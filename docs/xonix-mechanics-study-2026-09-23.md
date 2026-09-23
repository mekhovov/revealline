# Xonix-family mechanics study and application plan

23 September 2026. Requested expansion after the predictable-enemy feedback.
This supplements the [delivery plan](plan-status-2026-09-23.md), not a replacement
for its capture contract or public-release acceptance gates.

## Completed research, current implementation, remaining work

- **Researched:** 18 named games/editions spanning traditional field exclusion,
  boss-led capture, objective conquest, picture reveal and competitive ownership.
  These are not 18 hands-on playtests, nor every clone ever released. Sources vary
  from detailed primary manuals to publisher listings; unknowns stay unknown.
- **Implemented, not yet publicly accepted:** PR285 / v0.89.0 makes ordinary field
  keepers change course gradually, using seeded bounded steering. Exact reviewed
  source `33614bc806db2397096851bb0af5a3d6ab90892f`; 38 focused checks passed.
  Production/public gates remain with the sole publisher. See
  [the bounded movement contract](enemy-course-variation.md) after its merge.
- **Already present in Reveal Line's engine:** four-connected enemy-retained
  capture, field/perimeter/frontier/reclaimed domains, telegraphed pursuit,
  travelling trail impacts, erosion, lane attacks, relay gates, staged Sentinel
  encounters, timed contact bonuses, foundations and directional speed fields.
  Their existence does not establish consistent campaign use or good balance.
- **Remaining:** qualify these tools under gp3 movement, improve authored
  combinations and legibility, then add only mechanics that demonstrably create
  a new route decision. Do not duplicate an existing system under a new name.

## Evidence ledger

“Application” below is our design conclusion, not a claim that a source supplies
our implementation constants or proves commercial success. Original assets and
code are not copied. Ports and sequels are not assumed to share identical rules.

| Game / edition | Verified rules or mechanics | Application and limits |
| --- | --- | --- |
| Qix arcade | Connected territory drawing; avoid Qix and Sparx; 75% target. [Licensed rerelease](https://www.arcadearchives.com/en/title/aca-198/) | Preserve readable cut/return risk. Listing does not specify a steering algorithm. |
| Qix, Atari 5200 | Field Qix attack unfinished lines; boundary Sparx; stopping while drawing triggers a Fuse. Time Line exhaustion adds pressure, with a signalled faster Sparx state. Slow drawing gives extra points; novice removes several threats. [Original manual scan](https://www.digitpress.com/library/manuals/atari5200/qix.pdf) | Difficulty can reduce simultaneous demands, not just grant lives. Do not import mandatory hesitation punishment into ordinary Journey. These are port-specific rules. |
| Xonix, X11 reimplementation | Flyers remain in empty space; eaters move through filled ground. Reconnection fills the line and adjacent empty regions without flyers. Extra flyers/eaters arrive as levels advance. [Project manual](https://manpages.debian.org/testing/xonix/xonix.6x.en.html) | Direct precedent for separate movement domains and keeper-free-region fill. This source explicitly describes a reimplementation, not original DOS code. |
| Volfied, Empire computer ports | Fill the region excluding the boss; lesser aliens can be trapped. Trail contact launches a charge toward the ship. Boundary shield has a finite displayed counter; bonus blocks can be persistent or intermittent. [Original manual](https://oldgamesdownload.com/wp-content/uploads/manuals/volfied_dos_manual_en_6fj.pdf), [manual transcription](https://www.lemonamiga.com/doc/volfied/1807) | Our existing impact-carrier and staged boss contracts cover related decisions. Do not silently replace ordinary instant trail damage or make every minor enemy a field seed. |
| Qix++ | Enclosing containers opens items; Qix can destroy them first. Items include freeze, removal, shielding and temporary protection. [Taito launch material reproduced by 4Gamer](https://www.4gamer.net/games/102/G010221/20100224075/) | Optional rewards can create a spatial race. Keep our contact pickups distinct: enclosure must not suddenly collect them. Any capture-triggered container would be a separately taught object. |
| Xposed | Expose covered areas while avoiding opponents and surroundings; progress through packs. [Publisher listing](https://store.playstation.com/en-us/product/UP2538-CUSA05619_00-XPOSEDPS4USGAME1/) | Picture discovery and concise controls remain core. Exact fill, steering and collision rules are not disclosed. |
| Xposed Reloaded | Xonix-derived rectangle drawing, reveal threshold and additional packs. [Publisher listing](https://store.playstation.com/en-us/concept/10002881/) | Retain the prior measured speed hierarchy and supplied geometry observations. Neither marketing nor still screenshots establishes random-turn timing. gp3 curves are our adaptation, not claimed Reloaded code. |
| Xposed Switched | Publisher lists three terrain types, four randomly available powerups, eight enemy types and 48 levels. [Nintendo listing](https://www.nintendo.com/us/store/products/xposed-switched-switch/) | Supports combinations of a compact vocabulary. Counts are not automatically Reloaded's; complete behaviors remain undocumented here. |
| Fortix | Rejoining establishes a new baseline. Capture a catapult trigger to remove a turret, or enclose the turret directly. Roaming dragons, departure-triggered hunters and baseline bats have distinct roles. Terrain changes movement; walls block. [Developer manual, pp. 2–3](https://cdn.akamai.steamstatic.com/steam/apps/45400/manuals/fortix_PC_manual_WEB.pdf?t=1447353028) | Strong model for meaningful capture order. Reuse our relay/encounter systems before adding a general-purpose turret-disable system. Its enemy capture rules differ from all-keepers-retain. |
| Fortix 2 | Castle conquest, turrets, monsters and maze-like layouts; official achievements reward multi-catapult captures, large captures and different ways of avoiding threats. [Publisher listing](https://store.steampowered.com/app/45450/Fortix_2/), [developer achievements](https://steamcommunity.com/stats/Fortix2/achievements) | Optional mastery should reward competing tactics, not force every player through a longer checklist. Achievements alone do not specify AI or shield algorithms. |
| Lightfish | Drawing into unexplored territory destroys monsters; enemy contact kills the fish. Developer lists ten enemy types, distinct level architectures, Adventure and Time Trial. [Developer page](https://www.eclipse-games.net/LightFish.html) | Use architecture and coherent presentation to distinguish missions. Number of enemy types is not evidence of ten particular trajectory algorithms. |
| Cubixx HD | Area capture across six cube faces; line chasers, pursuing/slowing Homers, falling Asteroids and attraction hazards; co-op and competitive modes. [Developer article](https://blog.playstation.com/2011/09/15/cubixx-hd-coming-to-psn-with-7-player-multiplayer/) | Preserve explicit roles and separately qualify modes. Do not import cube navigation or unannounced pulling of the craft into the current flat-board controls. |
| AirXonix | Balls threaten cuts; mines move on filled territory; timed levels and life/time/slow bonuses. [Developer rules](https://www.axysoft.com/airxonix/) | Reclaimed-ground danger has precedent. Mines occupying filled ground are not evidence of territory destruction or any particular pursuit algorithm. |
| Urbanix | Build a town while avoiding enemies and house crashers; different world mechanics and bonuses. [Publisher-supplied Nintendo description](https://www.nintendo.com/en-gb/Games/WiiWare/Urbanix-287064.html) | Territory defense is a possible thematic frame for existing erosion. Exact damage/rebuilding and movement behavior are not specified. |
| Paper.io | Expand territory; opponents can steal it; exposed-tail contact ends the run. [Voodoo listing](https://apps.apple.com/us/app/paper-io/id1171814682) | Competitive ownership is a different capture contract, not a drop-in Journey rule. Listing does not prove human multiplayer rather than bots. |
| Splix.io | Enclose and return to owned territory; other players can attack exposed lines; developer identifies online opponents. [Official game/changelog](https://splix.io/), [developer listing](https://apps.apple.com/cm/app/splix-io/id1150901618) | Input, ownership and trail feedback must agree. Competitive territory stealing is deferred; our paired-board Versus remains intact. |
| Space Xonix | Territory capture with upgrades and same-device co-op. [Developer's Steam listing](https://store.steampowered.com/app/382270/Space_Xonix/) | Cooperative interaction merits distinct levels and verification. Quoted reviews in the store are not evidence of exact laser/lava algorithms. |
| Xonix Casual Edition | Publisher describes copter territory capture, enemies, mazes, bonuses and time limits. [Publisher listing](https://store.steampowered.com/app/2534060/Xonix_Casual_Edition/) | Supports readable obstacle/bonus route decisions, but adds no verified algorithm beyond existing systems. Ignore broad marketing claims about genre history and popularity. |

### Evidence gaps

Original DOS Xonix's precise implementation is not established here. Gals Panic
and JezzBall-family games were discovery leads, not sufficiently authenticated
rule evidence in this pass; do not invent their contracts. “Galaxia” was not
verified as the intended Xonix-like title. Contemporary reveal clones whose
listings only restate capture/bonus/time challenges add no new verified rule;
their artwork and adult themes are outside this project.

For Xposed/Reloaded, the outstanding unknowns include collision tolerances,
player targeting, turn distributions, RNG, full terrain/actor taxonomy, pickup
timings/stacking and multi-enemy fill selection. Prior observed speed samples
remain approximate and limited to the recorded scenes. No controlled hands-on
comparative playtest, original source-code audit or popularity study is claimed.

## What must stay consistent

The evidence identifies **different families of capture rules**, not one formula
to blend indiscriminately:

1. **Keeper exclusion:** all components containing a retaining enemy remain open.
   This stays the ordinary Journey contract, with four-direction connectivity.
2. **Boss exclusion:** one designated boss preserves territory; smaller actors
   can be enclosed. Use only an explicit encounter/role, never a sprite-based rule.
3. **Objective conquest:** capture objects to change threat state or routes.
   Layer explicit links over our capture transaction; do not change its fill math.
4. **Competitive ownership:** opponents reclaim or steal territory. This would
   require a separately qualified mode, not a hidden extension of current Versus.

Keep body contact, immediate trail damage, travelling trail impact and protected
states visually distinct. Permanent foundations/gate connectors remain excluded
from earned score/coverage and protected from erosion. Main-menu difficulty and
admin controls stay; no silent adaptive difficulty or player-targeted RNG.

## Apply to existing architecture before adding systems

| Desired decision | Existing implementation surface | Next application, not a completion claim |
| --- | --- | --- |
| Read a moving threat without memorizing a lane | `core/field-course.mjs` in PR285; gameplay tuning gp3 | Finish v0.89 release and verify fresh attempts in all modes. Keep uninterrupted control and preserved historical attempts. |
| Choose a short safe cut or exposed large enclosure | Shared capture/geometry; current authored foundations | Audit early/middle/late maps for one-cut bypasses and returns that remove all pressure; preserve an intentional teaching opener. |
| Draw to bait a committed attacker, then change route | `core/enemy-pressure.mjs` | Use the existing warning → fixed target → commitment → recovery contract in a short practice arc. Never make every ordinary keeper secretly home. |
| Shape the frontier while planning the next return | `core/classic-contour.mjs`; actor catalogue | Verify frontier patrol introduction and combinations under gp3. Show routes with non-colour cues. |
| Preserve an escape route after enclosure | Claimed-rover activation and Team roamers | Requalify warning/escape space before increasing counts. Do not confuse roaming on ground with patrolling its edge. |
| Race a travelling impact back to a return surface | `core/line-impact.mjs` and impact-carrier role | Improve its introduction and failure explanation if users cannot identify the travelling front. Do not impose its rule on ordinary keepers. |
| Capture something to alter encounter order | `core/relay-gates.mjs`, `core/encounter.mjs` | Reuse permanent shortcuts and shield-relay stages in purpose-built routes. Generic relay-disables-emitter behavior is not implemented by those modules and needs its own bounded feature if still valuable. |
| Take a temporary reward detour | `core/timed-bonuses.mjs`, Team timed bonuses | Tune announcements, dwell, cooldown and legal alternative anchors against real travel time at gp3 speeds. Reward remains optional and collected by contact. |
| Defend an important return corridor | Eroder, anchor and foundation systems | Use existing protected-ground rules; avoid broad progress loss or endless repair cleanup. |
| Seek mastery without blocking continuation | Mastery recipes; Journey Next/Skip/unified library | Offer one optional route/capture challenge per mission. Never turn medals into a required unlock or add mandatory post-win menus. |

## Remaining application queue

One release stays in promotion and one bounded successor can be prepared. The
following is ordered work, not a promise that every idea will ship. Effort ranges
start when each slice is admitted, exclude external CI/storage outages and human
availability, and should be revised after inspection.

| Order | Deliverable | Evidence required | Conditional effort |
| --- | --- | --- | --- |
| 0 — in progress | PR285/v0.89 varied field courses | Hosted mandatory gates, immutable release/retained archive, fresh Solo/Versus/Team public movement and historical Resume separation | Source ready; deployment depends on previous release acceptance and hosted gates, no reliable clock ETA yet |
| 1 — next | gp3 threat/geometry pacing audit, then one small authored correction | Record largest easy enclosure, exposure duration, available return routes, role overlap, objective cleanup and safe spawn on representative early/middle/late maps. Prove the corrected mission preserves capture and has at least two viable approaches | 4–8h audit; 4–8h per released correction |
| 2 | Existing pursuit/frontier/roamer/impact teaching and role cues | A player can identify each movement domain, trigger, warning and counterplay; Solo/Versus plus purpose-built Team qualification | 4–8h per bounded arc or cue correction; human feedback additional |
| 3 | Timed-bonus route tuning | Announce → reachable optional detour → expiry/relocation; no forced speed trap or completion dependence; pause/freeze/reset/replay preserved | 4–8h per bounded group |
| 4 | Objective-order prototype using existing gates/shield relays | Two meaningful order choices and no tedious quota/objective cleanup. No generic turret-disabling claim unless that feature is actually added | 6–10h including focused verification |
| 5 — conditional | One new mechanically distinct threat, only if existing roles leave a demonstrated gap | Written movement/domain/capture contract; visible warning/action/recovery; versioned replay/Studio support; safe introduction; separate Team decision | 1–2 days per role, plus art/audio/device qualification |
| Deferred | Fuse-on-hesitation, capture-opened bonus containers, gravity/pull fields, contested territory, cube/3D navigation | Separate design/mode qualification; do not alter ordinary Journey opportunistically | Not scheduled |

The immediate lesson is **varied decisions under stable rules**. More enemy count,
more speed or more randomness alone is not a quality target. Measure truthful
public delivery and observed player understanding; automatic restart, level count
and “addictive” marketing language do not prove enjoyment.
