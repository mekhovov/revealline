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

1. Actor-only asset preparation, rendering and all three menu/host integrations
   are implemented in draft PR338. Independent review and frozen-build/public
   qualification remain; original pictures, palettes and music stay unchanged.
2. Versioned Solo saved appearance and exact retained asset preparation are
   integrated. Standalone styled replay export/playback remains incomplete.
3. The user's capture-restart report remains open. Do not change the core
   without reproducing its defect; native held-input/device evidence is pending.

### Implemented and focused-verified; not publicly released

| Boundary                       | Candidate status                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Shared FPV/Campaign preference | Implemented; FPV default, session-only warnings and stale preference cancellation                                 |
| Solo                           | Menu, atomic actor preparation, exact v6 Continue/import, Retry/Next and First Flight handoff integrated          |
| Versus                         | Menu, shared paired-board actor lease, Resume/Rematch retention and failure rollback integrated                   |
| Team                           | Menu, picture/actor readiness, Retry retention, independent craft-state rendering and Custom exclusion integrated |
| Preservation                   | Historical save formats, exact retained revision 62, authored pictures/music and Custom owners preserved          |
| Public delivery                | Not released; no game-version/tag/Pages change in PR338                                                           |

### Open before claiming increment 1 complete

- Reproduce and fix the reported live capture restart; the investigation has not
  established a defective command path.
- Standalone recorded-actor replay export and Theater preparation (separate
  proposed successor in `fpv-replay-presentation-follow-up.md`).
- Final exact-source production/build checks, coordinated version allocation,
  frozen release and public qualification. Publisher coordination places this
  feature after accepted UX0 source; do not merge it ahead of that owner.
- Held-device/input qualification, reliable native persistence and public
  Team earned-Next coverage. The local disk remains exhausted.
- Reconcile the branch-local draft production 63 with UX0's separately owned
  production 63 after UX0 acceptance. Regenerate from the accepted ledger into
  the next unused revision; never replace that owner's revision 63 or treat
  this branch's draft as cross-branch release authority.

Prepared source checkpoint: the actor-preference service and boundary resolver
are implemented, independently reviewed, and have 16 passing focused tests.
Three new held-touch reset regressions extend the complete 12-case touch cohort.
The combined 28-test cohort passed with zero failures/skips on Node 20.19.5;
scoped ESLint, Prettier and diff whitespace checks passed. The first actor test
run exposed explicit `undefined` being accepted as a default; strict record-field
validation corrected it before the successful rerun. These leaf APIs are not
now connected to gameplay in the candidate, not the public release. Menu copy says "new missions and Next":
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

Actor-only rendering is selected by the candidate board and Team hosts.
The combined 80-case renderer/Team-state cohort
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
The fixed actor loader/lease is implemented and independently reviewed: 14/14
focused cases pass using exact compiled bytes and modeled decoding. The 37-case
existing loader/lease cohort passes with exact Git-byte reads for sparse binary
fixtures and RAM temporary storage; earlier missing-file and `/tmp` ENOSPC
attempts are not passes. Actual browser decoding remains a release gate.

Exact compiled revision 62 and its transitive assets now have an explicit
immutable compiler input and hash-named runtime alias. The 7/7 retention cohort
verifies deterministic regeneration, all four retained revisions and unchanged
132 original/equipment payloads. No images/audio were copied into a new
collection. See `field-kit-runtime62-retention.md`.

Actual Solo integration exposed that candidate Journey pictures deliberately
have no managed-media pin. The unreleased v6 format now uses explicit
`presentationPins: null` only for Solo Journey actor contexts, with no Classic
whole-theme pin. It does not manufacture picture receipts. The core restore
still checks the accepted runtime; the host must independently re-resolve the
complete project/content identity before actor adoption. Seven real compiled
Journey save tests cover all presets and both styles; 45 focused Classic,
managed-v6 and historical-v5 checks also pass. The actual Solo host re-resolves
the authored Journey context and rejects a forged same-ID project hash before
replacing the running attempt or saved bytes.

Team's focused host/picture cohort passes 24/24, including readiness, disposal,
preference cancellation, Retry pin retention and same-ID Custom exclusion.
The root's combined Team/Classic/Journey session cohort passes 46/46 with zero
skips (7.76 seconds). A pre-existing untuned Team earned-Next route fixture fails
in both the changed host and the exact HEAD host; that old helper is unchanged.
A new focused test uses the actual Standard gp4 preparation and 1,240 legal
commands: 68.319% earned coverage, no downings, then First Connection → Relay
Yard with fresh FPV or changed Campaign actors and preserved difficulty. The
2/2 Legacy Team host cases pass; they do not qualify all Journey Team missions.

That post-metadata test found two genuine Legacy Team startup regressions:
missing exact draft-63 picture associations and a five-policy parser bound that
could not admit the sixth preserved policy. Both are fixed with all 58–62
associations and image hashes unchanged. Binding/presentation checks pass 52/52;
the root's combined actor/earned-Next/binding/presentation cohort passes 59/59
with zero skips (8.02 seconds). Native Legacy Team readiness and Start also
succeed after the fix. Earlier failed startup/untuned-route runs remain failures.
Versus's initial 12-case cohort passed, but independent review then found a
setup observer leak and an optional authority-index outage blocking Custom
launches. Both are corrected: the final 14-case cohort passes with zero skips;
10 actor-host cases also pass against regenerated production revision 63.

Solo's final actual-host appearance cohort passes 16/16 with zero skips
(114.95 seconds); First Flight compatibility passes 14/14 separately. It covers
Base and real Journey saves, historical v5 Continue, exact v6 import, forged
project/actor rejection, legal clear → failed Next → Retry → successful Next,
stale preference cancellation and same-ID Custom authority outages. Two earlier
cohorts each passed 15/16 but missed their expected injected actor failure:
production revision 63 correctly requested the retained hash-named revision-62
manifest while the fixture intercepted only `runtime.json`. Correcting the
injection to the actual pinned URL restored the original five-second bound.
No product or latency fix is inferred from that fixture correction.

The current-source browser preview decoded FPV actors, cleared First return and
opened the next Journey mission with FPV actors. This is not frozen/public or
held-input proof. Local storage/profile-lock failures prevent persistence
qualification; no user storage or locks were removed. CI on `44bdea06a` passed
validation, lint, formatting and source identity, but failed the production
revision-ledger check. Its build and long suite were skipped, not passed.
The ledger was repaired additively as revision 63, with 71 new source-stage
recipe revisions and zero changed prior records or original media payloads.
This is not new artistic/functional approval. Actor rendering stays pinned to
exact revision 62. Hosted preflight passed on `9eccd5e61`; the final host commit
still needs its own exact-head checks. See the scoped native preview receipt;
its post-reload Solo/Versus/Team decoding is not public acceptance.

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
