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

Updated after the trusted-download checkpoint. “Pushed” means implemented and locally verified in
draft PR268, **not released or publicly accepted**. Earlier checkpoint prose below
records the evidence at that time, not the current remaining list.

| Work                                                                          | Current state                                                         | Remaining effort estimate                          |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| Shared registry, trusted110-mission index, tags and exact owner identity      | Pushed; no name/geometry deduplication                                | Final release reconciliation                       |
| Solo host, native setup, exact launches and authored Next                     | Pushed;27 combined host/helper cases passed                           | Full regression/native qualification               |
| Versus host and supported Classic/Custom/optional launches                    | Pushed; independent fixes and17-case root repeat passed               | Downloads/readiness work below                     |
| Team host,12 Journey +2 Classic +visit-local Custom                           | Pushed;153 tests passed together                                      | Cross-mode/native work below                       |
| Solo↔Versus Journey modes without duplicate identities                       | Pushed;7 adapter +32 actual-host cases passed                         | Cross-mode public verification                     |
| Team↔Solo/Versus catalogue and exact handoffs                                | Solo/Versus→Team pushed; reverse direction under lifecycle review      | 1–3h                                               |
| Trusted bundled/archive Versus downloads                                      | Implemented;53 installer +actual-host tests pass together             | Native/public verification                         |
| Paired-original downloads/readiness across hosts                              | Incomplete; retain existing media transactions                        | 3–5h                                               |
| Installed Custom metadata/readiness without eager artwork decoding            | Validation and read-only storage boundaries in parallel development  | 3–5h                                               |
| Compact library                                                               | Pinned Solo portrait/landscape pass; new Team controls need review    | 0.5–2h targeted recheck                            |
| Full navigation, failure, storage and accessibility/performance qualification | Bounded cohorts pass; whole affected/native gates remain              | 2–4h plus device availability                      |
| Release B promotion                                                           | Waits only for accepted A and B technical gates; local work continues | 2–4h after qualification, CI/Pages queues variable |

Estimates are remaining engineering ranges, not guaranteed release times or
permission to skip gates. Parallel work overlaps; provisional B delivery range is
8–16h from this checkpoint, with external media and CI the main risks. Publish
actual delivery and remaining gates after each release. One publisher retains
main/tag/Pages ownership; implementation stays isolated from A and the dirty tree.

Additional compatibility gates: audit retained setup/appearance entry points now
that Missions opens the unified library, without adding a second mission browser.
Investigate the broader cohort's intermittent immediate-Next receipt assertion
(its isolated rerun passes). Post-adoption Next now retires its automatic-start
intent synchronously when a lazy Missions opening wins. Three targeted
continuation/setup regressions pass after this correction. Do not describe the
broader continuation cohort as clean until it is repeated successfully; the
intermittent receipt assertion remains a tracked qualification gate.

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
