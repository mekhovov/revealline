# Consistent FPV gameplay and pixel-art presentation

Approved implementation plan, 24 September 2026. This supplements the spatial
challenge and Ukrainian ornament plans; it does not replace their accepted
geometry or claim their pending PRs are delivered.

## Completed investigation, not completed features

- All 91 accepted `whole-spatial-v5` Solo/Versus missions prepare with
  `stopOnCapture: true`. Ten legal-input core samples remained stationary for
  120 neutral ticks after nonterminal closure. This is not host or device proof.
- The ordinary public entry currently redirects to v0.96.0. Thirteen relevant
  public source files match inspected source
  `a4b4de89065b519bca13bb991319f2daee0fa73d` byte for byte. GitHub publication of
  v0.97.0 does not establish that the default public selector has adopted it.
- The UX owner observed two nonterminal default-Journey Versus captures stopping
  with released keyboard taps. Held keys, real gamepads and held touch were not
  established by that observation. The user's reported restart remains open.
- Pressure Lines has telegraphed pursuit/interception and global travelling
  trail impacts; the default Journey has no pursuer/interceptor and only selected
  impact-carrier contacts use travelling impacts. Erosion already exists in
  other chapters, including Frontier Lines.
- Compiled FPV actors and Team state recipes already exist. New appearance
  choices must not replace picture owners, mutate `themeId`, or reinterpret
  retained presentation pins.

## In progress

1. Actor-only asset preparation and rendering, then menu and host integration.
   Keep original pictures, palettes, music and custom overrides.
2. Versioned saved appearance and exact retained asset preparation. Leaf-module
   tests alone are not menu, renderer or complete saved-attempt integration.
3. The user's capture-restart report remains open. Do not change the core
   without reproducing its defect; native held-input/device evidence is pending.

Prepared source checkpoint: the actor-preference service and boundary resolver
are implemented, independently reviewed, and have 16 passing focused tests.
Three new held-touch reset regressions extend the complete 12-case touch cohort.
The combined 28-test cohort passed with zero failures/skips on Node 20.19.5;
scoped ESLint, Prettier and diff whitespace checks passed. The first actor test
run exposed explicit `undefined` being accepted as a default; strict record-field
validation corrected it before the successful rerun. These leaf APIs are not
connected to gameplay yet. Menu copy must say "next new launch or Next mission":
Retry deliberately retains the existing choice.

The differential actual-host cohort now passes 16/16 cases (159.19 seconds,
zero failures/skips): Journey versus Pressure Lines; Immediate and Grid steering;
modeled held keyboard, touch and controller; multiple frame substeps; stopped
continuation, pause/resume and fresh-input recovery. Two bays adds interior-ground
returns, and Nearby shore adds a 14-cell line-only island connection. Initial
fixture failures were corrected save-slot and obsolete menu-path assumptions,
not reproduced gameplay defects. This is modeled-host evidence, not physical
device proof. Its worker imported baseline sessions before the new v6 module was
edited; it does not qualify the new saved-appearance format.

The strict actor pin and optional `xonix-session.v6` save foundation preserve
v1–v5 shapes and byte limits. v6 requires an exact actor pin, allows a null
whole-theme pin, and keeps the embedded replay at 32 MiB. Owner binding is not
source approval or asset readiness. Independent source review found no blocker;
the implementation-owner's focused cohort passed 63/63, including oversized
replay rejection. An initial test assertion's wording was corrected. Host
activation and retained source/hash/decoded-role checks remain necessary.

Actor-only rendering is prepared for both board and Team painters, but not yet
selected by gameplay hosts. The combined 80-case renderer/Team-state cohort
passes with no skips. It covers all seven player roles in compact/detailed art,
authored-world preservation, custom-body precedence, unchanged simulation,
Team downed/rescue states and rejection before paint. Four board cases began as
red tests before implementation; one Team baseline run lacked six sparse-checkout
PNG fixtures (2,307 bytes); restoring exact tracked bytes resolved that setup
failure. These command/state tests do not establish native visual quality.

The shipped whole-theme catalogue covers only First Signal FPV, not the whole
Journey. Actor-only source approval must therefore remain a separate code-owned
registry; changing an owner or picture theme to pass full-theme compatibility is
not permitted. The shared loader needs a fixed actor-only acquisition profile.
Exact compiled revision 62 and its transitive assets must remain available when
a later presentation compile replaces the current manifest.

Standalone simulation replay files currently do not contain appearance pins.
Portable styled playback needs its own versioned presentation envelope and
Theater preparation path. Existing raw replays must remain supported and must
not acquire today's actor preference implicitly.

No new feature from this plan is publicly delivered yet. A draft source
checkpoint, successful test, merged PR and accepted public release are separate
states.

## Remaining delivery increments

