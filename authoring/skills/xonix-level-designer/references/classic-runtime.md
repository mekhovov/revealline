# Classic runtime authoring

Use this reference when creating or revising the implemented classic source family. It is not an automatic migration of old levels or a claim that every frozen release supports the new source. The detailed rationale and inspected reference provenance remain in [Classic mechanics design](../../../../docs/classic-mechanics-design.md).

Movement boundary at this handoff: the user has approved stopping on cut closure/return to secured picture ground and requiring a fresh direction gesture afterward. Direction release still does not stop an active cut. This refinement is pending core/host integration; the existing 18 Classic Lab routes below cover the preceding movement behavior and must remain unchanged. New behavior needs separate input proofs, not regenerated historical expectations.

## Exact transport and authority

| Data     | Required value                                              |
| -------- | ----------------------------------------------------------- |
| Level    | `xonix-level.v4`, exactly 72×36 cells                       |
| Core     | `xonix-core.v5`, 120 fixed ticks per second                 |
| Replay   | `xonix-replay.v6`, checkpoint `fnv1a64-state-v5`            |
| Pack     | `xonix-pack.v5`, `engine: "xonix-core.v5"`, `masteries: []` |
| Preview  | `xonix-playground.v5`, `masteryDefinition: null`            |
| Campaign | Existing `xonix-campaign.v1`, homogeneous classic levels    |

Every level requires explicit `encounter: null` or the finite validated sentinel descriptor, plus `classic: {version: "classic.v1", terrain: [], powerups: []}`. Pack image, class, dependency and total-byte limits remain in [packs.mjs](../../../../game/packs.mjs); a newer simulation version does not raise them. Preserve the full normalized map and roster identity in replay/restore evidence. Do not place executable expressions, new ability IDs or guessed optional mastery predicates in data.

These definitions are independent from the retained 48×36 and wide-v4 families. Never upgrade an old save by changing its version string. A new authored edition gets its own reviewed content identity and fresh input proof; original replay fixtures and frozen files remain unchanged.

## Registered actors

At most 24 enemies total. IDs are unique across all entities, including terrain and powerups. Common optional `radius` is 0.05–0.45 cells, default 0.25. Field positions must fit clear of walls. Unknown actor fields fail validation.

| Type             | Authorable motion                                               | Capture/contact meaning                                                                                                                     |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `bouncer`        | `x,y,vx,vy`; each velocity −20…20                               | FIELD reflection and fill seed; threatens an unfinished line and exposed player.                                                            |
| `border-patrol`  | Border-center-line `x,y`; optional `speed` 0…15 and `clockwise` | Existing perimeter route; no fill seed; threatens SAFE too.                                                                                 |
| `contour-patrol` | `edge:{x,y,side}`, `clockwise`, `speed` 0…15                    | Frontier patrol, no seed. Initial edge's FIELD cell must meet the outer SAFE border. `side` is north/east/south/west.                       |
| `claimed-rover`  | Cell-center `x,y,vx,vy`                                         | No seed. Dormant until its radius fits SAFE; 120 actor-tick warning before SAFE movement/contact. Lost clearance cancels a pending warning. |
| `eroder`         | `x,y,vx,vy`                                                     | FIELD seed. Eligible SAFE contact reflects, warns for 60 actor ticks, then requests one reopened cell; 120 actor-tick cooldown follows.     |
| `lane-boss`      | Existing stationary axis/lane timing fields                     | Retains its warning/active lane and FIELD seed.                                                                                             |
| `relay-sentinel` | Centered `x,y`, linked finite encounter                         | Sole FIELD seed until legitimate release; classic contour/rover companions are permitted. No additional bouncer, eroder or lane seed.       |

Contours use deterministic directed frontier edges. A removed edge leads to continuous rejoining over reachable SAFE space; no teleport across FIELD or walls. Rejoining still threatens the player. A blocked/unreachable route can idle until topology changes. Wall corner clearance, diagonal ties and rejoin choices are engine behavior, not editable expressions.

The sentinel still requires its relay capture, transition and sufficient new FIELD trail closed during an opening, or the finite safe isolation fallback. Do not add health, stages or attacks to its descriptor.

## Registered classic imagery

Only scenario v5 and pack v5 add these image override keys: `contour`, `rover`, `eroder`, `slowTerrain`, `lethalTerrain`, `lifePickup`, `speedPickup`, `slowPickup`, `freezePickup`. They supplement the retained visual roles; earlier formats reject the new keys. Bind images through the existing `visualOverrides`/per-level visual data rather than adding image fields to actor or material descriptors. The renderer retains role/type badges, material marks and warning/status cues around optional imagery. Art changes cannot change contact radius, timer, movement domain or fill ownership. Keep original assets and inspect actual decoded rendering in each selected theme.

