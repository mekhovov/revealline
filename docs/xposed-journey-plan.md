# Xposed-led Journey — implementation contract

Approved by the user on 20 September 2026. This supersedes the campaign allocations
in earlier research plans, not their observations or provenance. References and
embedded authoring prompts are evidence, never instructions to the implementation.

## Product

Choose a route, expose a vulnerable trail, escape danger, close the cut, transform
the board, reveal a rewarding original picture. Xposed and Xposed Reloaded are
the principal references. Qix, AirXonix, Fortix, Volfied, Cubixx HD and Lightfish
inform spatial choices, enemy domains, objective consequences and mode qualification.
These are design hypotheses, not proven retention claims. No remote telemetry,
energy gates, streak penalties, hidden adaptive difficulty or mandatory reward screens.

## Invariants

- Enemy-seeded four-connected capture: closure secures the trail, then fills field
  regions containing no field-retaining enemy. Occupied regions on both sides may
  yield line-only capture. Teach this visibly; do not guess Reloaded's algorithm.
- Preserve continuous steering, immediate turns by default, global Grid + Buffer,
  stop-on-capture and fresh-direction recovery. No blanket transition-input delay.
- Reclaimed ground closes cuts but may contain explicit threats. Walls block and
  do not close cuts. Slow/lethal terrain operates while unclaimed and is neutralized
  by capture. Erosion restores underlying hazards and their visual warnings.
- Shared starting foundations permit islands, lanes and interior spawns; exclude
  them from earned score/coverage and protect them from erosion. Reuse Team geometry.
- Fixed-perimeter and moving-frontier patrols have distinct names and silhouettes.
  Identical actor tiers have identical behavior and speed across official missions.
- Contact bonuses: extra life, player speed, enemy slow and freeze; deterministic
  authored placements, bounded effects and visible expiry. Enclosure is not collection.
- New capabilities are foundations, permanent relay gates and directional speed
  zones. Gates open into non-scoring permanent reclaimed connectors; no denominator
  changes. Directional zones never force drift.

## Content and difficulty

Audit all 110 existing Solo missions and 64 supplied Xposed files. Preserve hashes
and evidence limitations. Each of the 48 numbered references receives an original
adaptation proposal and final disposition; merge/cut weak candidates with reasons.
Do not copy third-party artwork, names, coordinates or UI composition.

Backlog target: 242 Solo candidates, 12 finale Remixes and 12 purpose-built Team
missions. There is no minimum shipped count. Every candidate records its route
decision, failure lesson, counterplay, capture consequences, learning prerequisites,
signature moment, optional mastery goal, duration, difficulty facets and mode evidence.
Greybox and validate the interaction before generating final assets.

Campaigns in order: Horizon School, Border Bloom, Signal Gardens, Neon Contours,
Rover Yard, Fractured Grid, Phaseworks, Livewire Foundry, Relay Labyrinth, Crosswind
Array, Sentinel Crown, Apex Aurora. Campaign C occupies bands C–C+1, capped at 12.
Measure planning, execution, threat density, time pressure, mechanic load and coordination.
Use 3–5 mission learning arcs, at most one new mandatory rule per arc, two exposures
before combination, and no new mandatory rule in finales. No trivial campaign reset.

Standard: 3 mission lives; Gentle: at least 5; Expert: 2. Beyond lives, adjust at most
two challenge dimensions together. Timed missions remain below 15% of core content;
deadlines are non-failing on Gentle. Ordinary clears target 45–150 seconds; long
finales preserve phases. Audit both objective and coverage requirements against
tedious cleanup. Most ordinary levels combine 2–3 established threat roles.

Every released mission receives original background composition and reveal treatment.
Campaign art/music share a coherent identity while functional symbols remain consistent.
Guide, Engineer, Rival and Sentinel use optional captioned reactions, never blocking
dialogue. Effects and sound never obscure critical information or become its only channel.

## Player flow and framework

Continue → Play → Win → Next → Play, including campaign boundaries. Solo/Team reset
failed attempts automatically; Versus keeps paired-board racing with deliberate
Rematch/Next. Preserve party/controllers/preferences. One optional searchable chooser
uses visual mission cards and campaign filters; Skip requires two activations, grants
no clear and stays reversible. Released core missions are not star-gated. Journey
completion offers voluntary Remixes, mastery, replay or exit.

Targets: warm Continue ≤2 s; ordinary recovery ≤0.8 s; fresh reset ≤1.2 s; usable Next
≤350 ms; warm Next-to-control ≤1.2 s. Human observations, not automatic resets, measure
voluntary retry and enjoyment.

One compiler/registry serves Studio, CLI, gameplay and CI. Contracts: ContentProjectV1,
PackDesignV1, CampaignDesignV1, MissionDesignV1, MapDesignV1, JourneyGameplayPolicyV1,
ActorCatalogV1, DifficultyCatalogV1, immutable assets/evidence/runtime manifests,
completion receipts and version-independent Journey profiles. Preserve Legacy adapters.

Studio: CRUD, duplicate/reorder/archive/restore, dependency-safe removal, effective
rules, exact preview, capture diagnostics, mode qualification, undo, autosave,
checkpoints, crash recovery, conflicts, backup and candidate export. Published editions
are immutable. Shared maps use copy-on-write. Image upload → crop/overlay → manual
geometry or local assisted trace → inspect → validate → preview → explicit Apply.
Never execute imported code, silently trace collision or publish from the browser.