| Increment | Remaining acceptance                                                                                                                                   | Effort estimate                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| 1         | Reproduce/fix reported capture restart; fresh launch defaults to FPV with menu choice across Solo/Versus/Team; retain Retry/Continue/replay appearance | 6–12 hours                           |
| 2         | Versioned global trail impacts, compatible Classic Current-rules editions and Team ownership adapter                                                   | 24–40 hours                          |
| 3         | Default pursuit/interception learning arcs, six ornament/FPV successor adaptations, meaningful erosion counterplay                                     | 16–28 hours                          |
| 4         | Directional state animation, visible-envelope actor sizing, shared trail/reveal feedback                                                               | 16–28 hours                          |
| 5         | Neon Arcade and FPV Field Kit skins, Tiny5 integration and accessible pixel-art shell on shipped pages                                                 | 16–32 hours                          |
| 6         | Team specialist authoring, complementary missions and final human/device qualification                                                                 | 24–40 hours plus tester availability |

These are effort ranges, not publication dates. Split increments into reviewable
playable releases and use the next publisher-allocated version. PR320 (UX),
PR323 (six spatial redesigns) and PR332 (ornament studies) keep their owners.
Prepare one successor while the sole publisher promotes the accepted candidate.

## Required gameplay contracts

- Closure stops the craft, clears queued and remaining-substep movement, and
  requires a fresh direction. Existing holds/repeats cannot resume it. Ordinary
  reclaimed-ground travel remains valid; walls are not return surfaces.
- New current-rules editions use the existing two-front trail path algorithm:
  one seed per source/cut, preserve multiple fronts, earliest arrival resolves,
  departure front expires, valid closure cancels. Only a front/closure tie favors
  closure; immediate body/self/lethal collisions keep their priority. A near-head
  impact has no guaranteed grace. Freeze blocks new enemy impacts, not existing
  fronts; enemy slow does not slow fronts.
- Keep authored impact speed 24 through one existing tuning preparation
  (38.4 cells/second Standard). Show authored/effective values separately. Do not
  add a blanket speed increase or silently change historical policy revisions.
- Ordinary keepers stay straight between impacts. Specialist pursuit is visible
  warning, finite committed route and recovery, initially 0.75/1.2/2.5 seconds.
  Teach pursuers in Return in reserve / Two ways home / Dogleg transfer, then
  interceptors in Crossed bands / Pressure ladder / Signal channels. Replace
  selected keepers; retain geometry, actor counts, other roles and objective links.
- New editions replace redundant impact-carrier roles without changing their
  identity, retention or links. Original editions/replays stay immutable; Custom
  changes require explicit Studio opt-in. Next follows authored sequence, never
  search order or an accidental Current/Original transition.
- Team fronts belong to `(playerId, cutId)`. Joint/completed closures cancel only
  completed owners; partner fill removes secured fronts and rebases surviving
  trail suffixes. Death/disconnect/new cuts cannot transfer effects. Arrival uses
  Team knockdown/rescue, not Solo failure rules.

## Appearance contracts

- Default Neon Arcade chrome plus FPV actors. UI skin and FPV/campaign actors are
  independent choices; original pictures and music remain unchanged.
- Use one preference owner/resolver across hosts. Chrome may change immediately;
  actors apply on launch/Next. Retry, Continue and replay retain exact accepted
  presentation. Add a versioned saved-appearance contract where required; do not
  append unchecked fields to existing strict pins.
- Prepare required slots before adoption. Failure retains the old accepted view
  with truthful status. Custom overrides and Team downed/rescue states retain
  their existing precedence. Do not use a generic actorSkins override that bypasses
  compiled images or change a theme merely to activate FPV rendering.
- Reuse directional animation; scale visible bounds and rotor sweep around the
  existing pivot, never change hitboxes. Initially qualify 24–32 CSS-pixel desktop
  and 20–24 compact visible envelopes, with larger bosses.
- Active trails, return contours, impact fronts and capture effects have distinct
  roles. Essential warning remains in reduced-effects mode. Tiny5 needs credits,
  font-loading/cache/canvas integration and Ukrainian glyph checks. Plain text,
  Large text, contrast and 44-pixel touch targets remain available.
- Apply shared chrome to all shipped app-owned surfaces, including Studios,
  Workshop, replay, practice, recovery and support pages. Exclude historical
  frozen HTML, third-party captures, user art and semantic editor overlays.

## Verification and release gates

Focused checks must cover all input methods/control styles, genuine closure and
line-only/foundation returns, held input and fresh rearming, multi-substep frames,
impact timing/ties/bonuses/replay, and Team topology/ownership cases. Distinguish
modeled inputs, actual browser evidence and physical-device testing.

Qualify two viable routes per changed mission across presets, safe departures,
active signature threats and no mandatory bonus or prolonged quota cleanup.
Check actor/hitbox alignment, bright/dark pictures, compact layouts, Ukrainian,
Plain/Large text and reduced effects. Public tests cover default entry, retained
editions and clear → cross-campaign Next → Skip → reload/Continue.

Each playable increment needs reviewed source, validation/lint/format, build and
production provenance, immutable hashes, preserved archives, Pages availability
and bounded actual-public play. Long suites may be explicitly waived, never
reported as passed. Balance remains review-pending until human evidence exists.

Local disk exhaustion currently prevents even tiny Git writes and can break
browser persistence. Development may use a bounded temporary-memory checkout;
push source promptly because RAM is not durable. Do not delete unpushed changes,
other tasks' data, user media, original evidence or historical releases. Hosted
builds do not establish local save-recovery acceptance.

The remaining spatial phases, reference dispositions, whole-Journey balance and
original P13–P15 accessibility/performance/human acceptance remain open.