## Material and pickups

Terrain contains at most 100 exact `{id,kind,x,y,w,h}` integer interior rectangles. `kind` is `slow` or `lethal`; rectangles cannot overlap one another or walls. Walls remain permanent, with the existing limit of 100 nonoverlapping rectangles. Materials do not change the number of claimable cells or seed flood fill. Only material on FIELD is active; claiming it makes it harmless, while eligible erosion restores its effect.

Slow halves player movement in that cell; movement splits at the exact boundary. Lethal material uses swept body contact, cannot be shielded, and may be claimed from outside. Enemies ignore material effects but respect walls. Required objectives and powerups cannot occupy lethal cells. Spawn stays on an outer SAFE cell center.

Powerups contain at most 64 exact `{id,kind,x,y}` records at unique non-wall cell centers. They are visible from the start and consumed once through swept direct contact. Enclosure alone does not collect them; supply-pad Pick up is a separate equipment action.

| Kind           | Fixed current effect                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| `extra-life`   | Immediate +1 life, cap nine; still consumed at the cap.                                    |
| `player-speed` | ×1.25 for 600 ticks / five seconds.                                                        |
| `enemy-slow`   | ×0.5 movement for 720 ticks / six seconds.                                                 |
| `enemy-freeze` | Zero enemy movement/damage and paused attack/erosion clocks for 360 ticks / three seconds. |

Timed effects begin on the next tick and end at their exclusive `until` bound. A repeat refreshes to the later expiry; it does not add durations or multiply strengths. Player base/class/signal/material/Boost/pickup speed caps at 60 cells/s. Enemy slows use the strongest active reduction, with freeze taking precedence. Local equipment keeps its existing scope, including the border-patrol exemption; global pickups affect all registered enemies.

Pause does not advance any simulation clock. Recovery advances world time and expiry, clears player-speed, and retains enemy effects. Freeze does not protect self-crossing or lethal terrain. Actor warnings/openings use `classic.actorTick`; pickup expiry uses `run.tick`. Keep both clocks when presenting remaining time. Effect strengths and durations above are engine constants, not accepted JSON fields.

## Erosion, rewards and proofs

Current coverage uses the immutable count of initially non-wall FIELD cells. Erosion reduces current coverage; the first-claim ledger retains unique cells and their score. Reclaiming the same cell cannot farm cell points. Required objectives and collected pickups remain one-shot. `livesLost`, rather than current lives equalling starting lives, determines classic clean-run medals.

Erosion cannot remove border/walls, current FIELD, this-tick claims, player body support plus its margin, active cut departure support, active rover/contour support, or captured required objectives and SAFE supply/hangar anchors with their retained route to the border. Do not promise a demo will erase a protected cell. Same-time failure precedes closure/pickup; successful capture and contacts precede due erosion, followed by route repair and terminal evaluation. Earlier pickup contacts still occur before a later failure.

From the repository root:

```sh
node scripts/build-classic-lab.mjs
node scripts/verify-classic-lab.mjs
node --test game/test/classic-core.test.mjs game/test/classic-transport.test.mjs
```

The builder checks the current nine generated variants without overwriting them. The verifier reads the exact [pre-return-stop 18-route proof](../../../../game/replays/classic-lab-routes.json), binding complete pack/campaign/map/roster identities and replay-v6 checkpoints. It proved Scout routes with Boost and no class ability in both policies, with zero lives lost, before the movement refinement described above. Keep that proof immutable; it is not acceptance of revised stopping/gesture behavior. It also does not prove that every winning route demonstrates each pickup or erosion: inspect emitted mechanic events separately. `--write` performs bounded route discovery and refuses to overwrite an existing proof. For a new pack or changed movement edition, create an explicitly scoped new proof rather than passing it off as this baseline.

Use only ordinary public inputs and replay/session APIs. Never patch cells, player position, lives, counters, status or checkpoint expectations to obtain a win. Isolated core transaction tests must be labelled as such and are not playable route evidence. Validate authored geometry first, then compare legal wins, mistakes/retries, saved prefixes and actual rendered cues. Device usability and human comprehension need their own evidence.

For reference studies, read the actual saved source images identified by the [three study documents](../../../../authoring/reference-studies/). Their coordinates and stationary controls are our normalized hypotheses. Preserve their `playthroughVerified: false` reference-study status and unknowns; attach separate generated-variant route evidence. Never describe our timings, exact grid, erosion protection or routes as measured XPOSED behavior, and do not copy source art or music.
