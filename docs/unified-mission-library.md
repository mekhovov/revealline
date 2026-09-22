# Unified mission library — Release B

Local implementation began on 22 September 2026 from Release A candidate
`70836db6ac7559791ef61ecfbf31c0785604ffc0`, in `codex/unified-mission-library`.
The user approved concurrent local development while A is promoted. B promotion,
not B implementation, waits for A's public acceptance. The sole publisher retains
merge/tag/Pages ownership; A receives only blocking fixes. Before B qualification,
reconcile its base with the accepted A commit and rerun affected checks.

## Scope and sequence

1. Shared provenance-qualified browsing model and lightweight retained index.
2. Extend the existing selector with All/Journey/Classic/Custom, campaign and mode
   filters, textual tags, readiness, search and return-state preservation.
3. Mount it in Solo, Versus and Team Journey and Classic hosts; use their existing
   validated launch/preparation paths. Direct handoffs select the exact mission.
4. Wire download/cancel/retry without losing filters, selection or the old attempt.
5. Verify catalogue reconciliation, custom ownership, original Next sequences,
   empty-profile late Classic access, input navigation and lazy browsing.
6. Review, version, PR, merged-source qualification, immutable release, Pages and
   repeat affected journeys publicly. No completion claim at merge alone.

All retained levels stay. Classic uses its actual rules, not invented Journey
bands. A metadata row grants neither runtime ownership nor a clear. The browser
does not define progression: each content owner retains its original sequence.
Exact official installations update readiness; modified imports remain Custom.
Player settings, installed packs, uploaded media and Studio projects are retained.

## Acceptance inventory

The retained Classic catalogue has 110 missions: Base 12, active packs 23,
archived packs 12, optional embedded chapters 15, trusted external chapters 48.
The current Solo/Versus Journey has 91 missions. Team has 12 current missions
plus two legacy arenas; difficulty variants are not extra missions. Nine Classic
Lab practice demonstrations remain separately accounted for. Custom content is
device-specific and must not be deduplicated by names or map geometry.

## Delivery and evidence

The earlier 7–11-hour B estimate is a target from implementation start, not a
guarantee or permission to skip gates. Report implementation, local verification,
CI, release and public verification separately. Heavy release jobs remain
serialized; bounded local tests can run concurrently. Do not introduce new enemy
systems, artwork, music, balance changes or unrelated recovery work into B.

Current state: implementation in progress; no B release or public acceptance yet.
The checkpoint sections below are historical; the latest Solo integration section
supersedes earlier statements that the selector is not mounted.

### First local checkpoint

- Implemented shared provenance registry, Journey and Classic metadata adapters,
  and the extended selector surface with collection/campaign/mode filters,
  textual tags, inline preparation/cancel/retry and return-state restoration.
- Generated and reconciled all110 Classic rows: 169,581 bytes, no artwork or
  collision geometry. Build verification reuses accepted external distribution
  bodies and rejects stale or changed metadata.
- Local Node20 checks: 31 registry/adapter/chooser and prior-chooser regressions
  pass; seven independent full-source index/determinism/tamper checks pass.
- Corrected a focus-restoration gap found by the first DOM test run; all eight
  original chooser cases pass. Independent review additionally found and corrected
  focus after exact owner replacement, stale reentrant readiness/launch ownership,
  and Solo preparation state leaking into otherwise-ready Versus. Dedicated
  regressions cover each. This is modeled DOM evidence, not native hardware.
- Local distribution assembly passed with1060 files, including the source-checked
  lightweight index. It was a moving development checkout with sourceRevision
  null and inherited A version0.83.0, not an immutable B release. Final source
  qualification and the B version bump remain required after host integration.
- Still required: actual Solo/Versus/Team host adapters, installed Custom sources,
  exact launch handoffs, native/browser verification, final version and release.
  The new selector is not enabled in gameplay hosts yet. No public UI change is
  claimed by this checkpoint.

### Parallel integration checkpoint

- Added fixed same-game Solo/Versus/Team mission handoff URLs. Requests retain the
  release prefix, carry an opaque exact display identity, and reject malformed or
  duplicate intent. They grant no installation or runtime authority.
- Added release-independent, per-host session storage for selector search, filters,
  focus and scroll, with an in-memory fallback when storage fails.
- Fixed a reviewed asynchronous status leak: a download completing after a mode,
  campaign or search change no longer overwrites the new view's status.
- All39 fast registry, chooser, adapter, handoff and existing-chooser checks pass.
  Host mounting, exact receiving-host lookup and public acceptance remain pending.

### Exact targets and installed editions

- Solo's guarded chapter launcher now accepts an exact campaign, mission and
  revision. Explicit selections cannot silently become the first or remembered
  mission, and late selections are not clamped to earned unlocks. Omitted targets
  preserve existing chapter Continue behavior. This is launch-path support; the
  unified selector is still not mounted in gameplay hosts.
- Added Custom adapters preserving original installed pack, entry and level
  references, host-declared mode support, authored order and actual rule text.
  Only positively verified originals are excluded from Custom. Names and matching
  IDs do not combine editions.
