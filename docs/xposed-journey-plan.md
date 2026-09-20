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

The starting main baseline was ce8c72ed. P00 now incorporates the accepted v0.66.0
publisher 7b898a7b through integration b5193ca1; the public Team/Studio acceptance
is scoped, not whole-phase or physical-device validation. Preserve the user's dirty
original checkout. P00 uses 0.67.0 rather than reusing the allocated 0.66.0.

| Phase | Version | Scope | State |
|---|---|---|---|
| P00 | 0.67.0 | Audit ledger, direct flow, stable progress, capture teaching, three-mode fixtures | Scoped technical preview published and verified; remaining phase acceptance open |
| P01 | 0.69.0 | Foundations, Prologue/Horizon School, Remix, minimal Studio | PR172: candidate 3556e257 passed full hosted source qualification/freeze; accepted-baseline integration and public phase acceptance remain |
| P02 | 0.70.0 | Border Bloom, bonuses/frontiers, Studio CRUD/manual image workflow | Draft PR175: seven candidates with original art, complete-route fixtures and recoverable manual image workflow; not published |
| P03 | 0.71.0 | Signal Gardens, terrain/catalogs, reactive presentation, trace benchmark | Pending |
| P04–P12 | 0.72.0–0.80.0 | Campaigns 4–12, each with Remix/assets/mode qualification | Pending |
| P13 | 0.81.0 | Whole-Journey Solo/Versus, 12 Remixes, cuts/navigation/compatibility | Pending |
| P14 | 0.82.0 | Complete 12 Team missions and two-player balance | Pending |
| P15 | 0.83.0 | Human validation, accessibility/performance, Legacy/rollback | Pending |

September 20 release coordination: the parallel discovery feature PR170 initially
also selected 0.67.0. Its owner and Journey agreed to preserve the earlier P00
allocation and sequence 0.66.0 Team/Studio → 0.67.0 Journey P00 → 0.68.0 discovery.
P01–P15 therefore shift one further minor, as above; these later allocations remain
provisional. Preserve both features through reviewed integration and new exact-source
gates. Journey must not race the current publication owner or replace its selector.
Independent source correction, tests and content preparation continue during that wait.

Latest continuation instruction explicitly allows independent P01 implementation
while P00 publication waits. The local `codex/xposed-journey-p01` branch is stacked
on corrected P00 `6a42faca`; it is not an accepted release baseline. Integrate any
later accepted P00/Discovery changes and requalify exact source before publication.
The compiler, foundation runtime/replay tuple and local Studio workbench are
implementation candidates, not completed P01 content. See
`docs/verification/xposed-journey-p01.md` for scoped evidence and remaining work.

P01's separate candidate branch has ten original opening greyboxes, a versioned
foundation compiler/runtime, minimal map-first Studio with recoverable checkpoints,
capture overlays and topology diagnostics. Sixty mission/preset/steering combinations
have deterministic Solo and paired-board clear-route fixtures; these are feasibility
evidence, not pacing or human enjoyment. Direct structure controls create, duplicate,
rename and organize candidates without JSON editing. Dependency-aware removal and
archive/restore are implemented. All ten opening missions now have distinct
original raster reveal candidates, pinned to exact bytes, hashes and dimensions.
Whole-set native partial-reveal/contrast and human qualification remain open.
The three-preset next-attempt preference store is now wired into the opt-in Solo
opening host; Legacy and v1 Journey progress schemas stay unchanged.
The shared candidate attempt preparer now exercises all sixty opening full-clear
routes with exact compiler, preset, roster and replay identities, cancellation and
verified artwork. The opt-in `game/?journey=opening` now adopts these exact
attempts into the real Solo host after run/focus/save/preset ownership checks,
with original decoded pictures, cross-campaign Next, two-action Skip, a flat
ten-mission chooser and an optional (not auto-assigned) Remix. Candidate clears
record Journey progress, never Legacy collection/mastery awards. Candidate saves
use a separate revision-pinned slot; ordinary gameplay and `journey=1` are intact.
Studio now uses the actual authored Horizon theme, fixing its previous silent
Retro substitution. See `docs/verification/xposed-journey-attempt-boundary.md`.
Difficulty save failures now expose retry/export controls; cross-tab next-attempt
intent refreshes without changing the current flight. The opt-in paired-board
`game/couch/?journey=opening` now uses the same compiler, originals and presets
with real races, cross-campaign Next, two-action Skip, flat chooser, independent
Versus receipts and failed-preparation retention. Timed race decisions alone do
not grant mission clears. See `docs/verification/xposed-journey-versus-host.md`.
Both authored hosts share engine-derived starting-map cards, challenge bands,
next-preset labels, route decisions and optional practice challenges in the flat
chooser. No live capture prediction or mastery award is implied. See
`docs/verification/xposed-journey-mission-cards.md` for native layout limitations.
Broader host/controller qualification, Team adoption, human validation and release
gates remain. None of that branch's
implementation is implied to ship in the P00 technical preview.

The Team foundation increment now uses the same map compiler and explicit
two-seat authoring, with separately versioned runtime/pack editions and pinned
presets in actual Team imports. Studio can create Team island templates and edit
either starting position. The purpose-built Twin landings greybox has six complete
deterministic two-seat routes; it has no final artwork or human qualification.
This does not complete authored Team Journey navigation or P14. See
`docs/verification/xposed-journey-team-foundations.md` for exact limits.
Studio now exports exact selected Team test missions for the real Team host;
native export/import verified pinned Expert rules and both-seat movement. New
Journey Team editions automatically reset failed attempts with fresh controls,
while focus/settings/disconnection/faults cancel pending recovery. These close
the manual authoring-test path and scoped recovery gap, not the Team Journey
chooser/profile, final artwork, human balance or release gates.

