# Reveal Line: player-first UX execution

Approved 24 September 2026. This replaces the execution order in the older
whole-game plans; it does not erase their content, compatibility or qualification
requirements. Each independent feature is released before the next is accepted.

## Current delivery status

Checkpoint on 24 September 2026: **the public root reports v0.104.0 from source
`1deaae1a9a30c6146ecbb36c83cf43c9346a57c0`. It inherits v0.103.0's bounded
player-craft cleanup and M0 preparation/input correction, and adds the qualified
Classic current-rules launch repair. Archive68 preserves v0.101.0 with a complete
1,133-file / 596,150,433-byte public audit. M1 v0.105.0 is merged as
`5c2abaa3c4e516f6625fe707eb3e21a9925566ef` and is undergoing exact-source
freeze/publication. M2 v0.107.0 is the next isolated player-menu candidate;
M3–M4 and
UX1–UX6 remain unfinished.** The former
PR320/v0.98 references below are retained as dated evidence. PR320 became conflicting
after publication; its UX0-owned changes were reconciled onto the current main
baseline without changing the immutable v0.98.0 tag.

The repository's temporary fast-release policy is now authoritative. UX0 requires
focused player-flow checks plus ordinary PR preflight, build and release-ready
jobs. The cancelled long matrix remains historical evidence and its uncompleted
shards are recorded as deferred rather than passes. Post-merge qualification uses
`run_tests=false` and `freeze_snapshot=true` before the guarded release, selector,
Pages and public verification sequence.

Player review of the published craft found that its detached white corner
locator obscures the silhouette and has no clear gameplay meaning. The bounded
v0.103.0 correction removes that overlay from current Journey rendering while
retaining the approved body assets, animated rotors, contact-radius ring, shield
cue and simulation geometry. The public v0.104.0 source inherits that correction.

### Priority adjustment: compact native player menus

The next player releases address the reviewed Home, Pause, Solo, Versus and Team
screens before reward/gallery expansion. They keep the existing gameplay and
content infrastructure while removing the setup prose and duplicate actions that
make ordinary play feel like an administration page.

| Order | Release feature                    | Required behavior                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0    | Safe preparation and confirmations | Start/Continue stays focused and visibly changes to Preparing. Repeated or held Confirm cannot activate a newly inserted action. Back/Escape stops preparation; a secondary touch-accessible Stop loading action remains available without taking focus. Confirm Restart only when an active attempt would lose meaningful progress. Move Skip out of the changing top-bar label. |
| M1    | Compact Home and global More menu  | Keep Solo/Versus/Team, one primary Start/Continue/Resume action, Missions, Collection, Settings and quick Sound. Move difficulty and actor choice into collapsed Play options. Move Help, Workshop, Replay, Controller Lab, About and Releases into More. Hide technical/offline prose unless recovery is needed.                                                                 |
| M2    | One Pause authority                | During play retain only the compact shell controls. Pause owns Resume, Retry, Missions, Settings, Help, quick Sound and Home. Remove duplicate Missions, Skip, Collection and Settings actions from the play bar. Child screens return to Pause and Resume stays deliberate.                                                                                                      |
| M3    | Couch quick-start parity           | Versus and Team use the same header, mode selector and action order as Solo. Valid defaults make Start immediately available. Put difficulty, actors, match format, teamwork and assignments in collapsed Play options; remove duplicate All missions links and authoring language.                                                                                               |
| M4    | Global route and device closure    | Prove every player destination, including release history, is reachable from the game menu. Verify exact return focus and responsive order with keyboard, controller/D-pad and touch at desktop, 1280×800, portrait and short landscape layouts.                                                                                                                                  |

M0 is published in v0.103.0 and publicly inherited by v0.104.0. The v0.104.0
selector and public-root version/source check are accepted; the separate v0.103.0
GitHub release remains immutable without a dedicated Pages route.
M1–M4 each receive
their own next-unused version, PR, exact-source qualification, immutable release,
Pages deployment and public-play check. The earlier UX1 rewards/gallery work then
resumes, followed by UX3–UX6. New bulk content stays outside this critical path.

