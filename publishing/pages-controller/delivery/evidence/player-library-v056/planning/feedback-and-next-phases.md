# Player feedback and the next delivery phases

Updated 15 September 2026. v0.56 is a published, verified iteration. The complete production target remains unfinished. This review carries forward the approved execution plan and makes the latest feedback explicit; it does not turn a source feature or a passing model test into all-device acceptance.

The latest movement instruction supersedes the older requirement to keep moving after capture: **a capture-stop craft continues during a cut after key release, then stops when it closes that cut on revealed ground and waits for a fresh direction.** Immediate and Grid + buffer remain independent turning settings. Pause/Resume preserves intent; returning focus does not resume.

## Feedback coverage

| ID | Requested result | Current evidence | Remaining acceptance / phase |
| --- | --- | --- | --- |
| F01 | Stop when a cut reaches revealed ground | Delivered for authored capture-stop Solo; the public 50% capture and paused save/reload are recorded. | Preserve the behavior across advertised modes, input adapters and both turn modes; P03/P18. Do not reinterpret old replays. |
| F02 | Faster, smarter, more challenging enemies | Pursuit/interception and pressure campaign behaviors exist. Three Standard/Immediate source missions were completed, with losses and retries retained. | This does not settle the reported boredom or difficulty. P09 must compare route pressure, telegraphs, escape options and difficulty progression in real play. Avoid unavoidable spawns or artificial waits. |
| F03 | Detailed animated enemies facing movement | Shared heading, rotor and actor rendering exist. | Review every role/theme/state at actual play size; movement direction and danger must remain distinguishable. P05/P08/P09. |
| F04 | Consistent actor style and readable size | Field Kit body cohorts and shared presentation are integrated. | Finish both detail treatments, movement/ability/hit/recovery states and Team readability. Body images do not count as complete animation sets. P05/P08 and campaign deliveries. |
| F05 | Better active trail, impact and reveal visuals | Travelling line impacts and capture/loss/pickup feedback exist and were sampled in source play. | P08-B must cover all modes and reduced effects. A struck unfinished line propagates authored danger; successful closure before the impact reaches the player must stay legible. Direct contact remains a separate threat. |
| F06 | Every menu works without a mouse | Public keyboard journeys passed for Missions, Settings, Studio, Library disclosure and Team Pause/Options/Back. | P03/P16/P18 must cover the complete navigation matrix with keyboard, controller and touch. Sampled keyboard success is not physical-controller certification. |
| F07 | A native-feeling game, with useful device controls | Full-browser presentation, contextual touch pads and compact pause panels are integrated. The desktop title and arena have no old permanent action toolbar. | P01 loading/cancel/retry; P03 consistent mode entry and Back; P18 safe-area, orientation, controller and device acceptance. Authoring tools remain separate. |
| F08 | Consistent modern pixel art everywhere | Field Kit title/menus/art and readable text options are integrated. | Team artwork and shared Plain/Large preference propagation, actor size/state parity and legacy victory objects remain open in P05/P08. |

Arcade bonuses activate through play and authored progression. It does not expose universal Scan/Supply/Boost buttons. Tactical maps may explicitly authorize those actions: scanning supplies hints, supply points refill supported payloads and boost changes movement where enabled. These are authored class/map mechanics, not mandatory controls for every game mode.

The enemy catalog and behaviors support differentiated roles, but the complete bomber/impact/fiber campaign progression is still unfinished. Fiber signal resistance and vulnerable cable, carrier payloads and impact/redeployment need deliberate encounter recipes, clear counters and independent play verification. Runtime behavior uses abstract game rules; real equipment references inform silhouette and role rather than operational simulation.

## Prioritized execution

The phase IDs below are the active cross-mode execution IDs. Earlier broad P0–P9 milestones remain requirements history, not a second competing completion register.