P02 preparation is isolated on `codex/xposed-journey-p02`, draft PR175 stacked on
P01 `e7aa131f`. Six Border Bloom core candidates and one optional Remix progress
from outer-perimeter timing to changing-frontier shaping, with optional contact
bonuses. Source `2e6b21b8` now has 84 complete no-life-loss Solo routes covering
all presets/steering policies with authored bonuses and with every bonus removed;
exported replays verify and 84 paired-board repetitions finish equally. The second
frontier lesson now practices before combining patrol domains. These are omniscient
seed-1 feasibility checks, not human pacing or enjoyment. Native Practice has one
Expert first-closure observation, not a complete native playthrough.

P02's manual image workflow accepts bounded static local reference pictures,
crop/overlay, queued manual rectangles, shared validation, exact Solo Practice and
explicit copy-on-write Apply. It never infers collision or publishes artwork.
Unapplied tracing/reference state now has separate local recovery and portable backups;
assisted tracing and full native upload qualification remain open. The expanded
content/foundation/opening/Border cohort passes 135/135. The P02 branch must integrate
the eventual accepted P01 baseline before promotion; no phase ordering is bypassed.
Its preparation now includes candidate P01 through 3556e257, preserving the shared
Team authoring and real Solo/Versus hosts. Native image upload/crop/manual geometry,
inspection, explicit Apply and Undo have been exercised. Two reproduced stale
inspection/status issues are fixed with regression coverage. Local tracing persists
original bytes, accepted crops and queued rectangles per mission, with explicit restore,
exact map identity, compare-and-swap conflict checks, retry and separate export/import.
Restore never grants geometry Apply permission or publishes artwork. Native reload,
restore, inspection and Apply have been verified; full accepted-source qualification,
browser/device matrix and review remain required.

All seven Border candidates now have original botanical reveal compositions,
immutable byte/hash pins and a coherent palette with unchanged gameplay symbols.
Their 84 complete route checkpoints remain exact with artwork attached. The
17-image Horizon/Border registry is shared by optional-offline packaging; full
distributions preserve originals. Initial native Border partial-reveal evidence
does not complete whole-set contrast, human acceptance or campaign presentation.
See `docs/verification/xposed-journey-p02.md` and the Border assets' `PROMPTS.md`.

P02 now also composes `?journey=authored` in both real Solo and paired-board Versus:
15 core missions flow through Prologue → Horizon → Border with one deliberate Next,
while two Remixes remain optional in the same 17-card chooser. The older opening
URL, execution identities and suspended-flight slot are preserved. Stable receipts
carry across the library extension; combined-route attempts use their own slot.
Modeled real-host tests clear all 15 consecutively in each mode, and native
cross-pack Skip is verified. Human/full-device/timing and public acceptance remain
open, as do Team Journey navigation and inter-mode departure integration.

P01 follow-up adds optional Journey backup inspection and non-destructive restore:
missing records merge, current receipts/cursors win, and the v1 persisted schema
stays readable by previous releases. It does not replace a running attempt or award
scores. Its actual-host and persistence evidence is recorded separately in
`docs/verification/xposed-journey-backup-restore.md`; this is not a v0.67 feature.

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

P01 packaging follow-up: opening originals are explicit optional artwork in web
offline preparation, with exact authored pins and unchanged full-distribution
bytes. The title and offline status explain the online requirement. Bounded
packaging/offline tests pass; the existing 64 MiB guard remains and hosted full
qualification is still required. See `verification/xposed-journey-optional-artwork.md`.

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
  are not migrated or overwritten. Non-destructive backup restoration is implemented
  in the P01 candidate, not retroactively inserted into frozen P00.
- `game/core/capture-regions.mjs`: engine-owned retention calculation and a
  read-only, frozen-time component inspector for Studio and capture explanations.
- `docs/research/xposed-journey-ledger.json`: all 64 inherited observations and
  original hashes, with 48 provisional redesign allocations across the new campaigns.
  Historical proposals are preserved as non-authoritative research.
- `docs/research/journey-current-level-audit.json`: compiled static inspection of
  all 110 maps, not human playtesting. Player speeds are 8/10/12/15; 87 missions
  have countdowns. These old settings are preserved until replacement editions exist.
- `docs/research/reference-layout-review-pack1-pack2.md` and its pack3–pack4 companion:
  direct visual reinspection of all 48 numbered stills, specific original route
  proposals and merge/cut review pairs. These do not establish screenshot-only
  AI/terrain behavior or final playable dispositions. Final greybox evidence is pending.

Verification so far: focused catalog/profile/capture tests, ten-mission Solo host
flow, Skip/return, automatic Solo reset, and failed cross-pack download/retry.
Existing Solo continuation, paired-race equality and Team core fixtures were run.
Native browser checks are scoped to local preview, not published acceptance.
P00 source `6a42faca` passed exact-source qualification and is released as v0.67.0.
Publisher `555f0979`, Pages run 35487668271 / deployment 6548787815, verified all
3,573 public files (645,190,134 bytes, zero failures/retries), plus scoped native
keyboard Continue/Next/Skip/search/reload. The publication owner's receipt
`.cache/v0670-public-acceptance-r1/root-acceptance.json` is SHA-256
`37b5e83d29e6f9b81a8151351de7cad6cb789a3756d20904856340f965d2c1de`.
This is [the frozen opt-in technical preview](https://mekhovov.github.io/revealline/releases/v0.67.0/site/game/?journey=1),
not complete P00 or a replacement for the ordinary legacy entry.
Remaining P00 gates include expanded lifecycle/mode flow, offline/rollback and
performance acceptance. Human enjoyment,
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