- Added full prepared-pack canonical SHA-256/byte identities to the trusted index
  and a shared immutable-object verification cache. This distinguishes modified
  artwork editions without fetching every official pack or decoding its pictures.
  Managed original-picture readiness remains a separate host check. The110-row
  index is now183,555 bytes.
- Local verification:56 fast tests, all16 existing Solo chapter-launch host
  regressions, and eight full-source index/determinism/tamper/pack-identity tests
  pass (seven index cases plus the separate all-prepared-pack case). Independent
  read-only review found no blocker in this slice and repeated21 helper/adapter
  cases plus two actual Solo host regressions. These are finite test boundaries,
  not native/controller/public verification.

Next: mount the library in Solo Journey and Classic hosts, resolve incoming opaque
selection through the exact registered owner, wire preparation/readiness and
device Custom content, then repeat for Versus and Team. Retain atomic artwork
adoption, replacement/departure guards and each owner's separate Next sequence.

Independent integration review additionally identified mutable resolved Custom
entry clones as a host-wiring risk. Bindings now carry immutable scalar selection
snapshots from the prepared original. Launch checks the exact current binding;
preparation checks before and after awaiting, and registration rechecks after
official verification. Original references are retained without freezing caller
objects. Hosts must use the immutable selection after asynchronous work and
re-resolve the prepared owner. Four added regressions pass; the fast cohort is
now60 tests. The prior16 Solo host and8 full-index cases remain unchanged.

### Solo integration checkpoint

- Mounted the same lazy library in Solo Journey and Classic hosts: all91 current
  Journey missions plus all110 retained Classic metadata rows, with installed
  Custom editions added without deduplication by name. Ordinary Continue does not
  compile the browsing library or fetch every optional pack.
- Added exact incoming/outgoing owner handoffs and trusted Base launches. Late
  Classic and second-campaign Custom choices are selectable on an empty profile;
  no clears or mastery are invented. Existing runtime preparation, replacement,
  artwork adoption and separate progression remain the launch authority.
- Wired bundled/archive and optional chapter preparation into inline Download →
  Play. Original-picture chapters retain separate managed-media readiness checks
  on launch; browsing does not decode every original.
- Independent review found and fixed late-menu revival after blur/history-cache
  departure, stale failed-launch focus restoration, and loss of the original
  Back destination after Stay. Added actual-host and shared-chooser regressions.
- Updated pre-existing host fixtures to enter the briefing through actual Brief
  controls; they no longer invoke the removed synchronous mission-menu flow.
- Current focused registry/adapter/chooser cohort:76 tests pass. A clean combined
  Solo host run passes53 tests; retained Legacy replacement callbacks pass25.
  The latter explicitly mount their historical parent at the finite DOM boundary;
  the53-test run covers actual unified menu routes. These are finite
  DOM/storage/image boundaries, not browser layout, physical-controller, release
  or public verification.

### Current implementation and remaining B work

Updated after the native input repairs and catalogue qualification. “Pushed” means implemented and locally verified in
draft PR268, **not released or publicly accepted**. Earlier checkpoint prose below
records the evidence at that time, not the current remaining list.

| Work                                                                          | Current state                                                                   | Remaining effort estimate                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| Shared registry, trusted110-mission index, tags and exact owner identity      | Pushed; final33-case reconciliation passes all110 retained identities           | Repeat against frozen release                      |
| Solo host, native setup, exact launches and authored Next                     | Pushed;42 affected Solo cases pass; native exact launch and return pass         | Combined affected/full release gates               |
| Versus host and supported Classic/Custom/optional launches                    | Pushed;20 existing +16 new local cases pass; native installed handoff/Stay pass | Frozen download/readiness qualification            |
| Team host,12 Journey +2 Classic +visit-local Custom                           | Pushed;153 tests passed together                                                | Cross-mode/native work below                       |
| Solo↔Versus Journey modes without duplicate identities                       | Pushed;7 adapter +32 actual-host cases passed                                   | Cross-mode public verification                     |
| Team↔Solo/Versus catalogue and exact handoffs                                | Pushed; pinned native source-return and saved-flight round trips pass           | Final downloaded/Custom cross-mode qualification   |
| Trusted bundled/archive Versus downloads                                      | Implemented;53 installer +actual-host tests pass together                       | Native/public verification                         |
| Paired-original downloads/readiness across hosts                              | Implemented; real optional/paired remote5-case recovery cohort passes           | Release-aware native/public verification           |
| Installed Custom metadata/readiness without eager artwork decoding            | Team and Versus integrations reviewed; local host regressions pass              | Native qualification and failure-matrix completion |
| Compact library and selector return                                           | Final nativec9ea focused-card/typing/compact gates pass; modeled pads8/8        | Frozen repeat and physical-device limits           |
| Full navigation, failure, storage and accessibility/performance qualification | Combined mission-library cohort301/301 passes; lint/format/source validation pass | 2–4h plus device availability                      |
| Release B promotion                                                           | Waits only for accepted A and B technical gates; local work continues           | 2–4h after qualification, CI/Pages queues variable |