M3 is reconciled onto the v0.108 publication line as the isolated v0.111.0
release candidate on `codex/couch-quickstart-parity`. Versus keeps Start and
Browse missions visible while actor, difficulty and advanced match setup live
under Optional setup. Team keeps Arena,
Start and Browse Team arenas visible while teamwork, difficulty, actors and created
pack import live under Optional setup. Initial Team picture preparation exposes an
explicit secondary Cancel without taking first focus, and current FPV revision 73
retains the two exact reviewed Team picture associations plus revisions 58–72.
Publication, responsive browser review and physical controller/touch evidence remain
release gates rather than claims of this source checkpoint.

The successor reconciliation joins the real staged replacement in the broad Couch
tests instead of assuming synchronous picture or actor preparation. Back from setup
now proves that the pending replacement aborts while the accepted boards, picture and
Start action remain usable. The native DOM fixture models a real `summary` disclosure,
so assigned-controller coverage reaches Optional setup without exposing its controls
in the quick-start focus order. A clean sparse checkout must include every tracked
authoring path named by `game/build-config.json`; after those paths were hydrated, the
repository validator passed. Their earlier absence was a checkout limitation, not a
missing production asset.

Completed publication and scoped source evidence:

- The v0.97 selector PR341 deployed source
  `1518e15e248b59c6470cc6931023eaf6f1ac363c` through publisher
  `ca3f3fd638e02e1907a0811d7759d24ba8f726b6`, run `35962558115`,
  deployment `6631370106`. The full main audit passed **4,271 files /
  625,227,678 bytes**, with zero failures, retries or skips. Fresh release/tag,
  nine-asset descriptors and publishing authorities remained unchanged.
- Main native keyboard checks covered root entry, Missions preparation and exact
  Back focus, a real Team capture/Pause, guarded departure and Versus
  movement/life-loss/Pause. No main-origin win/Next was performed. Separate
  Archive66 evidence contains a Versus win/Next; it is not relabeled as main play.
  Full physical-disk errors prevented persistence/offline acceptance. Hardware,
  full accessibility, balance, audio and complete player journeys remain open.