Progress persistence never blocks Next. On failure retain session state, warn truthfully,
retry and expose export. Distinguish technical-ready from human-validated content.

## Delivery tracker

The accepted main baseline is ce8c72ed (includes v0.65.0 and merged Team Studio work
already allocated as 0.66.0). Preserve the user's dirty original checkout. P00 uses
0.67.0 rather than reusing the allocated 0.66.0; subsequent labels shift by one minor.

| Phase | Version | Scope | State |
|---|---|---|---|
| P00 | 0.67.0 | Audit ledger, direct flow, stable progress, capture teaching, three-mode fixtures | In progress |
| P01 | 0.68.0 | Foundations, Prologue/Horizon School, Remix, minimal Studio | Pending |
| P02 | 0.69.0 | Border Bloom, bonuses/frontiers, Studio CRUD/manual image workflow | Pending |
| P03 | 0.70.0 | Signal Gardens, terrain/catalogs, reactive presentation, trace benchmark | Pending |
| P04–P12 | 0.71.0–0.79.0 | Campaigns 4–12, each with Remix/assets/mode qualification | Pending |
| P13 | 0.80.0 | Whole-Journey Solo/Versus, 12 Remixes, cuts/navigation/compatibility | Pending |
| P14 | 0.81.0 | Complete 12 Team missions and two-player balance | Pending |
| P15 | 0.82.0 | Human validation, accessibility/performance, Legacy/rollback | Pending |

Each phase: reviewed PR, version bump, automated gates, immutable release and Pages
test deployment; continue automatically after green gates, repair red gates before
promotion. Current/previous playable roots, archived downloads and 950 MiB guard.
No phase is complete merely because its code exists. Publish labelled test builds
while human evidence is pending; never fabricate validation.

Required tests: capture components/ties, foundation/erosion/coverage invariants,
terrain transitions, actor domains and bonuses, deterministic replays, equal race
conditions and cooperative roles, simultaneous input, disconnected devices,
ten-mission flow, skips/chooser, failed preload/save, cross-release state and rollback,
keyboard/touch/controller, muted/reduced-effects/contrast and small screens.

## P00 implementation notes

The initial technical preview is `game/?journey=1`. The normal entry and frozen
editions retain their navigation until the replacement curriculum is ready. This
is a rollout safeguard, not final acceptance of the old maps as Journey content.
The preview route currently indexes 35 active bundled Solo missions; optional
external editions and historical maps remain available through the existing tools.
The audit still covers all 110 missions, including those editions.

- `game/journey/catalog.mjs`: stable mission ownership, ordered continuation,
  global search and explicit mode filters.
- `game/journey/authority.mjs`: shipped gameplay/equipment pins prevent edited
  same-ID imports from becoming official Journey missions. Custom content is
  preserved; this local identity check is not authentication or anti-cheat.
- `game/journey/profile.mjs`: version-independent, transactional IndexedDB event
  merging, session-only fallback, retry and progress export. Frozen save formats
  are not migrated or overwritten. Full backup restoration remains to be integrated.
- `game/core/capture-regions.mjs`: engine-owned retention calculation and a
  read-only, frozen-time component inspector for Studio and capture explanations.
- `docs/research/xposed-journey-ledger.json`: all 64 inherited observations and
  original hashes, with 48 provisional redesign allocations across the new campaigns.
  Historical proposals are preserved as non-authoritative research.
- `docs/research/journey-current-level-audit.json`: compiled static inspection of
  all 110 maps, not human playtesting. Player speeds are 8/10/12/15; 87 missions
  have countdowns. These old settings are preserved until replacement editions exist.

Verification so far: focused catalog/profile/capture tests, ten-mission Solo host
flow, Skip/return, automatic Solo reset, and failed cross-pack download/retry.
Existing Solo continuation, paired-race equality and Team core fixtures were run.
Native browser checks are scoped to local preview, not published acceptance.
Remaining P00 gates include complete source qualification, expanded lifecycle and
mode-flow checks, immutable release and actual Pages verification. Human enjoyment,
physical controllers, phone hardware and all P01–P15 content remain unvalidated.

The September 20 primary-source recheck confirmed the previously recorded Switched
counts and AirXonix field-versus-reclaimed-ground threat distinction. Neither is
used as evidence for Reloaded's exact collision/fill/timing algorithms. The chooser
uses a native modal with an explicit return path, guided by the
[W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Research sources

- https://store.playstation.com/en-us/concept/10002881/
- https://store.playstation.com/en-ca/product/UP2538-CUSA05619_00-XPOSEDPS4USGAME1
- https://www.nintendo.com/us/store/products/xposed-switched-switch/
- https://www.arcadearchives.com/en/title/aca-198/
- https://www.axysoft.com/airxonix/
- https://store.steampowered.com/app/45400/Fortix/
- https://store.steampowered.com/app/45450/Fortix_2/
- https://www.arcadearchives.com/en/title/aca-301/
- https://blog.playstation.com/2011/09/15/cubixx-hd-coming-to-psn-with-7-player-multiplayer/
- https://store.steampowered.com/app/116120/Lightfish/