Estimates are remaining engineering ranges, not guaranteed release times or
permission to skip gates. Parallel work overlaps; provisional B delivery range is
6–12h from this checkpoint, with external media and CI the main risks. Publish
actual delivery and remaining gates after each release. One publisher retains
main/tag/Pages ownership; implementation stays isolated from A and the dirty tree.

Additional compatibility gates: audit retained setup/appearance entry points now
that Missions opens the unified library, without adding a second mission browser.
The earlier immediate-Next receipt fixture gate is closed: the corrected
named-database boundary and actual async supersession test pass together17/17.
Post-adoption Next retires its automatic-start intent when a lazy Missions
opening wins. Keep these cases in final whole-branch qualification; this bounded
pass is not a substitute for the complete release suite.

### Solo review follow-up: opening intent and truthful card text

- Solo integration was pushed as `5db40f88e` to draft PR268. Independent native
  browser review of that pinned commit confirmed201 cards, fresh-profile late
  Classic launch, exact brief, saved-flight departure/Stay and chooser return.
  This is local browser evidence, not Pages or physical-controller acceptance.
- Fixed a further reviewed cold-opening race: newer focus, keyboard, pointer or
  click retires the pending request even when focus later returns to the same
  opener. Initiating events are allowed to finish first. Preparing missions is
  visible beside the opener; cancellation removes it, and failure offers retry.
- Restored text-only Journey band/preset, route decision and optional challenge
  without constructing every board or decoding artwork. Curated original IDs
  identify12 Remixes,4 Ukrainian-inspired and4 FPV workshop missions. Current
  arcade-policy missions carry an Arcade tag. Classic cards explicitly label
  authored Standard rules and list actual mode-supported difficulty settings.
- Focused cohort:82 tests pass. Five actual held-index lifecycle/input tests and
  ten Solo launch tests pass; shared text refresh preserves focused cards.
- Versus and Team integration are progressing in separate owned files. Their
  partial checks do not establish all-mode or release acceptance. Retained setup
  access, full sequence/failure qualification and promotion gates remain open.

### Parallel host review checkpoint

- Independent native browser verification of pinned `297e0318d` passed the held
  index/newer-focus case: no late dialog or focus steal, with immediate loading
  feedback and a successful fresh request. This remains local, not public proof.
- Solo's existing native setup controls now live in a collapsed, bounded section
  of the unified library. Pack/level/campaign selectors are hidden there; the
  shared cards remain the only mission picker. Difficulty, steering and appearance
  retain their existing handlers. Appearance opens this section after the owned
  asynchronous opening, not before it.29 chooser/Solo host tests pass.
- Team regression migration exposed stale detached-card activation. Shared
  admission now requires a current visible card, exact registered owner, open
  foreground dialog and supported mode. Filtered, closed and background cards
  cannot start a download or mission; the new regression passes.
- Versus implementation is in independent review. Review reproduced missing
  incoming-handoff focus retirement and missing Journey replacement confirmation;
  both are being repaired before that slice is committed. Team host and existing
  fixture qualification continue in parallel.
- Solo review also identified late Classic/Custom Next jumping to the first
  uncleared mission instead of its authored successor, and a similar incoming
  handoff focus race. These remain open until repaired and tested.
- Release A qualification is running separately. Release B is not promoted,
  versioned or publicly accepted; known download/cross-mode, full regression,
  accessibility/layout and public verification gates still apply.

### Versus integration checkpoint

- Mounted the shared tagged library in Journey and Classic Versus, with exact
  Base, verified installed Classic and modified Custom targets. Existing paired
  boards, series settings and staged artwork replacement remain runtime-owned.
- Optional chapter download/failure/retry/cancel remains inline; successful
  preparation requires a separate Play. Stay preserves both boards and their
  accepted picture. Opaque owner handoffs preserve the frozen-release URL prefix.
- Independent review reproduced three defects before checkpoint: incoming
  metadata overriding newer input, Journey replacement bypassing Stay, and a
  failed unused opener picture losing the requested mission. Repaired all three;
  regression tests cover the exact target, retained boards and focus ownership.
- A74-test bounded cohort passed before the final earlier-input regression was
  added. Root then repeated all16 actual-library host cases plus the exact
  manifest authority test:17/17 pass. Earlier Solo/Versus ending sequence4/4
  passed. These are modeled host tests, not public/hardware acceptance.
- Still incomplete: trusted bundled/archive and paired-original download
  adapters, cross-mode Journey inventory, eliminating repeated installed-art
  validation on browsing, full/native qualification and public deployment.

Native review additionally found a compact-layout blocker: filters/footer leave
too little card viewport on narrow or short screens. A dedicated shared-selector
responsive pass is in progress alongside Team regressions and Solo sequence
verification. It must receive a new pinned native check before acceptance.

### Solo authored sequence and incoming intent checkpoint

