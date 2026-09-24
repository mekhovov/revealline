# Reveal Line: player-first UX execution

Approved 24 September 2026. This replaces the execution order in the older
whole-game plans; it does not erase their content, compatibility or qualification
requirements. Each independent feature is released before the next is accepted.

## Release checkpoint

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

The root working directory contains unrelated historical and unfinished work.
Implementation uses an isolated source worktree and explicit staged paths. The
existing publisher retains tags, archives and Pages ownership. Skipped tests under
the historical repository waiver are not passes: UX0 restores the source policy
to `required` and qualification also explicitly requests `run_tests=true`.

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
- Pause uses Resume, Retry, Missions, Help, Settings and Home. Mode switching retains
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