- [PR344's accepted delivery record](https://github.com/mekhovov/revealline/blob/2f477c69af46cb5dfc817125b63670c90046357f/publishing/pages-controller/delivery/v0970-publication.md)
  merged as `2f477c69af46cb5dfc817125b63670c90046357f`. Its delivery-only scope
  preserves historical records and does not trigger another Pages deployment.
  Archive65 preserves v0.96; Archive66 independently preserves v0.97.
- PR320 contains UX0 input, focus, retained-artwork and guarded-departure
  corrections with scoped review/tests. All four current Solo/Versus host
  wrappers have their separate 71-mission proof: 142 Solo wins, 142 Versus races
  and 280 deliberate Next transitions. Specialized Team and historical-original
  proof remains separate from the unfinished complete suite.
- Infrastructure PR337 passed 64 hosted Node and five Python checks plus
  preflight/build; PR339 passed 100 utility checks plus preflight/build. Both are
  merged. These tests do not relabel v0.97's historical gameplay-suite waiver.

**Four failures have been observed in the original full CI run at
`26fe20f8c00aa2d09238595c8856fa5572ea0561`; that run is not a passing gate.**
The full inventory and final run conclusion remain pending:

| Observed failure                               | Classification and correction                                                                                                                                                                        | Verification state                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Solo post-adoption Missions opening            | Fixed five-second fixture poll expires during real cold catalogue preparation. Join the actual returned operation and retain immediate loading/input/ownership assertions.                           | Complete corrected Solo file 16/16 and controlled delayed case passed; retained in checkpoint `b3963c54`, not the canonical PR head. |
| Queryless Versus controller All missions       | Same cold catalogue polling assumption; observe the real controller activation and join its operation.                                                                                               | Complete corrected Versus file 10/10 and delayed whole-file check passed; same noncanonical checkpoint.                              |
| Solo held Confirm across result Next           | A controlled 6.5-second real bitmap preparation reproduces the old five-second poll expiry; baseline local case passes. Return the already-owned nonterminal Next preparation promise to its caller. | Complete terminal file 11/11 passes with zero skips; targeted delayed selection separately passes.                                   |
| Solo result picture/Back → appearance/Missions | A controlled 6.5-second real catalogue fetch reproduces the poll expiry; baseline local case passes. Return the existing library-opening promise from appearance routing.                            | Same complete 11-case file and separate delayed selection pass; these are shared evidence, not another file.                         |

The terminal changes expose existing operations; they do not change gameplay,
timing, cancellation, focus leases or settled outcomes. Keep held Confirm,
tick-zero adoption, retained pictures/checkpoints, native editing and deliberate
Resume assertions.
The complete terminal file passes **11/11**, with zero failures, cancellations
or skips (163.30 seconds). The separate controlled-delay selection passes two
selected cases; nine were unselected. These are distinct runs, not additive test
totals. The original full-CI inventory and conclusion remain **pending**.

The canonical PR head remains `26fe20f8` at this checkpoint.
`b3963c542d3d3921f17e98e1bf74611f8624f407` and the terminal correction overlay
are reviewed/preserved work, not canonical branch qualification or public releases.

### Next steps and ETA dependencies

| Order                   | Next action                                                                                                                                                                            | ETA dependency                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release-train closure   | Completed: v0.104.0 is selected at the public root; Archive68 preserves v0.101.0 with exact public-byte evidence.                                                                      | v0.103.0 remains an immutable GitHub release without a separate Pages route; its source is inherited by v0.104.0.                                                                               |
| M0 — preparation safety | Published in v0.103.0 and publicly inherited by v0.104.0: stable Start/Continue ownership, held-Confirm protection and accessible Stop loading/Back.                                   | Physical controller/touch checks remain separate from the modeled and browser evidence.                                                                                                         |
| M1 — compact Home       | PR381 merged as v0.105.0: optional tuning under Play options; compact player menu; More exposes Help, tools, About and Releases.                                                       | Exact merged-source freeze, immutable release, selector admission and public verification are running.                                                                                          |
| M2 — unified Pause      | v0.107.0 candidate: Pause owns Resume, Restart, Missions, Help, Settings, quick Sound, collapsed Mission info and Home; the active-flight bar no longer duplicates those destinations. | Focused host tests pass 18/18; scoped lint/format, validation and a 1,136-file production build pass after rebase; responsive browser and hosted exact-head qualification remain release gates. |
| M3 — Couch quick-start  | Apply the same compact hierarchy to Versus and Team, with valid defaults and collapsed advanced setup.                                                                                 | Requires both-player assignment and responsive/controller/touch checks.                                                                                                                         |
| M4 — navigation closure | Inventory all player destinations and qualify keyboard, D-pad/controller and touch across required layouts.                                                                            | Physical hardware remains distinct from modeled evidence.                                                                                                                                       |
| UX1-A, then UX1-B       | Exact-art Journey rewards/completed cards, then the compact complete mission gallery with previews and retained selection.                                                             | Resumes after M0–M4; each independently useful feature receives a verified release.                                                                                                             |
| UX3                     | Objective-led HUD, boards/touch controls and contextual teaching.                                                                                                                      | Depends on shared navigation and agreed viewport/input checks.                                                                                                                                  |
| UX4                     | Countdown, short Retry, deliberate terminal Retry and named continuation releases.                                                                                                     | Depends on stable prepared-attempt/input ownership and outcome proofs.                                                                                                                          |
| UX5                     | Settings/difficulty, Collection/Records/replay, help and friendly content/storage recovery.                                                                                            | Preserve exact originals, ordinary player access and explicit recovery limitations.                                                                                                             |
| UX6                     | Complete cross-mode journeys, accessibility, performance and public regression.                                                                                                        | After feature closure; physical devices, human balance, replay portability and comprehensive offline evidence need separate qualification.                                                      |

Later-phase delivery estimates begin after their predecessors are accepted.
Do not promise calendar completion from the old targeted failure count or the
current partial suite. Report a revised release ETA when the final corrected
head and complete run inventory are known. No bulk campaigns or artwork enter
the critical path before reliable player flows.

## Earlier release checkpoints

At the opening reconciliation, public Pages reports v0.95.0, source
`8c383561140289fee2cefa9450a7439c8f485a03`. GitHub v0.96.0 is published, but its
Pages promotion (PR319, run35941291080) is still in progress. Main is
`42e42ead29b02f109268597c760861168314d74b`. PR314 reserves v0.97.0 for the
separate Twin receiver change. UX0 is prepared independently from main; its next
unused release version must be checked before committing. These are dated
observations, not a claim that a later deployment has completed.

Subsequent metadata check on 24 September: PR319 merged and the public root
`release.json` now reports v0.96.0 / source
`781e1c3b82236003bf8600a2cac0b5022e4298c1`. UX0 remains a separate v0.98.0
candidate; it is not contained in that deployment. Full v0.96 public-play acceptance
belongs to its existing publisher, not this metadata check.

The subsequent UX0 integration includes main `1518e15e2` (PR314 and PR322).
PR320 targets v0.98.0 with mandatory suites restored; v0.97.0 remains owned by
the existing publisher and was still a draft at the latest GitHub metadata check.
UX0 scoped input/host/browser checks pass, but the full suite exposed additional
baseline fixture failures. Corrections and their separate reruns are recorded in
the verification document. UX0 remains qualifying until full exact-source checks,
immutable publication and ordinary public-play verification pass. UX1 is next;
neither a merged PR nor a partial test run advances this board to accepted.

The later reconciliation batch passes 180 distinct host checks across separate
full-file runs, plus 28 route-evidence checks. It preserves historical fixtures
and independently qualifies fresh tuned routes; current public UI traversal is
distinguished from retained historical component tests. The candidate's hosted
preflight and ordinary build pass. All four mandatory test shards must finish on
the final committed source before merge/publication; those pending gates remain
the immediate priority, ahead of UX1 rewards/gallery work.

The next completed correction cohort passes 231 checks in separate complete-file
runs, followed by the Library/Journey mode (41), text/input (24) and optional
installer (30) groups. These are still scoped qualifications. The complete hosted
run has exposed additional historical routes that do not complete with current
movement tuning, plus the exact Team artwork-review dependency gate. Fifty-four
of the 71 historical Solo routes need newly verified current-input proofs; 33
specialized Team cases require cooperation/pickup/inner-return behavior, not just
generic wins. The Team renewal estimate is 3–6 hours with low confidence, before
another full source/release run. A public deadline cannot be promised until that
inventory is closed. One confirmed Pause Restart/difficulty picture-context defect
is fixed and separately tested; it is not classified as a fixture-only issue.

The root working directory contains unrelated historical and unfinished work.
Implementation uses an isolated source worktree and explicit staged paths. The
existing publisher retains tags, archives and Pages ownership. Skipped tests under
the historical repository waiver are not passes: UX0 restores the source policy
to `required` and qualification also explicitly requests `run_tests=true`.

## UX0 qualification checkpoint — 24 September, source preserved remotely

This checkpoint supersedes the earlier route-renewal estimates above. UX0 is still
**qualifying**, not released. PR320 targets v0.98.0. Public acceptance and UX1
implementation remain blocked on the final exact-source and release gates.

**Implemented and independently checked:** initial Home focus falls back to an
available action; touched mission selection survives cancellation even when keyboard
focus remains on another card; victory Story uses the authored picture owner;
difficulty Restart retains accepted artwork. Historical Journey restoration
distinguishes owned and imported attempts. Controller Missions tests join the real
operation instead of racing an arbitrary five-second delay.

**Route evidence completed:** all 71 current missions have fresh Standard/scout
witnesses under both existing v3/v4 editions: 142 fixed-outcome wins and same-runtime
replays. Four full Solo/Versus host wrappers are still running. The separate 30-route
Team renewal passes 245 full-file host checks; discovery and static-picture cohorts
pass another 4 and 36 respectively. These are modeled host checks, not human balance
or physical-controller certification.

**Presentation closure:** production63 retains the exact production62 runtime and
all 132 existing binary originals. Its 42 metadata successors close the reviewed
Team/equipment contracts. Full production reproduction/readiness passes, as do 153
checks across 13 complete files. Five recipe checks pass; the last recipe check
cannot create its temporary directory because the local disk is full and must run
again on a writable host. The immutable review continuation admits only the exact
reviewed test assertion change and preserves its predecessor.

**Still required before release:**

- Finish the four full 71-mission host wrappers and the four installed-chapter
  cohorts with independently checked current routes and saved-cut prefixes.
- Correct and qualify manual Versus Journey-to-Classic handoff: keep match settings,
  preflight the chosen original, retain both previous boards on failure/cancel and
  preserve Stay/Replace ownership.
- Run all six source gates and ordinary build/production/artifact/browser checks
  on the final committed source; the current hosted run covers an earlier commit.
- Merge through PR320, qualify the exact source, freeze and deploy through the
  existing release owner, then verify ordinary public entry, version/source,
  affected asset bytes and actual play. Only then advance to UX1.

Local source and test output are encountering repeated ENOSPC failures. Approved
duplicate-cache cleanup restored only temporary headroom; unrelated files, source,
history and unique release evidence were preserved. A safety branch
`codex/ux0-disk-checkpoint` protects reviewed local commits and pending source
candidates through GitHub objects without requiring local Git writes. This branch
is **not** a public release or a substitute for PR320 verification. Some candidates
are protected remotely while their tests are still running.

The new whole-route portability comparison uses macOS arm64 Node20.19.5 and Linux
x64 Node20.19.6. All 142 fixed outcomes/replays pass in each environment; 100 raw
checkpoints match exactly and 42 differ only in 292 last-decimal movement/timing
scalars (maximum 7.11e-13). Discrete simulation state agrees. This is bounded
cross-runtime evidence, not proof of browser-engine replay portability.

UX1 through UX6 and the later programme remain unfinished in the order below.
Do not promise a publication deadline while source gates and sustained build
capacity remain unresolved.

## Accepted behavior

- Home has Solo, Couch Versus and Couch Team; Start/Continue/Resume is primary.
  Missions, Collection, Settings and More follow; quick Sound stays visible.
  More contains Workshop and About. Couch defaults permit mode then Start;
  setup and difficulty remain optional. Technical tuning belongs outside normal menus.
- Missions shows the full compatible library grouped by campaign, with the current
  mission highlighted and selection/scroll retained. Cards show number, name and
  visualization: map before completion, approved artwork after. One tap/Confirm
  plays; Download & play uses the same action. Details/full preview is optional and
  never awards completion. Campaign shortcuts scroll rather than silently filter.
  Use two columns on ordinary portrait phones, three on tablets, four to six wide;
  Large text/zoom may reduce columns. Search and filters are optional disclosures.
- Every operation acknowledges immediately, names real preparation/download work
  and exposes retry/cancellation. Old results or attempts remain usable until the
  replacement is ready; stale work cannot launch. Missing required artwork offers
  recovery, not silent substitution. Status announcements do not steal focus.
- A new mission uses a three-second 3–2–1/Go cue, with simulation and timers starting
  at Go. Retry uses a 600 ms ready cue. Reduced effects retains timing without shake,
  flashes or decorative movement. Resume preserves the paused simulation.
- Ordinary life loss and Team downed/rescue mechanics remain unchanged. Terminal
  failure waits for a fresh input on focused Retry, with cause, Change difficulty
  and Missions. No automatic terminal restart. Retry retains accepted visuals/setup.
- Pause uses Resume, Retry, Missions, Help, Settings, quick Sound and Home. Mode switching retains
  departure safeguards. Closing Settings/Help restores its opener; Resume is explicit.
- Results name Next mission/round/campaign or Browse missions. Versus rounds and
  completed matches differ. Campaign endings, rewards and the next destination share
  the result screen. Collection actually exposes completed Journey pictures; View
  picture, recorded Replay and Play again are distinct actions.

## Shared contracts

One active screen owner routes menu arrows/D-pad, Confirm, Back, Details and Pause.
Native editing and Tab remain usable. Grid movement follows rendered rows/columns,
including reflow, without wrapping unrelated edges. All visible player controls
must be reachable. Default focus is Start/Resume, a retained/current mission or the
primary result action. Keep assignment, neutral gates, held-input protection and
explicit disconnect recovery. Mixed inputs remain usable without prompt flicker
or hiding an active touch gesture.

Structured card data carries exact mode/content identity, completion, map preview,
artwork binding and availability. Never parse progress prose or borrow Solo awards
for another mode. Preserve historical receipts and immutable originals. Add a
separate versioned presentation-completion record only where needed, without co-op
session saves. New receipts retain accepted picture bindings; older Journey records
resolve their exact edition. Missing originals show an unavailable/repair state.
Downloadable previews use trusted catalogue metadata. Decode nearby thumbnails,
release offscreen resources, cancel stale work and support missing observer APIs.

Keep the Ukrainian FPV palette, readable fonts, shared frames/brackets/icons and
board aspect ratios. Solo prioritizes target/lives/equipment and labels elapsed vs
remaining time. Versus exposes each target and readable states; match score only
when useful. Team prioritizes coverage or anchors/cores, with both players' Support,
downed and rescue states. Reflow UI and controls instead of cropping maps or shrinking
critical text. Teach drawing/reconnection and later Support/rescue contextually;
successful actions retire hints and Retry does not repeat long introductions.

## Execution board

| Phase | State                        | Independent releases and blocking acceptance                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX0   | PR320 qualifying, not public | Baseline/input: spatial Journey grid, omitted Couch controls, primary boot/mission focus, one menu-key owner; resolve reproduced targeted and mandatory full-suite failures with contract evidence. The reachability audit adds Legacy Versus continuation and Team paused header controls. Qualification also corrects requested Workshop return and prevents automatic optional-Remix entry at a core Journey ending. |
| UX1   | Remaining                    | Compact complete gallery, map/artwork previews, one-action play, selection restoration and Journey Collection rewards; all content sources and separate mode completion pass.                                                                                                                                                                                                                                           |
| UX2   | Remaining                    | Shared Home/lobbies/Pause, remove duplicate entry points and tuning prose, consistent Back/Help/Settings/Sound; direct Start and exact return focus pass.                                                                                                                                                                                                                                                               |
| UX3   | Remaining                    | Objective-led HUD, responsive boards/touch controls, contextual hints; complete playable boards and controls coexist on short landscape and portrait.                                                                                                                                                                                                                                                                   |
| UX4   | Remaining                    | Separate countdown/short Retry, deliberate terminal Retry, named Next and campaign-ending releases; no pre-Go ticks, stale launches, lost results or duplicate awards.                                                                                                                                                                                                                                                  |
| UX5   | Remaining                    | Settings/difficulty, Collection/Records/replay, help and content recovery; complete input/return/loading coverage without authoring or file pickers in ordinary play.                                                                                                                                                                                                                                                   |
| UX6   | Remaining                    | Complete cross-mode player journeys, accessibility, performance and public regression; physical-device, human balance and offline evidence remain separate.                                                                                                                                                                                                                                                             |

UX0 findings and evidence are maintained in the
[feature verification record](player-first-ux0-verification.md).

### Current delivery constraints

PR320 is the v0.98.0 candidate, following the separately owned PR314/v0.97.0.
The publisher alone owns release tags and Pages promotion. Restoring mandatory
tests exposed more baseline failures than the original nine targeted failures:
old host routes use earlier movement tuning, some Team fixtures send a removed
Boost control, and terrain-only snapshots advertise image slots they do not
prepare. These require corrected legal-input fixtures, not relaxed gameplay,
skipped checks or new historical awards. Genuine behavior defects are fixed and
regressed separately from fixture corrections. The original nine are therefore
not a complete qualification estimate.

Do not accept UX0 or begin the next public feature until the corrected complete
suite, exact-source build, immutable artifact and public input checks pass. UX1-A
remains the next feature. Its design preparation below is ready; it is not shipped.

Implemented and verified in scoped UX0 checks: one Solo arrow owner, rendered-row
Journey navigation, retained/current-card focus after reflow, previously omitted
Couch settings/header actions, exact departure cancellation focus, Workshop boot
return, deliberate Browse at Journey endings, and early Team difficulty intent.
These implementation checks do not mark the feature publicly accepted.

Further qualification reproduces an inherited incoming Classic launch race: the
boot picture and requested original can attempt concurrent media-generation
writes. The incoming action now joins its captured boot operation, then retains
all newer-input and foreground guards. A failed unrelated boot picture does not
prevent preparation of the requested exact original. Final Versus Journey results
also receive explicit Browse rather than generic-library fallthrough; an unfinished
first-to-two match must still say Next round, without declaring the Journey finished.
These corrections remain part of PR320 qualification, not a published feature.

Remaining UX0 delivery steps: finish the complete mandatory suite and review any
new failures; integrate the preceding reviewed release if main advances; qualify
the exact final source and ordinary build; freeze and publish through the single
publisher; then verify matching public bytes/version and real input/play. Only
after that moves UX0 to Completed does implementation advance to UX1-A.

### UX1 implementation boundaries

Source preparation identifies why Journey wins announce a picture while Collection
remains empty: the win writes a Journey receipt, deliberately bypasses Legacy
awards, and Collection reads only the Legacy gallery. Preserve that ownership
separation. UX1 has two independently useful releases:

1. **UX1-A: rewards and completed-card artwork together.** Introduce a separate
   versioned presentation-completion record and one exact-art resolver shared by
   Journey Pictures and completed cards. Keep strict historical Journey readers,
   Legacy awards, and mode-specific win admission unchanged. Retain accepted asset
   hashes/revisions and earlier originals. Resolve old receipts only against their
   exact edition/gameplay identity; otherwise show unavailable/earlier edition.
   Actual mode wins, reload, Retry, Next, duplicate outcomes, storage failure,
   missing art and backup/recovery scope must pass before release.
2. **UX1-B: compact complete gallery.** Deliver the agreed campaign grouping and
   responsive cards across Journey, Legacy, installed, downloadable and imported
   sources. Add trusted lightweight preview metadata where missing. Bound thumbnail
   leases near the viewport, release offscreen resources, cancel stale work, and
   provide a no-observer fallback. Complete selection/input/layout checks before
   marking UX1 accepted.

This is read-only preparation while UX0 qualifies, not a claim of implementation
or authority to mix Solo, Versus and Team completion.

Further source review tightens historical recovery: several old Journey editions
share the same profile scope, and simulation identity intentionally excludes art.
A scope/mission/gameplay receipt therefore does not always identify its original.
Use an explicit historical mapping only when it yields one binding; otherwise keep
the clear and show “Earlier edition / original unavailable.” Today's picture must
never be presented as proof of an earlier earned original.

Keep the existing strict Journey receipt reader unchanged. The proposed companion
presentation ledger can live under a separate key in the existing profiles store,
committed in the same transaction as progress. It captures the accepted attempt's
validated original before the terminal write; viewing cannot create a reward.
Exact mode, content, edition, run and asset identities admit idempotent duplicates
and reject conflicting records. Failure must leave session rewards retryable and
exportable without preventing Next. Backup wording must distinguish original
references from included image bytes. These transaction and backup choices require
implementation qualification in UX1-A, not just schema or inventory checks.

An additional browser check at actual 1280×800 confirms rendered row/column movement
and exact Home Missions return focus. It also confirms the current verbose cards
exceed the visible gallery height (about459–479px per card). UX1-B must replace that
layout with compact cards; the keyboard check does not accept its present geometry
as the finished handheld design.

Previously delivered foundations remain: default Journey, unified library,
continuous Next, shared assets/settings, backup safeguards and scoped Team/recovery
work. Their existence does not close the failures above or whole-game qualification.

After UX0–UX6: complete map/artwork parity, full themes/Studio, campaign offline
preparation, backup/history recovery, audio/encounter qualification, community
campaign production, supporting tools and community guide. Do not start bulk new
art or missions while primary flows remain unreliable. Preserve existing content.
Online/Deathmatch, full Ukrainian translation, hosted administration and persistent
co-op sessions remain deferred.

## Verification and delivery

Maintain normal/loading/empty/locked/failure/paused/completed screen coverage.
Distinguish source, automated, browser, visual and physical-device evidence.
Exercise fresh Start/capture/life loss/terminal Retry/win/picture/Collection/Next;
cross-campaign gallery return; saved Continue/Settings/cancel departure; Versus
round/match endings; Team Support/downed/rescue/recovery/Next; failed/cancelled
download and exact-art recovery; controller disconnect/held Confirm/rotation/
backgrounding during preparation, countdown and Pause.

Measure actual CSS viewports/zoom: desktop/tablet, 1280×800, portrait and short
landscape. Require 44 px touch targets, readable EN/UA, Large/Plain text, meaningful
200% zoom, reduced motion and stable focus. Compare thumbnail memory and frame
time to baseline. Browser clicks and modeled pads are not hardware certification.

Cross-runtime replay portability is a separate open compatibility check. UX0's
hosted Linux probe found last-decimal movement differences against macOS/arm64 in
five existing routes; discrete board state and outcomes agree. Reviewed differences
are bounded movement scalars and, for one route, terminal elapsed time.
Exact historical replay checksums remain unchanged. A portable test expectation
does not prove that recordings transfer between browser engines or architectures.
UX5/UX6 must exercise that transfer and preserve recoverable originals on rejection;
any simulation or replay-format remedy requires its own versioned compatibility
work and release evidence.

For every feature: implement → review → test/fix → explicit staging and synchronized
version → PR checks/merge → exact-source qualification → immutable freeze → Pages →
public version/source/byte and actual-play verification. Run `npm test`, lint,
format:check, format:native:check, validate and motion-lab syntax, plus applicable
production/build/artifact/browser checks. Update this board, guidance and prompts.
A merged PR or inventory pass alone is not a delivered feature. Record the URL,
version, source, publication, evidence limits, remaining defects and next item.

## Research basis

Xposed screenshots inform composition/focus/feedback, not inferred timing or rules.
Use [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112),
[Steam handheld/controller guidance](https://partner.steamgames.com/doc/steamhardware/recommendations),
[Dead Cells accessibility treatments](https://deadcells.com/patchnotes/29),
[interactive tutorials](https://gameaccessibilityguidelines.com/include-interactive-tutorials/)
and [status semantics](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
These are design sources, not platform certification.