- Classic/Custom Next now follows the exact current campaign's authored successor,
  not its first uncleared mission. The last mission ends that sequence without
  wrapping. The endpoint says “End of this campaign” when earlier missions remain
  uncleared; it does not falsely award or announce a full campaign clear.
- Added an actual-host Custom regression: select the penultimate mission on an
  empty profile, clear it through legal movement, Next to the last, clear it and
  return to the same filtered library. Only those two clears are stored.
- Incoming Solo metadata preparation now retires on newer focus/key/pointer input,
  and a failed stale launch cannot reopen the library.27 helper and actual Solo
  host/lifecycle tests pass in one clean combined run.
- The broader retained result-continuation cohort is16/17: a repeatable ordered
  fixture case enters session-only storage recovery and omits the expected saved
  picture receipt. It is under investigation with assertions preserved. This is
  an open qualification gate, not a clean full-suite claim.

### Compact library checkpoint

- At narrow/short viewports, Search stays visible and Collection/Campaign/Mode
  share an optional native Filters disclosure on the same screen. Active filters
  remain indicated. Resizing preserves values and moves focus out of a collapsing
  control rather than leaving it hidden.
- Compact cards retain mission, campaign, edition, textual tags, actual rules and
  availability. Detailed route/mastery/diagrams are optional; hidden diagrams are
  not constructed.44px controls and a minimum card viewport are retained.
  -20 shared chooser/compact tests and3 targeted existing Solo setup tests pass.
  Pinned native phone/landscape remeasurement remains mandatory; CSS assertions
  alone do not prove the reported82px viewport defect is resolved.

### Team integration checkpoint

- Mounted the shared selector in current and retained Team hosts with12 Journey
  missions,2 Classic arenas and exact visit-local Custom imports. Same-ID imports
  retain distinct generation-owned identities; incoming selections open the
  requested mission and start only after its owned picture is ready.
- Retained the atomic Team preparation/Stay/Replace path and separate concealed
  picture preview. Browsing does not decode every original; preview is explicit,
  cancels independently and cannot enter from a background page.
- Root review found stale preparation cleanup could hide a newer Cancel control
  or detach its input lease. Cleanup is now exact-owner scoped; the regression
  holds old Play, cancels it, starts a new Play, settles the old work, then verifies
  the new Cancel and input retirement remain effective.
- All15 Team test files pass together:153 tests, zero failures/skips,203 seconds.
  This includes13 existing host suites migrated to actual asynchronous shared UI,
  two new source/host suites,12 command-earned Journey clears, imported originals,
  historical pressure/timed routes, rollback, exact incoming Expert and preview.
  Scoped lint/format/whitespace checks pass. Native/public evidence is separate.
- Cross-mode library registration and final layout/release acceptance remain
  incomplete; this checkpoint does not claim all Release B gates are closed.

### Solo/Versus cross-mode catalogue checkpoint

- Both hosts now expose the91 Journey identities in both supported mode filters,
  alongside110 Classic entries, without duplicating missions or changing opaque
  display IDs. Each mode compiles through its existing validator and delegates
  launch/card/details/progress to that mode's original owner objects.
- The combining adapter rejects conflicting metadata, forged bindings and
  unsupported modes. It creates no runs, downloads no images and owns no Next
  sequence.7 adapter tests and32 actual Solo/Versus host cases pass together in
  their respective clean runs; independent review found no further issue.
- The actual authored-opening supersession test caught a theme mismatch in the
  initial cross-mode integration. Both hosts now use the same raw-versus-actor
  theme selection as their normal runtime. The corrected test passes with late
  decoded-image disposal and exact accepted run/picture/focus assertions.
- Team↔Solo/Versus catalogue registration, trusted retained downloads and native
  final qualification are still separate remaining gates.

### Result-transition fixture correction

- Traced the missing receipt to a finite test database boundary: the fixture used
  one database implementation for named asset and Journey databases. Lazy Journey
  browsing from a Classic host exposed that collision as “Unknown store” recovery.
  The fixture now isolates the named Journey database in every case and asserts
  writable startup. Runtime save behavior and receipt-count assertions are not
  relaxed.
- Replaced an obsolete synchronous/retired-chooser fixture with a separate actual
  authored-opening test that awaits the unified UI, supersedes held Next artwork,
  settles and releases the stale decoder, and preserves the new run and picture.
- The final combined result-continuation cohort passes17/17, zero failures/skips
  in185.5 seconds, including the actual authored supersession case. This closes
  the earlier16/17 fixture gate without weakening receipt assertions.

### Short-landscape follow-up

- Native `5e73511a4` recheck verified the portrait improvement:470px mission area,
  three complete compact rows, usable Filters and keyboard selection. Landscape
  still overflowed because shared Field Kit styles added panel margins/padding
  to both native details controls.