| Order | Phase | Player-visible result and release gate |
| --- | --- | --- |
| 1 | P01 — in progress | Loading, Cancel, Retry and stale-completion handling throughout game and tools. Accept the exact source, frozen release and public journey before advancing. |
| 2 | P02 | Shared audio controls in Solo/Versus/Team; Studio preview obeys master mute/volume; real audible MP3 and mixed-playlist playback, actual backup/import and offline checks. Full-track listening is separate from parser tests. |
| 3 | P03 | Consistent Start/Continue, lobbies, Back and Resume across modes, using keyboard, controller and touch. No Confirm leakage into gameplay. |
| 4 | P04 | Versioned editions, configurable registered rules and complete create → validate → install → play → update/recover pack workflows. Preserve original media bytes. |
| 5 | P05 | Shared readable typography, palettes, focus and ornaments across screens, including Team and Large/Plain/reduced-effects settings. |
| 6 | P06 | Campaign discovery and explicit optional installation; failed or cancelled downloads preserve the working edition and saved run. |
| 7 | P07 | Direct Retry/Next, clear mastery and unlocks, one-time rewards and recoverable results. Full-picture celebration is followed by an optional skippable story and Collection replay. |
| 8 | P08-A / P08-B | Apply approved artwork to every advertised mode, then complete trail/impact/loss/rescue/victory feedback. Replace legacy reward objects through the asset catalog. |
| 9 | P09 / P10 | Varied fair enemy/class encounters and two richer Team encounters. Verify readable warnings, viable counters, gradual difficulty and both players' roles. |
| 10 | P11-A–D | Four FPV campaigns, twelve new Solo missions each. Deliver each with its own artwork, actors, soundtrack, rewards, progression and tests. |
| 11 | P12-A–D | Four DroneAid campaigns, twelve new Solo missions each, with authored class/objective interactions and complete assets. |
| 12 | P13 / P14 / P15 | Twelve missions each for Ukrainian culture, retro arcade and spend management. Theme identity changes more than a palette; keep role readability. |
| 13 | P16 | Complete supporting screens, Collection, scores, saves and recovery, with the same navigation and presentation contracts. |
| 14 | P17 | Finish AI skills, prompt variants, CLI examples and reproducible independent authoring/installation/recovery demonstrations. |
| 15 | P18 | Full browser regression, public deployment, offline/media recovery, performance and real device/controller qualification. |
| Later | Native / online | iPhone, macOS, Steam and Steam Deck each need lifecycle, files, signing/store and hardware acceptance. Network multiplayer is a separate follow-on; couch remains in browser scope. |

The campaign programme contains **132 new Solo missions**, not 132 completed missions. Team support is declared and verified per campaign rather than inferred from Solo play.

The separate inventory remains: 29 map families / 116 pictures, 12 stories, 56 complete character presentation sets and 24 finished tracks. The delivered historical map/picture cohort is 15 / 60; three additional families / twelve pictures remain candidates until qualified. One story is released. **Forty reserve illustrations are reviewed source originals**, ten per theme; these are not extra installed maps. Thirteen AI skills are included; end-to-end independent authoring remains P17 acceptance.

## Concrete next audio slices

The [detailed audio matrix](audio/ACCEPTANCE.md) distinguishes existing behavior, source checkpoints, historical silent-fixture proofs and the remaining actual-media checks.

1. Connect Studio audition to the existing master mute/volume authority. Verify delayed Play, native media controls, Close, hidden state and disposal cannot bypass mute or restart a stopped preview.
2. Reuse the shared saved music library in Versus and wire the existing player contract into Team. Preserve mode-specific progress and inputs. Full-document navigation does not imply gapless continuation.
3. Use two distinct owned audible MP3s, a built-in synth entry and a duplicate track to qualify order/shuffle/repeat, actual exported bytes, deliberate import/Undo/Save and cached offline playback. Then qualify the finished campaign tracks by listening.

P01's accepted successor must be the implementation baseline. The matrix's `6cfe315e` checkpoint is an inspected interface, not a declaration that P01 is accepted.

## Research applied and how completion is reported

[Xbox UI-navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports consistent focus order, Back behavior and full digital-input navigation. The implementation gate is the whole player journey, including scaled layouts and nested dialogs.

[MDN audio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) supports streaming full songs, bounded decoding for short cues, explicit audio activation and working volume/mute controls. [Autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) informs blocked-start and retry behavior. These are architecture recommendations, not proof of audible playback.

XPOSED/Reloaded remains a reference for reveal tension, compact presentation and picture rewards. Exact movement, collision, fill and animation claims must retain their observed/documented/inferred labels; a store description cannot establish frame-level behavior. Campaign artwork and music stay original or properly licensed.

Each accepted slice records its requirement IDs, source/commit, playable release, actual test/browser evidence, remaining issues and updated authoring guidance. Logical commits and PRs preserve history. Public deployment follows frozen-package qualification; physical-device and subjective play-quality gates remain explicit. Tests prove behavior within their scope, not that the game is universally fun or production-complete.