- Added compact-specific spacing overrides while preserving44px targets. In short
  landscape, expanded Solo setup fields scroll above the stable footer rather
  than pushing Back below the viewport.22 chooser/compact and3 Solo setup tests
  pass. Pinned native `45c56271d` recheck passes the reported defects:844×390 has
  a208px card viewport,44px footer and no dialog overflow;390×844 has612px cards
  closed and335px with setup open. All setup/filter controls remain keyboard
  reachable and visible. Escape/Home/Missions restores exact focus. This is a
  bounded native-layout gate, not whole-release public/device qualification.

### Solo/Versus to Team browsing checkpoint

- Both hosts expose the same12 Journey and2 Classic Team identities as the
  receiving Team host. Mode filtering remains in the shared selector; departure
  opens the exact selected mission through the existing guarded handoff.
- No remote Team run or background decoder is created. Independent review and
  the identity test plus four actual-host handoffs pass5/5. Remote progress is
  left blank rather than inventing clears.
- Team to Solo/Versus, retained downloads and installed metadata readiness are
  still separate gates. Release A source CI has passed11,788 tests; its public
  acceptance remains pending. Release B remains a draft preparation branch.

### Trusted retained-chapter downloads in Versus

- Bundled and archived cards now use the trusted release index directly; no
  Optional-catalogue schema bypass or manual trip to Solo is required.
- Downloads enforce fixed same-release paths, published byte counts/checksums,
  full normalized pack identities and complete mission membership. Installation
  rechecks storage under the writer lease, rejects modified same-ID editions and
  preserves existing atomic publication and cancellation semantics.
- Independent review repeated33 installer cases, including actual bundled
  Night Shift and11.7MB archived FPV Arcade data. The final installer plus actual
  Versus host cohort passes53/53 in74 seconds, zero failures/skips.
- Actual host tests exercise HTTP failure, Retry, held download Cancel, successful
  Download→Play without automatic launch, unchanged search/boards/picture, Stay
  and explicit replacement into the exact late mission on both boards.
- Paired-original media preparation and lazy installed inventory remain separate
  gates. This checkpoint is not a release or public qualification claim.

### Metadata-only installed-content foundation

- Added validated pack-library inspection that runs the existing schema,
  dependencies, budgets, image-header and mastery normalization checks without
  decoding artwork. Its private, immutable browsing projection retains exact
  campaign/class restrictions and full artwork-inclusive edition fingerprints.
- Metadata never enters prepared-runtime ownership. A separate Custom adapter
  preserves the existing display IDs and authored ordering, delegates readiness
  explicitly and rejects stale/forged selections. Host launch must still confirm
  storage and genuinely prepare the exact pack before runtime adoption.
- Review caught stale progress throwing during an Unavailable-card render;
  stale progress now stays blank and does not call the retired host callback.
- The pack-inspection cohort passes42/42; the final metadata-source, inspection,
  existing pack and Custom-source cohort passes37/37. These overlap, not79 unique
  tests. Host adoption and read-only inventory integration are still pending.

### Team remote catalogue and browsing recovery

- Team's same-screen Solo/Versus filters now expose91 Journey and110 retained
  Classic identities. Journey and Base are verified for direct exact handoff;
  the other98 entries explicitly remain Unavailable until installation/media
  readiness is integrated. They are not falsely reported missing or ready.
- Independent review reproduced an interrupted-load/reopen dead end. New input,
  blur and reopening now retain a deliberate Retry path and can reuse completed
  metadata without a duplicate fetch or replacing the current Team attempt.
- Status feedback shares the existing bounded status row, not the action footer;
  Team preview hides in other modes. Current Team edition labels are player-facing
  and retain exact opaque IDs and chapter titles.
  -49 Team cases,22 shared chooser/compact cases and3 Team-source cases pass in
  bounded cohorts. New pinned native Team compact verification is still required.
- Native cross-mode checking separately found lost return-route context and a
  saved-difficulty mismatch in Legacy remote cards. Their fixes are in progress;
  successful exact forward handoffs alone do not close the round-trip gate.

### Read-only installed inventory checkpoint

- Added an exact-channel inventory reader using the existing no-upgrade asset
  reader. Absent databases remain absent; no schema, media, profile or artwork
  writes occur. Pointer/index/journal data is read atomically under the existing
  recovery lock, with exact raw-snapshot hashing and owner-bound confirmation.
- Backup markers, active journals, malformed storage, unsupported schemas and
  unavailable locks fail closed without deleting data. Stored null journal
  tombstones remain valid cleared states. Cancellation/close and stalled lock
  acquisition are bounded; a later snapshot cannot impersonate an earlier owner.
- The reader plus existing no-upgrade assets, external installation and host
  regressions passes70/70, zero skipped/failures; final focused22-case rerun also
  passes. Publisher behavior remains unchanged. Host adoption/native evidence
  are pending, so this does not yet close lazy browsing across gameplay hosts.

### Metadata-backed registry checkpoint

- Added a sibling installed registry for inspected metadata, leaving the existing
  prepared-runtime registry contract intact. Exact Classic rows survive refresh
  and Download→Play; modified editions remain separate Custom sources. Runtime
  preparation and original-picture readiness remain explicit host responsibilities.
- It passes metadata-only bindings and immutable targets, never a prepared pack.
  Review hardened the callback boundary to strip leftover caller `pack` fields;
  stale snapshots cannot register or launch replacement content.
  -26 source/factory and existing prepared-registry tests pass together, including
  edition changes, exact late selection, stable download cards and no autolaunch.
  This is the final browsing-layer foundation; gameplay-host adoption is next.

### Native download follow-up

- Pinned native `8633d0256` verifies an exact Night Shift late mission through
  controlled HTTP503, focused Retry, held-download Cancel, unchanged race,
  preserved search/focus, successful Download→Play and exact launch on both
  boards. Evidence is local source-pinned, not public release acceptance.
- Native review noticed135s authored map timing alongside the90s race clock.
  These are independent clocks, not an altered map rule. Classic Versus cards
  now explicitly say a separate race timer also applies; Solo wording stays
  unchanged.35 relevant source/chooser/metadata-registry tests pass together.

### Installed inventory lifecycle checkpoint

- Composed the read-only snapshot and metadata validator with a bounded cache,
  exact private snapshot bindings and per-action generations. Confirmations run
  before and after genuine preparation; retired results must release resources.
- A failed refresh marks installed content unknown, not absent. Hosts must keep
  stale cards visibly Unavailable, explain the error and veto misleading downloads
  while leaving Base/Journey browsing available. Existing stored data is kept.
  -56 combined controller/storage/metadata tests pass, including stale same-hash
  generations, overlapping reads, cleanup failure and explicit download veto.
  This controller performs no downloads or decoding; host integration follows
  the separately reviewed return-route checkpoint.

### Exact materialization and native qualification update

- Added deliberate-Play materialization that accepts only an inspected inventory
  member, calls genuine host inspection and compares the complete prepared-pack
  fingerprint before returning a runtime owner. Missing/modified/raw lookalikes,
  decoding failures and storage changes cannot substitute another edition.
- Independent review repeats16 controller/materializer tests successfully.
  Full retained-index, prepared-identity and metadata inspection reconciliation
  also passes20/20 in109 seconds after the metadata refactor.
- Native `dbbcee8fe` Team compact checks pass844×390 and390×844 with readable
  cards,44px targets, visible footer and bounded remote loading feedback.
- Native Team→Solo exposed a blocking incoming-start focus race: the correct
  late-mission URL can remain at the opener. Browser Back also retained search
  while resetting the mode filter. Both are tracked in the active integration
  fixes; these native failures prevent Release B acceptance despite helper tests.

### Paired-original installation service checkpoint

- Added explicit paired-original installation/readiness using code-owned release
  descriptors and the existing recoverable journaled media transaction. The
  indexed gameplay file and original-picture bundle are verified together;
  compact JSON alone cannot become a playable original edition.
- Exact reuse avoids rewriting installed content. Modified uploads, corrupt
  originals, pending recovery and retained-picture conflicts fail closed. Any
  retained-picture review must come from the existing explicit consent workflow.
- A settled installation whose final readiness check is interrupted reports
  committed-but-unconfirmed, never a fictitious rollback. Readiness evidence is
  transient data; launch must still perform its normal staged owner checks.
- Final paired/embedded/indexed installer cohort passes41/41 in46.3 seconds,
  using actual trusted source payloads with modeled browser/transaction boundaries.
  Source review found no blocker. Inline host adoption and native/public tests
  remain required before paired-download functionality is marked complete.

### Cross-mode return and incoming-focus repair candidate

- Exact handoffs now carry finite source-mode/edition navigation separately from
  their selected destination identity. Checked Legacy Solo return tokens retain
  priority; malformed/duplicate hints cannot nominate arbitrary destinations.
- Legacy remote cards use read-only saved Journey presets and refresh on storage
  changes. Returning late Classic selections no longer applies obsolete unlock
  gates or invents clears. Existing optional mode controls remain in the same
  collapsed Solo setup scroll panel, not an extra selector.
- Checked Solo returns await the real unified selector. Native-inert startup
  testing reproduced the Team→Solo failure: final boot focus retired the pending
  incoming launch. Awaiting that owned launch fixes the race without relaxing
  genuine new-input, hidden-page or exact-owner guards.
  -38 combined return/handoff/Solo-lifecycle cases pass with zero skips; two
  additional Team→Versus incoming cases pass. The full68 checked-return cases
  passed before the final incoming-await-only fix. Team's15 return cases,8 remote
  cases and48 prior navigation/route cases passed in bounded cohorts.
- This is a pinned native-retest candidate, not accepted Release B. Source-route,
  saved-preset and exact incoming launch must now be repeated in the browser.

### Saved selector restoration checkpoint

- Host-scoped selector state now preserves a valid other-mode filter across page
  returns. Remote campaign selection waits for its exact metadata option; new
  input retires pending restoration rather than unexpectedly narrowing a new query.
- An untouched lazy return restores its exact card and scroll once. New input,
  focus changes, hiding, closing or direct mission reveal cancel that restoration.
  Exact incoming selections override stale filters without selecting another mission.
- Initial four-file cohort passed56 tests. Review added a reproduced pending-search
  regression and visible-campaign preservation check; the final focused chooser,
  compact and handoff cohort passes47 tests. Team's11 return cases passed before
  that final one-line search correction. Native return/focus verification remains.
- Pinned native `c073fdabe` now opens Team→Solo Two keepers directly and after
  reload, with its exact mission brief and60% target. This is local evidence,
  not Pages acceptance. Release A merged-source qualification remains in progress;
  Release B stays draft, with no version bump, merge, tag or deployment.
- Independent root repeat passes63 shared selector/controller/materializer cases.
  Native `c073fdabe` also preserves the Classic Relay Storm saved flight across
  Team Twin landings and checked return, and preserves Journey return intent.
- Native `1cbb1bd1f` confirms Team→Solo→browser Back→Team chooser restores Solo,
  Prologue, Two keepers search and exact card focus in844×390 and390×844.
  Escape restores the Browse opener. Held-request/newer-input behavior has
  automated coverage but is not claimed as native or physical-controller evidence.

### Team installed inventory and inline preparation checkpoint

- Team's same selector now lists checked installed Solo/Versus Classic and Custom
  editions using read-only metadata; explicit trusted downloads remain inline.
  The receiving gameplay host still owns genuine runtime/image preparation.
- Exact storage is checked again after the player's Stay/Replace decision before
  leaving Team. Failed reads retain stale unavailable Custom cards and block
  invented downloads; delayed refreshes cannot overwrite newer readiness.
- Reopening refreshes installed state. Interrupted later refreshes offer truthful
  Retry, never publish late owners over newer input, and require deliberate retry.
  Gameplay without paired originals remains unavailable rather than falsely ready.
- Independent final adapter/actual-Team repeat passes11/11. The preceding combined
  cohort passed23 cases; final affected host run passed14 runtime cases, with its
  CSS grouping assertion then updated and independently passing. Scoped lint,
  formatting and whitespace checks pass. Native installed/download journeys,
  successful optional/paired preparation and public verification remain gates.

### Versus installed inventory and paired-original checkpoint

- Versus library browsing now reads exact installed metadata without decoding
  artwork. Explicit Play materializes a genuine prepared pack under inventory
  and input guards before the existing staged two-board replacement flow.
- Paired-original downloads stay inline and require separate Play. Installed
  pairs use explicit readiness checking; no metadata projection grants picture
  authority. Incoming exact paired selections prepare only under their owned input.
- Independent review reproduced a stale Custom departure while Replace was open.
  The fix confirms storage again after that decision under a fresh input lease;
  the same reproduction now passes. Blur also cancels incoming paired preparation.
- Existing Versus host cohort passes20/20; new inventory/paired host, compact and
  exact-key storage cases pass16/16. Scoped lint/format/diff checks pass. Inventory
  warnings share the existing bounded status row; native layout, persistent-IDB
  journeys, whole-branch qualification and public acceptance remain outstanding.

### Fresh-storage Retry repair

- Native Team `9398dc15e` exposed a missing case: the first failed download could
  initialize a previously absent database, invalidating the old absence snapshot.
  Retry then stopped before another network request. Seeded fixtures had masked it.
- Each deliberate Team preparation now obtains a fresh checked inventory before
  the exact installer runs. No absent/initialized snapshot equivalence is invented.
  The genuinely absent-database503→Retry→same-card Play regression passes, and
  intervening modified same-ID content still rejects without overwrite/download.
- Final remote-installed cohort passes9/9. Native repair recheck remains required.
  Independent Versus modeled-host verification passes the analogous cold503 path
  without a runtime change. A separate missing-storage/Web-Locks core-browsing
  regression is under repair; installed-content failures must not block Journey.

### Degraded-storage core fallback and download verification

- Versus now constructs its strict inventory reader inside the controller's
  checked refresh boundary. Missing recovery storage or Web Locks is a truthful
  installed-content warning, not a failure of the core Journey/Base selector.
  Unknown storage remains unavailable; no checked-empty fallback is manufactured.
- Root's unchanged return-intent suite plus four new degraded-capability host
  cases passes25/25. The separately completed affected Solo host, lifecycle and
  result-continuation cohort passes42/42. Earlier failing return assertions were
  preserved and now pass after the production fix, not relaxed fixture defaults.
- Real optional/paired remote download and recovery verification passes5/5,
  covering proof expiry, Play-time corruption, cancellation and committed-but-
  unconfirmed installation. Browser and public qualification remain separate.
- Native `50eb4f8c3` confirms genuinely fresh Team browse→503→Retry(second
  request)→Cancel→retry(third request)→same focused Play→exact Solo Voltage Garden.
  No late adoption or automatic launch occurred. Its exact brief,62% target,
  three lives and135-second authored timer are confirmed. This supersedes the
  recorded `9398dc15e` cold Retry failure for this bounded native journey.

### Controller-accessible search recovery

- Added an ordinary44px Clear search action beside the search field. A controller
  can now recover a persisted no-match query without typing or opening another
  menu. Other filters remain selected; the cleared state persists on reopen.
- Clear uses the same input invalidation path as typing and restores a visible
  card or reachable Filters control. Closed/background clicks, late preparation
  feedback and newer focus cannot reactivate a stale search or start a mission.
- Shared chooser/compact/controller cohort passes188/188, including real shared
  controller-navigation activation. This does not establish all three gameplay
  hosts' gamepad wiring or physical-device behavior. Native layout recheck and
  actual-host modeled controller journeys remain explicit qualification gates.

### Search during Team metadata loading

- An already-open Team selector now owns a read-only view rather than an automatic
  launch input turn. Search and filter edits can narrow arriving rows without
  triggering an unnecessary Retry or moving focus. Automatic opening/launch
  safeguards are unchanged.
- Outside focus/input, mode changes, Escape/close and backgrounding still retire
  the pending view. Completion/error removes listeners so idle status is not
  later relabelled interrupted. The affected Team cohorts pass17/17, with two
  final cleanup regressions repeated. Native verification remains required.

### Compact focused-card visibility repair

- Native keyboard testing confirmed Clear search works at44px in both compact
  orientations, but an expanded Filters popover could cover the focused card.
  Compact Filters now close when focus reaches cards/footer, preserving values
  and focus. In-filter/controller previews and wide layouts remain expanded.
- Two new regressions reproduced the old failure. The final shared chooser,
  compact and controller cohort passes191/191. Native focus visibility must be
  rechecked on this repair before the compact gate is considered complete.

### Actual-host modeled controller qualification

- Five new tests drive standard controller buttons through each real host's
  gamepad polling/frame path, not direct selector callbacks. Solo, Versus and
  Team cover compact Filters, select Confirm/Back, persisted no-match Clear and
  return to the exact opener. Versus additionally covers two-board Play,
  replacement Stay and bundled503→Retry→held Cancel→Retry→separate Play readiness.
- All5 pass; scoped lint/format/diff checks pass. Only missing native SUMMARY
  activation is modeled. These checks do not claim physical-controller behavior
  or native layout. Source validation also passes1029 files, retaining its four
  distribution-root navigation warnings; no new build artifact was produced.

### Native descendant-focus correction and retained-index reconciliation

- Native `d637f1f54` showed that the read-only view still retired when moving from
  an in-dialog control to search. Window capture receives descendant blur events;
  those are not the window losing focus. The handler now distinguishes the exact
  event target. A native-style non-bubbling descendant FocusEvent regression
  reproduces the old failure; the corrected13-case Team cohort passes while
  actual window blur, Escape and outside focus continue to retire loading.
- Final read-only catalogue/identity qualification passes33/33 across five files:
  all110 retained identities (Base12, bundled23, archived12, optional15, external48)
  reconcile with authored sources. Same-name editions stay distinct, complete
  artwork fingerprints match, modified same-ID content stays Custom and stale
  metadata fails closed. No build or content files were generated by these tests.

### Final native input recheck

- Pinned `c9eab07f0` passes held-metadata Mode Solo→type Voltage Garden→release:
  the exact row appears with unchanged search/focus, no unnecessary Retry and
  no automatic launch. The descendant-blur defect is closed for this native path.
- Expanded compact Filters stay open through their controls and close on card
  focus. The next focused card is fully uncovered in844×390;390×844 also passes,
  with a48.59px Back target and Escape returning to Browse. These receipts
  supersede the earlier `d637f1f54` and `2f6ff4746` failures, not public testing.
- Repository-wide lint and formatting checks pass. The complete affected
  `mission-library-*.test.mjs` cohort passes301/301 with concurrency2 in332.097s,
  with no failures, skips or cancellations and no build output. This run used
  `c9eab07f0` production code and the original five controller-host tests; the
  three subsequently added default-entry checks have separate evidence below.
- At this checkpoint Release A has three successful test groups and one still
  running. B remains draft/unversioned until A public acceptance and all B
  release gates. Native compact evidence covers Team remote-Solo browsing with
  keyboard/pointer at844×390 and390×844, not200% zoom, Large/Plain appearance,
  physical controllers or the eventual frozen/public build.

### Queryless default-entry controller checks

- Three additional tests enter the actual queryless Solo, Versus and Team hosts.
  Each selects the redesigned edition through the normal route loader, opens All
  missions through gamepad polling, reaches a ready Journey card, and returns to
  the exact opener with East. Gameplay snapshots remain unchanged after neutral
  frames; browsing and transition inputs neither start nor advance a mission.
- All eight actual-host controller tests pass together in36.124s, including the
  original five unchanged assertions. Real registered artwork bytes are supplied
  through finite image-decoder boundaries. This is modeled-controller evidence,
  not native image decoding, physical-device or public qualification.
- Paired-original native decoding, retained-original/Custom journeys in a
  release-aware setup, full release CI and frozen/public repetitions remain open.
