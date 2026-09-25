# RevealLine — consolidated soundtrack master plan

Updated 25 September 2026. This is the durable source of truth for all soundtrack
work. It replaces the separate conversational plans without removing completed,
blocked, rejected or deferred requirements. The user approved implementation of
this consolidated plan.

## Plan maintenance and status rules

Each M0–M11 item keeps its ID, status, dependency, next action, effort estimate,
PR/evidence and released version. Update this document after each meaningful
milestone; append decisions and history instead of replacing the plan with the
latest subplan. Archive publication, rights clearance, musical approval, game
admission and public game verification are separate states.

A track is delivered only after admission, an immutable game release and direct
public verification. An MP3 preview or a passing transport test is insufficient.
Keep historical immutable files and failed/partial evidence. Never manufacture
reviewer names, listening approval or device results.

## Completed and current baseline

| Area | Completed | Remaining |
| --- | --- | --- |
| Existing catalogue | 70 hosted recordings / 15 albums; earlier 24-track collection is included | Selective listening and trusted metadata curation |
| Player framework | Simplified chooser, mixed playlists, uploads, creator tools, optional offline albums, recovery and rights enforcement | Targeted released-source verification and demonstrated fixes |
| Native archive streaming | PR #370 merged; immutable v0.111.0 preserved; primary v0.111.1 and Archive76 desktop browsers played the public archive inside the game | PR #523 repairs the live structured-rights incompatibility and remote-stream stall; exact-head qualification, release and public/device acceptance remain |
| New archive previews | 136 public archive recordings across 14 collections; the immutable 104-recording baseline and its later 32 additions retain separate publication evidence | Full listening, taste approval and game admission remain; zero new game admissions |
| Retro previews | Seven earlier rejections and six rejected DOS-88/escp previews are retained; four third-direction synth auditions are public and listening-unapproved | Review the new four against the Electric Dreams/night-drive direction; runner2088 remains draft |
| Metal previews | Six older backups, four Eternity recordings, four industrial/thrash previews, four nonduplicate YannZ-centered groove auditions and four Purgatory auditions are public alongside the earlier Nakarada pair | Complete Purgatory musical, transition and gameplay review; Reckless remains a stale-base draft |
| Nakarada Shchedryk | User approved the direction; exact MP3 admission merged through target PR #519 | Immutable public release plus gameplay/device/cultural acceptance |
| UA-FPV | Four private import packs preserve 80 filenames / 77 unique recordings | Recording-specific public permission and game admission |
| Quick controls | Current-main replacement PR #516 merged for target v0.125.0; historical PR #333 is closed | Immutable public release plus browser/controller/device acceptance |
| AI originals | Scores, candidates and rejection evidence retained | Paused; 0/36 approved |
| Historical releases | PRs #209, #250, #263 and #268 merged | Preserve delivered behavior, do not redo historical release work |

### Completed

- The 136-recording archive and immutable v0.111.0 game release are published.
  Archive75 preservation of v0.110.1 and Archive76's scoped desktop music
  verification are complete. Their exact evidence and limitations are below.
- Selector PR #476 is merged and the primary v0.111.1 deployment passed. Direct
  desktop-browser verification confirms 128-recording discovery and same-page
  Carol playback. The primary-selector blocker is complete; this does not claim
  physical-device/controller or cold-offline acceptance.
- Current source work includes the refreshed bundled-source adapter and quick
  controls. Focused checks are evidence of implemented source, not released features.

### Active — release order and effort

1. **M8 stream recovery:** qualify and release #523 before freezing the next public
   aggregate. About half a working day of hands-on release evidence remains,
   excluding publisher, CI and device waits.
2. **M3 quick controls:** replacement PR #516 is merged into current main for the
   v0.125 source target. Public B/N, touch and controller acceptance remains after the
   aggregate release.
3. **M1/M2 soundtrack admission and opening theme:** aggregate #518 and theme #519
   are merged into current main for the v0.126/v0.127 source targets. Their immutable
   public release and Shchedryk listening/cultural/device acceptance remain. M4–M6
   research continues in parallel.

The latest public/general GitHub release observed at this checkpoint is **v0.116.1**. Current PR titles propose
v0.125.0 for quick controls (#333), v0.126.0 input for #331 and v0.127.0 for #439,
but those labels do not make their conflicting/stale stacks releasable or prove a
final publisher allocation. No merge or version allocation precedes the prior
item's public acceptance. Refresh and qualify each actual resulting source;
skipped suites remain exclusions, never passes. Existing #439 is implementation
evidence for the selective rebuild, not authorization to merge its old stack
unchanged.

### Blocked and held

- Physical-device/controller and cold-offline qualification remain open after
  scoped desktop acceptance. The initial selector's failed reread is retained as
  failure evidence; the successful successor closes that publication blocker.
- Historical inputs #321, #331, #333 and #439 are closed and superseded by merged
  current-main replacements #518, #516 and #519. Their earlier failures and focused
  checks remain historical evidence. The replacements are scheduled source merges,
  not public feature acceptance; skipped jobs are not passes.
- Musical, transition, warning-audibility, cultural and physical-device evidence
  cannot be replaced by transport tests. UA-FPV public redistribution still needs
  recording-specific permission; the four private packs remain available.
- The four public PR #25 synth recordings and four public PR #26 Purgatory
  recordings are listening-unapproved and unadmitted. Their human listening and
  admission review gates have no committed ETA.
  Do not publicly redistribute Pixabay or UA-FPV recordings without exact-recording
  permission. Shchedryk remains excluded from Recording mode because of Content ID.
- Current free space is **10,695,908 KiB (about 10.20 GiB)**, above the required
  1 GiB floor. The data volume is still 98% used, so preserve that floor and keep
  large audio/build operations bounded; disk is a capacity risk, not a current
  blocker. Historical below-floor failures remain evidence and are not rewritten.

### Deferred

M9's full existing-catalogue curation and M10's broader expansion follow the core
styles. M11's rejected local AI-production method remains paused, with **0/36**
originals approved. No deadline is assigned to unresolved rights or paused music.

### Current execution snapshot

- Unified archive delivery is split into two reviewable changes. Archive
  [PR #14](https://github.com/mekhovov/revealline-soundtracks-01/pull/14) merged as
  `03a31a8b0f6e478b097b4468aaca92dfa275158c` and established the immutable
  104-recording `catalogue.json` baseline, one searchable/playable root
  player and the bounded `intake/add-music.mjs` workflow documented in
  `UPLOAD_GUIDE.md`. Archive PRs #18/#19 added 24 separately evidenced auditions;
  PR #25 added four listening-pending synth auditions and PR #26 added four
  listening-pending Purgatory auditions. Live archive main
  `824e34e4957ab29b7ef841115f631a579f741fc4` now serves 136 unique recordings
  across 14 collections with 777,523,163 audio bytes. Exact-head archive
  verification for the 104-recording baseline passed 32/32 checks. Direct
  public verification of that baseline covered text search, all eight
  then-current collections, single and
  combined style filters, shuffle/sequential order, repeat all/one/off, same-page
  playback, Media Session, CORS and an exact byte-range MP3 response. Game
  [PR #370](https://github.com/mekhovov/revealline/pull/370) adds the matching
  trust boundary and native Music Player browser, so a result streams through
  the existing transport without opening another page. Players can select one
  or several styles, start any result, choose shuffle or sequential order and
  choose repeat all, repeat one or a finite queue. Its combined catalogue,
  player, panel and host cohort passes 184/184 tests; production history and recipe
  source checks pass 14/14. Review found and the
  successor fixes close Recording-mode bypass, wrong-repository URL acceptance,
  unbounded response consumption, invalid-selection mutation and two follow-on
  policy-transition cases. The v0.110.1 reconciliation keeps current main's picture
  authority and version unchanged; Field Kit revisions 75–77 preserve main revision
  74 and bind the reviewed audio fingerprints. Local native-browser playback
  exposed the then-current 128 recordings and 12 collections, filtered the search to Cyber Anxiety,
  exposed all eight style selectors plus shuffle/sequential and repeat controls, and
  streamed Cyber Anxiety through the shared in-game transport while the game URL
  remained unchanged. Neither
  PR admits previews into trusted Automatic/built-in playlists or establishes
  musical approval. Fresh selective-port, live-count, production and focused-test
  evidence is recorded in
  `docs/verification/online-soundtrack-reconciliation-2026-09-25/review.json`.
  This pre-release source evidence is now followed by merged
  [PR #370](https://github.com/mekhovov/revealline/pull/370) at
  `3883259987913cb646eb44cf2580083dad673a70` and immutable
  [v0.111.0](https://github.com/mekhovov/revealline/releases/tag/v0.111.0), published
  25 September at 03:42:18 UTC. Merged-source qualification and freeze
  [36090144780](https://github.com/mekhovov/revealline/actions/runs/36090144780),
  original-artifact inspection
  [36090842226](https://github.com/mekhovov/revealline/actions/runs/36090842226),
  evidence assembly
  [36090978739](https://github.com/mekhovov/revealline/actions/runs/36090978739)
  and original-asset upload
  [36091145327](https://github.com/mekhovov/revealline/actions/runs/36091145327)
  passed. The annotated tag binds that exact merge; all nine release assets are
  published. Long test shards remain explicitly waived under the temporary
  fast-release policy, not passed. The controlled selector rollout and scoped
  primary desktop acceptance are complete below. Remaining verification covers
  mixed styles, order/repeat, fallback, cold-offline and physical-device/controller
  behavior; the Archive76 preservation check remains separately scoped.
- The first v0.111.0 selector [PR #473](https://github.com/mekhovov/revealline/pull/473)
  merged at `c7990977f49d40e79873782a219e4d4dc47c8890`. Production
  [run 36093864955](https://github.com/mekhovov/revealline/actions/runs/36093864955)
  failed only at **Independently reread every prepared artifact byte** because
  v0.111.1 had become the latest stable release while the reviewed selector still
  selected v0.111.0. Deployment was skipped; preserve that failure as a correct
  refusal, not a broken public deployment. The release coordinator exclusively
  owns Archive76 preservation of v0.111.0 and replacement selector
  [PR #476](https://github.com/mekhovov/revealline/pull/476). Its initial gate failed
  pending Archive76 evidence admission; refreshed head
  `9b452c97cda8c9f1a8c3c438474f72805c515f97` passed preflight/release-ready checks and
  merged at `16e111973943cdabdcccacf114228eaac3abfc98`. Main-only Pages
  [run 36095346816](https://github.com/mekhovov/revealline/actions/runs/36095346816)
  passed frozen-selector validation, the full **4,592-file / 628,700,337-byte**
  assembly, independent artifact reread and deployment. Deferred publisher tests
  and skipped test/build/release-gate jobs remain exclusions, not passes.
  Archive75's v0.110.1 preservation is complete: exact-main
  [run 36092159068](https://github.com/mekhovov/revealline-archive-75/actions/runs/36092159068)
  passed, all 1,145 public files / 595,478,020 bytes matched with zero failures,
  and scoped Solo/Versus/Team browser checks passed. Retain
  `publishing/pages-controller/evidence/archive-75-v01101/public-acceptance.json`;
  its browser evidence does not claim physical-device or comprehensive offline checks.
- Archive76 [PR #1](https://github.com/mekhovov/revealline-archive-76/pull/1) merged.
  Exact main `d1c19658d55dca7d3e1d13499673512923a623e0`, tree
  `7c407f2ac8662f7838c7126bbc704b73decc6a6d`, passed Pages
  [run 36094583007](https://github.com/mekhovov/revealline-archive-76/actions/runs/36094583007);
  deployment `6653723980` / status `18818234941` succeeded. The archive root and
  [preserved v0.111.0 game](https://mekhovov.github.io/revealline-archive-76/releases/v0.111.0/site/game/)
  returned HTTP 200. Direct Codex desktop-browser interaction loaded **128/128**
  public recordings in Music library, searched **Carol** to one result and played
  Nakarada's Carol of the Bells on the same game page. Playback advanced to
  **2.9 seconds / 4:30** with source, licence and filename visible. This is scoped
  public browser transport evidence, not full-track listening, a physical-device
  result, cold-offline verification or primary-selector acceptance.
- Primary-site acceptance after that successful deployment used the
  [v0.111.1 game](https://mekhovov.github.io/revealline/releases/v0.111.1/site/game/)
  in the Codex desktop browser. Music library loaded **128/128** public recordings;
  searching **Carol** showed **1/128**, and same-tab playback advanced to
  **0:02 / 4:30** with creator, licence and filename visible. Root, v0.111.1 and
  v0.111.0 routes returned HTTP 200; release and source download URLs returned
  range HTTP 206. The primary-selector publication blocker is complete. This
  scoped result does not approve musical quality or replace full-track listening,
  physical desktop/iPhone/controller checks or cold-offline qualification.

### 25 September checkpoint — structured rights and 136-track public archive

#### Game compatibility and stream-recovery repair

- Public v0.115.1 reproduced the exact fail-closed message
  `online soundtrack track.rights is not supported` after the archive began
  emitting structured rights for new recordings. The existing game adapter accepted
  only the legacy key set, so one valid newer row rejected the complete catalogue.
- Draft game [PR #523](https://github.com/mekhovov/revealline/pull/523), with source
  implementation commit `bf2bde2187a1e65ef3c18fa04c3d8d65769aaed8`, strictly
  validates the optional structured rights object against the already trusted
  licence, source and credit. It preserves legacy compatibility and adds CC BY-SA
  delivery validation without granting admission, default-playlist or Recording-mode
  authority.
- The same repair keeps remote archive recordings on one persistent media element,
  because WebKit playback permission is element-specific. Included and uploaded
  MP3s retain their two-deck crossfade. A bounded progress watchdog skips or falls
  back from a stalled remote recording while preserving listening intent, and the
  archive player can combine trusted remote results with the current included and
  uploaded selection.
- The live catalogue resolves **136/136** records, including all eight records with
  structured rights. Focused catalogue/player/panel/recovery tests pass **175/175**.
  In a real desktop browser, Holizna's Drama streamed for 13.5 seconds, Next moved
  to included Raspberry Jam, and selecting Cyber Anxiety returned to a remote
  stream in the same game tab. The public archive returned CORS-enabled immutable
  MP3 bytes with byte-range support.
- Remaining completion work is exact-head source qualification, merged-source
  freeze/inspection, immutable release, reviewed Pages selection and direct public
  re-verification. Physical iPhone/controller and cold-offline checks stay separate.
  The full formatter currently reports seven current-main files outside PR #523;
  its six changed files, native formatting, lint and diff checks pass. A separate
  current-main Music Studio keyboard-guard assertion also fails with PR #523's panel
  replaced by baseline source, so it remains a baseline issue unless exact PR gates
  prove an interaction.

- Archive [PR #24](https://github.com/mekhovov/revealline-soundtracks-01/pull/24)
  merged as `9eb606ce78d82a24b7771d596aa3488611730117`. It adds a
  fail-closed structured rights contract for new recordings, including exact
  licence identity/version, rights-evidence URL, attribution, truthful derivative
  notice and compatible ShareAlike delivery terms. Metadata-free compatibility is
  limited to twelve deployment-pinned historical identities; unknown and future
  recordings require the structured contract. Existing audio bytes and musical
  decisions were unchanged. Exact-merge Pages
  [run 36117606837](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36117606837)
  passed verification and deployment.
- Archive [PR #25](https://github.com/mekhovov/revealline-soundtracks-01/pull/25)
  merged as `007cbf6ddb52c0f754956d2eedabf3ffaa924022` and published
  **90s Racer Techno**, **Neon Pulse**, **Prismatic Light** and **Future Travel**.
  Exact-merge Pages
  [run 36147468099](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36147468099)
  passed verification and deployment. The public catalogue returned HTTP 200,
  165,191 bytes and `Access-Control-Allow-Origin: *`; it declares **132 unique
  recordings across 13 collections** and 761,327,907 audio bytes. A direct range
  request for 90s Racer Techno returned HTTP 206, `audio/mp3`, CORS `*`, exactly
  1,024 bytes and `Content-Range: bytes 0-1023/5535495`, proving the deployed
  object supports the byte-range transport used by the player.
- All four PR #25 recordings remain `listeningApproval: not-reviewed`,
  `gameCatalogueAdmission: false`, `default: false` and
  `recordingModeEligible: false`. Their public availability is an audition and
  transport milestone, not musical approval, game admission or a default-playlist
  change.
- Archive draft [PR #22](https://github.com/mekhovov/revealline-soundtracks-01/pull/22)
  (Reckless punk-metal) remains clean/mergeable at
  `964b00b264985da4d0e6a41545c77f9a1a7456a7`, but its base
  `41ea4448cf9602960ada28cd2c7c9a4cd5cb6b38` predates current archive main and
  must be reconciled before review. Draft
  [PR #23](https://github.com/mekhovov/revealline-soundtracks-01/pull/23)
  (runner2088 retrowave) is conflicting at
  `e6e746a83f08708b4b24cf1a2522a4924624001a`. Neither is published by the
  current archive main. Allow about half a working day per draft for rebase/
  conflict resolution and fresh applicable checks before independent review;
  publication and listening time remain additional. Purgatory vol. 3 source preparation merged through
  [PR #21](https://github.com/mekhovov/revealline-soundtracks-01/pull/21) as
  `41ea4448cf9602960ada28cd2c7c9a4cd5cb6b38`; its four-track exact artifact is
  technically reviewed. Publication
  [PR #26](https://github.com/mekhovov/revealline-soundtracks-01/pull/26) merged as
  `824e34e4957ab29b7ef841115f631a579f741fc4`. Its draft exact-head verify/source checks
  [36149040244](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36149040244),
  [36149040063](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36149040063)
  and [36149039993](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36149039993)
  passed; event-inapplicable deploy/prepare/assemble jobs were skipped and are not
  passes. Exact-merge Pages
  [run 36160861165](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36160861165)
  passed verify and deploy at that merge. Direct public verification returned a
  174,470-byte CORS-enabled catalogue declaring **136 unique recordings across 14
  collections** and 777,523,163 audio bytes. A Visceral Vengeance byte-range request
  returned HTTP 206, `audio/mp3`, CORS `*`, exactly 1,024 bytes and
  `Content-Range: bytes 0-1023/3673069`. All four appended recordings remain
  `listeningApproval: not-reviewed`, `gameCatalogueAdmission: false`, `default: false`
  and `recordingModeEligible: false`. GitHub exposes no formal PR review entry, so
  this ledger records the exact merge, checks and public result without inventing an
  independent approval. Publication does not establish musical or game admission.
- Authoritative game GitHub state has
  [PR #370](https://github.com/mekhovov/revealline/pull/370) merged as
  `3883259987913cb646eb44cf2580083dad673a70` and
  [v0.111.0](https://github.com/mekhovov/revealline/releases/tag/v0.111.0)
  published as the public soundtrack archive player. Current game main is
  `a4c1eae5084b87f7cb36ac44a5258f0f4b6476b0`, and the latest public/general GitHub
  release is v0.115.1. Later game releases do not convert these archive auditions
  into trusted built-ins or defaults.
- UA-FPV remains on its recording-specific public-redistribution rights hold; its
  four private import packs remain available. The rejected local AI-production
  method remains paused with **0/36 originals approved**.
- M0 was merged through docs-only PR [#330](https://github.com/mekhovov/revealline/pull/330)
  at commit [efacbf087](https://github.com/mekhovov/revealline/commit/efacbf087eb9e1d15019f0d6aecd5ae32ac313fa).
  Plan consolidation is complete; implementation and evidence updates continue here.
- M2's historical source review on draft PR
  [#331](https://github.com/mekhovov/revealline/pull/331) covered
  4fd7eb0b7e850b538b30450cedaa1bcd83f3845a with 11/11 focused source tests passing.
  The later 80d6e2f ledger failure and 71b787ed reconciliation are retained history.
  Its refreshed draft head is `b1ae8bcafd371840916e18ec5b90a68ec666a8e5`, based on
  accepted source `cd9565357add4d1521faae76e6d029446b6d8503`.
  Soundtrack source, dependencies, production history and Team picture/import
  checks pass 111/111. A separate Team production-history suite passes 1/3; two
  inherited drifter source-stage failures remain. Field Kit revision 79 preserves
  exact Team image identities and revisions 58–78. This is scoped evidence, not qualification or
  recording admission: registrations remain empty, no MP3 is bundled and no default
  changes. The draft now conflicts with authoritative main; its earlier clean base
  and focused results do not qualify the current release source. Hosted
  [run 36092960845](https://github.com/mekhovov/revealline/actions/runs/36092960845)
  passed preflight; test/build/release-gate jobs were skipped and release-ready
  failed because this draft intentionally has `ADMISSION=hold` and no release slot.
  Fresh accepted-base gates and release remain. Opening-theme
  [draft PR #439](https://github.com/mekhovov/revealline/pull/439) is now active at
  `cd19167c176c57bf70e062cc1826befe408cf5a9`, stacked on #331. It contains the exact
  MP3, registration and startup/storage policy; current focused evidence is
  **245/245** soundtrack/Couch/player/catalogue/distribution/rights checks and
  **14/14** complete production-history/recipe-source checks, with zero failures
  or skips. Production reproduction/readiness pass at scoped reviewed revision 81.
  Earlier head `55c5eb09a5931c5f35c10d615b92fb80b6b3aa09` and its 182/182 + 5/5
  results remain historical evidence. Accepted-base hosted/frozen qualification,
  listening/cultural/device/offline review and public delivery remain; neither
  draft has been merged or released.
- M3 draft PR [#333](https://github.com/mekhovov/revealline/pull/333) has independently
  reviewed historical runtime at 99ae9a939805e026820e27d8ead5eb7f1f09ac42. Earlier
  commit da750277179b3e22f3962cdc3b5dd684b411005e added evidence only. Forty affected tests
  passed after the retry-race correction; the earlier focused run passed 105 tests.
  These are overlapping scoped runs, not full source qualification. The unchanged
  declared Field Kit fingerprints do not approve the new UI/audio behavior.
  Exact-head [run 35953405357](https://github.com/mekhovov/revealline/actions/runs/35953405357)
  at da750277 passed preflight and build; test shards and release_gate were skipped.
  The prior cec13c56 checkpoint passed 439/439 focused audio/control tests and
  12/12 history checks; its separate 7/10 Team cohort remains historical evidence.
  Current draft head `ed59771ece1a27d0e677d0f0626448c086fa0d34` is rebased onto
  `c7990977f49d40e79873782a219e4d4dc47c8890`. Its 40/40 control/host tests and 14/14
  recipe/history checks pass. Audit revision 6 closes all nine runtime dependencies
  and verifies mutation/missing-input refusal. Field Kit revision 78 reopens UI,
  screen and audio recipes at `source`, without inheriting revision-77 approval.
  Authoritative GitHub now reports head
  `77a3b8a93ca995e61eacf7e846a01ef7886db557` conflicting with current main.
  Prior preflight passes remain scoped historical evidence; build/test/release-gate
  skips are not passes, and the prior release-ready failures remain failures.
  Conflict resolution, fresh hosted exact-source gates, scoped review, independent
  final review and browser/controller/device acceptance remain.
- Archive [PR #4](https://github.com/mekhovov/revealline-soundtracks-01/pull/4)
  merged at 62dfd72d561621218c63443b6ab621f6f67d46cc and acquired two Nakarada
  auditions through the existing hosted intake. Separate
  [PR #5](https://github.com/mekhovov/revealline-soundtracks-01/pull/5) merged at
  962b62f21df75ca81c84deceaf44c32b1d79ff28: its source-bound itch.io metadata
  resolver covers six synth and four metal candidates without acquiring their audio.
- Archive [PR #6](https://github.com/mekhovov/revealline-soundtracks-01/pull/6)
  merged at 40a283d9a2ed2f5a00837ae60273f3884a52e706. The Dobermann and Folklore
  preview retains exact native sources, licence snapshots and technical receipts.
  Independent artifact review and all 20 archive/preview member hash checks passed.
  Pages [run 35953352751](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35953352751)
  passed. Direct verification matched the live manifest and all nine servable member
  hashes, including both full MP3s. In-app browser playback advanced for both tracks;
  Next switched songs and Pause changed the action to Resume music. The .nojekyll
  control file returned HTTP 404 and remains an explicit partial-check exception.
  Full-track listening, game admission and physical device acceptance remain; neither
  recording is classified as Ukrainian.
- Archive [PR #7](https://github.com/mekhovov/revealline-soundtracks-01/pull/7)
  integrated bounded hosted acquisition and merged at ada6a708222de9e399a36751e9aecef4238c746a.
  [Run 35953731494](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35953731494)
  passed all 49 intake tests and acquired all ten recordings: six DOS-88/escp synth
  and four David KBD metal. Full decoding, exact source/native bindings and
  permitted-derivative loudness/true-peak checks passed. At acquisition all ten were listening-pending; the six synth
  recordings are now rejected as recorded under M5.
- Archive [PR #8](https://github.com/mekhovov/revealline-soundtracks-01/pull/8)
  merged at 3bf8e97c9f6d6303582a09fbe67fd93cc4d1fce5 with two separately sized
  audition collections. [Production evidence](https://github.com/mekhovov/revealline-soundtracks-01/tree/3bf8e97c9f6d6303582a09fbe67fd93cc4d1fce5/intake/archive/itch-core-audition-20260924)
  preserves ten native originals, normalized MP3s, source/licence receipts and
  pending reviews. Independent metadata/publication and artifact/byte reviews
  passed; unchanged player/style bytes and every older archive file are preserved.
  After PR #8, archive totals were **96 recordings / 519,645,620 audio bytes / 520,152,260 public
  bytes**, across the original catalogue and five added batches. These are historical archive
  counts, not new game admissions.
  Pages [run 35954930019](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35954930019)
  passed verification and deployment. [Direct public evidence](https://github.com/mekhovov/revealline-soundtracks-01/pull/8#issuecomment-5807596591)
  matches both deployment manifests and all 24 servable members, including ten
  complete MP3s, by exact bytes/hash. The two .nojekyll control files are explicit
  exclusions, not HTTP passes. In-app browser checks advanced Crash Landing →
  Race to Mars and The Desolation of a Civilization → Agony Space-deep with
  readyState 4 and no media error; Next changed title/source and Pause set paused
  with the Resume label in both collections. [Independent publication review](https://github.com/mekhovov/revealline-soundtracks-01/pull/8#issuecomment-5807551144)
  is retained. Full listening and physical-device checks remain for candidates
  still being considered; only musically accepted recordings may proceed to game
  admission. M5 records the subsequent rejection of the six synth auditions.
  That publication round provided **twelve public auditions: six synth, four David KBD
  metal and two Nakarada metal**, with **zero new game admissions**.
- PR [#321](https://github.com/mekhovov/revealline/pull/321) remains draft at
  `e6a766abce745e1993c53a2652d8e03e50e7a5e5` and is conflicting with current
  main. Its stale-base evidence is unqualified for release.
- Qualification [35945946346](https://github.com/mekhovov/revealline/actions/runs/35945946346)
  at `539418e41a198b02843c70baf488008716089a9a` finished with all four test shards
  failed. Qualify passed; freeze was skipped. Previous “still running” wording
  is superseded. Preserve the failed logs and diagnose against accepted main.
- Regular head run [35946894022](https://github.com/mekhovov/revealline/actions/runs/35946894022)
  passed preflight/build but skipped test/release_gate; these are not full qualification.
- M1 isolated two inherited failure classes against baseline `d0c73b472` and
  failed source `539418e`: chapter-download fixtures expect untuned speed 10 and
  actor velocities 5.4/3.6 while both commits produce tuned speed 8.84 and
  velocities 9.194155752433174/6.129437168288782; terrain fixtures advertise all
  prepared assets while supplying only the wall, correctly rejected by anchor guards.
  These were reproduced/read from committed modules in memory, without media copies.
- PR #320 owns the corresponding tuning, prepared-artwork and asynchronous Journey
  fixture fixes; its UX owner confirmed reuse after acceptance. The failed run has
  571 failures and one cancellation; 215 failure/cancellation records occur in files
  touched by that PR. This does not prove it fixes every failure. Preserve runtime
  guards, do not mass-change assertions, and rerun the resulting exact soundtrack head.
  Historical shared [PR #320](https://github.com/mekhovov/revealline/pull/320)
  checkpoint: c8ba85b had four full test shards in progress; known Team/default-Solo
  residuals were not accepted. The UX owner reported additional
  story/PNG/default-focus fixes at local 3aed6344c and gallery fixtures at e9d604a71;
  Team review c51554ffc still needs coherent production-63 successor/retained-62
  wiring. Those were in-progress corrections at that checkpoint, not accepted source
  qualification. The later 26fe20f8 checkpoint below supersedes these status notes;
  do not repeat their investigation or count unaccepted changes as released.
- v0.97.0 was published as a GitHub release at 03:30:28 UTC on 24 September.
  This supersedes the plan's earlier “draft” snapshot. Public Pages selector and
  feature acceptance remain separate verification owned by **🔥 Releases**.
  Preserve v0.96.0 and all earlier immutable releases.
- Archive51 PR #270 closed without merging. Preserve staging evidence and resolve
  its disposition in reconciliation; do not count that PR as delivered.
- Earlier tiny Git writes failed with ENOSPC; preserve that blocked-check evidence.
  Cleanup briefly restored the reserve, but the latest reported free space is
  **669,736 KiB (about 654 MiB)**, again below the 1 GiB production floor.
  Continue hosted/RAM-only work: no local media intake, builds, full checkouts or
  guard bypasses. Preserve user files, originals and evidence.
  A subsequent M5 source-comparison checkpoint reported **116 MiB free**.
  This docs-only update uses hosted Git operations; no local audio/build/checkout
  is created and the 1 GiB production guard remains in force.

### 24 September checkpoint — retained metal direction and exact source gates

- Docs-only [PR #336](https://github.com/mekhovov/revealline/pull/336) merged at
  a24354fc9bfa75d2aea0d9c3660e160bacd02a87. Exact head 67b1d8e9 had independent
  review, preflight and build passes. Runtime tests were skipped by the inherited
  global waiver; this is not full runtime qualification.
- PR #331 is independently reviewed at 80d6e2f2621e85e92ab5e77d00b3069e131f392f,
  isolated onto accepted main b639b253 with the same six reviewed file blobs.
  The original stacked source remains on
  codex/shchedryk-bundled-source-pre-rebase-4fd7eb0b; PR #321 was not merged.
  Fresh [run 35959304115](https://github.com/mekhovov/revealline/actions/runs/35959304115)
  failed **preflight / Verify Field Kit production ledger and compiled output**:
  “Stale production revision ledger. Run --write to append compatible revisions.”
  Validation, lint and both formatting checks passed; build/tests/release gate
  were skipped. [Failure evidence](https://github.com/mekhovov/revealline/pull/331#issuecomment-5808266278)
  is retained. Track the new bundled helper in the audio dependency list, append
  scoped functional continuation for eight procedural roles and regenerate
  through the producer after the accepted shared lineage is available.
  This repair cannot approve recordings, listening or devices.
- Shared PR #320 is at 26fe20f8c00aa2d09238595c8856fa5572ea0561.
  [Run 35956795771](https://github.com/mekhovov/revealline/actions/runs/35956795771)
  passed preflight/build; all four mandatory shards were still running at this
  checkpoint. Production 63 belongs to that source. Coordinate the next unused
  successor after its actual merge; never overwrite its ledger or assume a
  revision is reserved. PRs #321/#333 still need accepted-base qualification.
- Local free space is approximately **100 MiB**, below the unchanged 1 GiB floor.
  Source preparation uses memory and hosted Git operations; no local audio
  downloads, checkouts, builds or user-file cleanup occurred. This is a historical
  checkpoint; the current 25 September reading is 10,695,908 KiB (about 10.20 GiB),
  above the floor but still on a 98%-used volume.
- The latest metal decision below preserves the Shchedryk decision, Ukrainian
  research, synth reference history, older metal backups and paused originals.

### 24 September checkpoint — four more metal previews and dependency coverage

- Archive [PR #9](https://github.com/mekhovov/revealline-soundtracks-01/pull/9)
  merged at d3c675c7183f651089461d0e42c364b850a03ebf. Hosted
  [run 35961304793](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35961304793)
  passed all 58 intake tests and prepared Anemo, Trial of Thorns, Riffs Two and
  Apocalypse. [Independent original-artifact review](https://github.com/mekhovov/revealline-soundtracks-01/pull/9#issuecomment-5808496559)
  binds artifact 10792671587, its 16 retained members, source manifest and exact
  source/runner tree. Full decoding and permitted-derivative loudness/peak checks
  passed; no listening approval was inferred.
- Archive [PR #10](https://github.com/mekhovov/revealline-soundtracks-01/pull/10)
  merged at c1696d20c139acc98623b8c5a3eda9c17e6fbcee after
  [independent publication review](https://github.com/mekhovov/revealline-soundtracks-01/pull/10#pullrequestreview-5300401852).
  All native originals, source/licence snapshots and receipts are preserved;
  the player, styles and historical files are unchanged. The new
  [metal groove audition collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-groove-audition-20260924/)
  is 29,834,805 bytes including metadata, below 64 MiB.
- Exact-merge Pages [run 35962528262](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35962528262)
  passed verification and deployment. [Direct public byte evidence](https://github.com/mekhovov/revealline-soundtracks-01/pull/10#issuecomment-5808712722)
  matched the manifest and all 11 servable members, including all four complete
  MP3s, by exact lengths and hashes. The .nojekyll control-file HTTP 404 is an
  explicit exclusion, not an HTTP pass. [Public browser transport evidence](https://github.com/mekhovov/revealline-soundtracks-01/pull/10#issuecomment-5808727729)
  records advancing playback for all four tracks with readyState 4 and no media
  error, Pause/Resume continuity, and shuffled Next changing Anemo to Apocalypse.
  These are short observations, not full-track listening, natural-end/repeat,
  in-game mixing, offline or physical-device acceptance.
- Archive totals are now **100 recordings: 70 foundation plus 30 previews**,
  **549,440,433 audio bytes / 549,987,343 public bytes**, across the original
  catalogue and six added batches. All four new recordings retain Content ID
  true, Recording mode eligibility false and pending musical/gameplay review.
  They are not Ukrainian additions. **Zero newly admitted game recordings.**
- [PR #333 dependency audit](https://github.com/mekhovov/revealline/pull/333#issuecomment-5808657043)
  at da750277179b3e22f3962cdc3b5dd684b411005e found nine changed runtime files
  outside every declared Field Kit fingerprint. A read-only, stubbed-input probe
  changed and withheld each file: all fingerprints stayed unchanged and no
  missing-file rejection occurred. This is dependency-coverage evidence, not a
  full production or functional test. M3 below records the required closure.
- Shared PR #320 remains open at 26fe20f8c00aa2d09238595c8856fa5572ea0561.
  [Run 35956795771](https://github.com/mekhovov/revealline/actions/runs/35956795771)
  has passing preflight/build and all four test shards still running at this
  checkpoint; release_gate is skipped. Its production-63 lineage is not yet
  accepted. Older c8ba85b/local-revision notes above are historical snapshots.
- PR #331 remains blocked by the exact preflight ledger failure retained above.
  Coordinate both source closures after PR #320's production-63 source is
  accepted; preserve history, append justified successors and rerun exact-source
  gates. No successor revision is reserved by this plan.
- This checkpoint is based on game main ca3f3fd638e02e1907a0811d7759d24ba8f726b6.
  PR #341 changes publisher selector/evidence, not soundtrack runtime. Archive
  publication does not establish public game acceptance or allocate a music
  release version.

### 24 September checkpoint — YannZ groove intake and public comparison

- Archive [PR #11](https://github.com/mekhovov/revealline-soundtracks-01/pull/11)
  merged at 71c9b62aaaf0f485fe8c4fb3274f43b939effe3b. Its final hosted
  [run 36004806070](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36004806070)
  passed all 62 intake tests and prepared Pixel Damnation, Revenge's Waiting,
  Soul Ripper, German Industrial Metal and Achilles. The first failed run retained
  a stale four-track manifest assertion; the second retained the ordinary one-minute
  duration rejection for the 48-second boss cue. The final change preserves the
  ordinary 1–12 minute policy and adds a narrow 30-second minimum only for explicit
  `boss-cue` recordings. Technical decoding, source/licence snapshots and permitted
  derivative measurements passed. Listening and game admission did not.
- The exact hosted artifact `10810521176` is 57,879,598 bytes with SHA-256
  `4c3c0556359efc76c52322a4c6cde3b09116f572f9da929d58d9a827a382636e`.
  Its 16 original members and the exact source manifest are retained. Source head,
  runner revision and accepted merge share tree
  `2d0a398452979711e95d0df1d129b6a81aefeb3e`; independent artifact review is
  preserved on PR #11.
- Catalogue-wide comparison found German Industrial Metal already present in the
  immutable core batch with the same recording ID, title, native hash and delivery
  hash. Archive [PR #12](https://github.com/mekhovov/revealline-soundtracks-01/pull/12)
  therefore retained all five intake recordings as evidence while publishing only
  the four nonduplicates. Exact-head
  [run 36006489875](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36006489875)
  passed hosted verification and staging at 104 recordings. Independent review
  confirmed the exact head; merge commit is
  `a8dfc0c818c785b2da7c3ec2bbd5692a4959e746`.
- Exact-merge Pages
  [run 36006830854](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36006830854)
  passed verification and deployment. The live
  [groove-first comparison](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-groove-yannz-audition-20260924/)
  exposes four MP3s totaling 19,101,744 bytes. Direct public checks matched every
  committed length and SHA-256. Browser playback started Pixel Damnation, Next
  selected Revenge's Waiting, and Pause changed to Resume. These short transport
  checks are not complete-track, transition, warning-audibility, Content ID,
  Recording mode, offline, physical-device or game-admission approval.
- Archive totals are now **104 recordings: 70 foundation plus 34 previews**,
  **568,542,177 audio bytes / 569,127,879 public bytes**. Revenge's Waiting remains
  an explicit 48-second boss cue and does not count toward the full gameplay-track
  target. **Zero newly admitted game recordings.**
- Game PR #320 advanced to 16d1e8f722891f775e05cf799dbca3299c2b91a4.
  Exact [run 35991665122](https://github.com/mekhovov/revealline/actions/runs/35991665122)
  passed preflight, build and shards 1/2, then failed shard 3 at
  `touchscreen-controller-host.test.mjs:250` with an asynchronous host-action
  timeout. Shard 4 passed 3,516/3,518 and failed two
  `versus-continuous-next-host.test.mjs` cases with unsettled asynchronous actions;
  post-test activity reached `document` after teardown. PRs #331/#333 remain blocked
  until the shared owner fixes and fully qualifies that baseline. The owner then
  published a test-only synchronization correction at
  `b79a979cb0a1653499e8c4432c3e755374015230`. Fresh exact-head
  [run 36007570919](https://github.com/mekhovov/revealline/actions/runs/36007570919)
  has passing preflight while build and all four shards are in progress at this
  checkpoint. The new head remains unaccepted until every required gate passes.
- Accepted game main at this checkpoint is
  `bc9bd27fd7c62d9329c7fd38f1546de7ba91e49c`. Local free space is approximately
  1.4 GiB. Continue sparse/hosted work and preserve the 1 GiB floor.

### 24 September checkpoint — v0.106 published and independent music research

- Immutable [v0.106.0](https://github.com/mekhovov/revealline/releases/tag/v0.106.0)
  was published from main `77c1b7888adba766fc6998774244bb42feb0db60` and its
  reviewed frozen Pages selector was merged through PR [#398](https://github.com/mekhovov/revealline/pull/398)
  at `2705b61915b62cb8bb9497e2bfd9a73a05d76764`. This is release publication
  evidence only: public Pages selector and feature acceptance remain separate.
- The sole publisher assigned the pause-menu work to v0.107. Its replacement PR
  [#397](https://github.com/mekhovov/revealline/pull/397) merged as
  `c75c064e9a228349529e002d6492cc5fa339c70d`; its authorized fast-lane run
  passed preflight and build while test and release-gate jobs were skipped. Those
  skips are retained as skips, not passes. Main then advanced through the
  test-only PR #396 to `88d1726a268e6aaf3fd8f1373390f4be836f5e12`; merged-source
  qualification [run 36064106918](https://github.com/mekhovov/revealline/actions/runs/36064106918)
  passed, while the immutable v0.107 release was not yet published at this
  checkpoint. PR #370 remains draft at
  `c80cfe01cdd0379977dac2ea0ddfe236d53a7591` and is sequenced for a rebase
  after v0.107, before its own v0.108 release. It has 203/203 focused
  soundtrack tests and separately recorded browser transport evidence, but no
  immutable game release yet.
- Draft PR [#333](https://github.com/mekhovov/revealline/pull/333) remains
  stacked on PR #370 at `41cbf2be98969b462ced59382e1d2671eb07423a`; its 225/225
  focused quick-control tests are useful scoped evidence, not a source-gate
  substitute. Draft PR [#331](https://github.com/mekhovov/revealline/pull/331)
  remains source-adapter-only at `b24470a6b2b22fcaecfd642e70e4636d9e059643`.
  It neither registers nor bundles Shchedryk. Release each only after its
  actual accepted base; do not merge, retag or reserve a version out of order.
- M5 and M6 research proceeds without waiting for those releases. New
  source-page leads are deliberately unacquired: **Retroracing Nightlife** by
  Bogart VGM is a [CC BY 4.0 racing synthwave track](https://opengameart.org/content/retroracing-nightlife)
  with a creator-uploaded MP3; **runner2088** by wekont is an
  [instrumental CC BY 4.0 retrowave track](https://freemusicarchive.org/music/wekont/single/runner2088mp3/),
  but at 1:37 is only a short-cue comparison. Neither is accepted or downloaded.
  Scott Buckley's **Neon** remains a useful musical comparison, but the
  creator's [standalone redistribution restriction](https://www.scottbuckley.com.au/library/using-this-music/)
  and Smart Content ID treatment keep it out of the public-MP3 intake lane.
- The stronger M6 shortlist now includes David KBD's free, CC BY 4.0,
  non-generative [Interstellar EDM/Metal pack](https://davidkbd.itch.io/interstellar-edm-metal-music-pack),
  [Reckless vol. 2 punk-metal pack](https://davidkbd.itch.io/reckless-vol-2-punk-metal-music-pack)
  and [Purgatory vol. 3 extreme-metal pack](https://davidkbd.itch.io/purgatory-vol-3-extreme-metal-music-pack).
  They match the requested riff-plus-electronic-pulse or faster combat directions
  on their source descriptions, but descriptive tags are not listening approval.
  Resolve acquisition rights before downloading; complete exact-file review,
  full listening and the normal rights/Content-ID checks before publication or
  admission.

## Remaining delivery ledger

Estimates are hands-on effort, not promised dates. CI queues, listening reviewers,
rights and actual failure diagnosis can extend elapsed time. No soundtrack game
version is allocated without the release owner's confirmation.

| ID | State / priority | Dependency | Next action and completion condition | Effort | PR / evidence | Released version |
| --- | --- | --- | --- | --- | --- | --- |
| M0 | Complete; maintenance continues | None | Preserve all histories and update this ledger after each meaningful milestone | Complete | [PR #330](https://github.com/mekhovov/revealline/pull/330), merged efacbf087; prior source PR #321 | Docs merged; no runtime release required |
| M1 | Current-main admission/source infrastructure merged | Aggregate public release and released-source verification | Preserve the #518 source boundary through final aggregate qualification; verify its generated ledger and admission gates on the frozen source | About 0.5 day hands-on in aggregate qualification, excluding CI | Historical #321/#331; merged replacement [PR #518](https://github.com/mekhovov/revealline/pull/518) at 36e68002 | Scheduled target v0.126 source; not yet public |
| M2 | Exact Shchedryk admission merged into current main | Aggregate public release; listening, cultural, offline and device review | Preserve exact bytes/identity through final qualification, then prove opening-menu, saved-preference, Recording-mode and offline behavior publicly | About 1 day hands-on acceptance, excluding listening/device reviewers and CI | Historical #439; merged replacement [PR #519](https://github.com/mekhovov/revealline/pull/519) at 47df2655 | Scheduled target v0.127 source; not yet public |
| M3 | Quick controls merged into current main | Aggregate public release and device access | Verify B/N plus touch/controller Play/Pause and Next on the immutable public artifact | About 0.5–1 day hands-on, excluding device/CI waits | Historical #333; merged replacement [PR #516](https://github.com/mekhovov/revealline/pull/516) at 7ccbb6d3 | Scheduled target v0.125 source; not yet public |
| M4 | Active research; parallel | Exact published rights and musical/cultural review | Target six additional distinct Ukrainian compositions; publish cleared subsets | 1–2 days per research round; rights/review date unknown | Candidate/hold register below | Unreleased |
| M5 | Four third-direction synth auditions are public; runner2088 remains draft; Electric Dreams remains the closest reference | Musical fit, full listening and exact admission review; public-archive holds remain | Review 90s Racer Techno, Neon Pulse, Prismatic Light and Future Travel; keep PR #23 draft until independently reconciled; admit only a musically accepted subset | Several hours per comparison round; 1–2 days integration/verification after approval; CI/review waits excluded | Archive [PR #25](https://github.com/mekhovov/revealline-soundtracks-01/pull/25), Pages run 36147468099 and M5.a feedback below; draft [PR #23](https://github.com/mekhovov/revealline-soundtracks-01/pull/23) | Unreleased in game |
| M6 | Purgatory PR #26 is publicly deployed; Reckless #22 is clean on a stale base; groove-first direction retained | Full listening, transitions, warnings, Content ID and gameplay acceptance | Review the four public Purgatory auditions; reconcile #22 separately; admit only a musically accepted subset | Several hours per listening round; 1–2 days integration after approval; about 0.5 working day to reconcile #22 before fresh review | Merged publication [PR #26](https://github.com/mekhovov/revealline-soundtracks-01/pull/26), 824e34e4 and Pages run 36160861165; stale-base draft [PR #22](https://github.com/mekhovov/revealline-soundtracks-01/pull/22) | Public auditions only; unreleased in game |
| M7 | Blocked public rights; scope retained | Recording-specific public redistribution and applicable artwork evidence | Include all 77 recordings / 80 filenames; publish cleared entries; maintain private pack route | About 1 day integration after clearance; clearance date unknown | UA-FPV manifests/private packs/guide | Public collection unreleased |
| M8 | Compatibility/stall repair implemented in draft PR #523; 136/136 live records and remote→included→remote switching verified locally | Exact-head gates, publisher allocation, merged-source release and public/device access | Qualify #523, publish it through the immutable release/Pages pipeline, then repeat catalogue, mixed-queue, failure-recovery and device checks on the public artifact | About 0.5 day hands-on for remaining release evidence, excluding CI/publisher/device waits | PR #370, v0.111.0, Archive76; repair PR #523 source bf2bde218; 175/175 focused tests and browser evidence above | Primary v0.111.1 historical acceptance; repair unreleased |
| M9 | Later | Core style releases | Review existing 70 selectively; add trusted ID/hash curation overlay preserving saved pins | 1–2 days per selected batch plus listening | Curation PR pending | Unreleased |
| M10 | Later | Core styles delivered | Broader musical variety in small accepted albums | 1–2 days per batch plus review | Separate future album PRs | Unreleased |
| M11 | Deferred / paused | Better production method and accepted pilots | Retain full 36-original brief; do not resume rejected production method | Unscheduled | Candidate/rejection archives | 0/36 approved |

M4–M6 research proceeds in parallel. M3 does not wait for music rights. A cleared
Ukrainian, synth or metal subset can ship without waiting for the other families.
Full listening review of the existing 70 is not a prerequisite for a new batch.

## M2 — Shchedryk opening theme

Implementation checkpoint: PR #331 binds bundled identity, exact bytes, local path
and effective permissions across same-hash aliases. Registrations remain empty;
silent local-only preparation remains request-free. Historical source evidence,
the current 111/111 focused checks and two separate inherited failures are retained
above. Stacked draft #439 implements the exact recording, startup policy,
core/offline packaging and budget accounting; its current 245/245 + 14/14 checks
and revision-81 scoped review do not replace accepted-base hosted/frozen
qualification, recording/device/offline reviews or public delivery.

- Use **Carol of the Bells (Metal Version) — Alexander Nakarada**. Preserve its
  existing ID, exact 8,641,768-byte MP3 and SHA-256
  `d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58`.
- Bundle the approximately 8.24 MiB recording with the game as the explicit
  exception to optional-audio-only core delivery. Trusted code maps identity,
  hash and bundled path; imported metadata cannot create a bundled entitlement.
- Fresh profiles and users retaining the default selection open with this song
  on a new visit, followed by admitted Ukrainian music. Preserve saved explicit
  styles/playlists, mute, volume and intentional music pause. Never infer that an
  existing saved Synth choice may be overwritten. This supersedes fresh Synth default.
- Preload without blocking menu rendering. Start when browser policy permits;
  otherwise use the first eligible gesture and a compact Play music retry action.
- Ordinary menu returns, Settings, Pause, results, retries and background recovery
  preserve the current song. Reuse the existing transport owner and cancellation.
- Tag Ukrainian / Metal / Fusion without duplicate mixed-queue entries. Display
  title, artist, source link and accurate Shchedryk-adaptation provenance.
- Registered Content ID means Recording mode excludes this recording and uses an
  eligible fallback. User taste approval does not authorize a false video-safe label.
- Count bundled storage consistently; do not duplicate its installed bytes or
  delete the core theme when removing optional albums. Verify core/package limits.
- User musical approval is complete. Full-track, repeated-session, transition,
  warning, mono/small-speaker and cultural/device evidence remain separate gates.

## M3 — immediate music controls

Implementation checkpoint: PR #333 implements these controls and fixes the Solo
lifecycle retry capture race found in review. The refreshed ed59771e head and
54/54 scoped results are recorded above. The historical audit recorded declared
Field Kit fingerprints unchanged; it does not claim new UI/audio acceptance.
Exact-head run 35953405357 at da750277 passed preflight and build, including
validation, lint, both formatting checks and production reproducibility; test
shards/release_gate were skipped. Require all four shards and browser/controller/
device evidence on the eventual accepted source before release.

The [historical dependency audit](https://github.com/mekhovov/revealline/pull/333#issuecomment-5808657043)
found that all nine changed runtime inputs were omitted: quick-music-controls.mjs
and .css, app.mjs, couch/couch-music-host.mjs, couch/couch.mjs,
couch/relay-rescue.mjs and all three mode HTML files. Revision-6 evidence now binds
all nine to UI/screens and the five playback-owning JavaScript paths to audio.
The explicit recipe-source and production-history tests cover consumer-group
mutation, missing-input refusal and immutable prior records. Revision 78 reproduces
with reopened source-stage recipes; complete scoped UI/screen/audio review before
qualification. Coordinate successors from the actual accepted main ledger, with no
inherited approval or reserved revision. Earlier audits remain unchanged evidence
of the original limitation, which the current source closes.

- **B** plays/pauses music; **N** selects the next song in gameplay and ordinary menus.
- Compact Now Playing, Play/Pause and Next appear in main and pause menus across
  Solo, Versus and Team. Touch uses these controls; controllers reuse menu focus
  and Confirm. Resume game remains initial pause focus, followed by music controls.
- Music pause leaves gameplay and effects running. Next while paused selects the
  next recording without resuming. State labels cover playing, paused, loading and
  browser refusal without focus stealing, dialogs or toast spam.
- Use the existing player/session APIs; Couch uses session play/pause so Resume
  respects intentional music pause. The active practice owner wins over its parent.
- Custom gameplay bindings win conflicts. Ignore typing/editables, composition,
  modifiers, key repeats, hidden/background pages and higher-priority handled input.
  Add a default-on advanced shortcut toggle without a library/IndexedDB migration.
- Exclude explicit transport clicks from remembered-menu autoplay handlers, so a
  Pause/Next click cannot start music first. Include controls in Versus navigation.
- Verify held keys, controller seats, checkpoints and gameplay state are unaffected.

## M4–M6 — music direction, auditions and decisions

### 25 September — next licensed auditions and acquisition routes

The source-research round is complete; acquisition, listening and admission are
separate next steps. It downloaded no music and granted no musical approval.
For these new candidates, Content ID remains **unknown** and
`recordingModeEligible` stays **false** until exact-recording video permission and
acceptable Content ID status are verified. Keep all earlier user feedback and
rejected/held source evidence below.

| Direction / exact recordings | Authorized acquisition and licence | Selection limits |
| --- | --- | --- |
| Metal — David KBD: **Grave Rot Requiem**, **Bone Grinder's Ballad**, **The Slicing Strain**; reserve **Devoured by Darkness** | [Purgatory vol. 3 creator itch.io page](https://davidkbd.itch.io/purgatory-vol-3-extreme-metal-music-pack), CC BY 4.0. Use the legitimate free Download Now flow for `DavidKBD-01 - Grave Rot Requiem.ogg`, `DavidKBD-05 - Bone Grinder's Ballad.ogg`, `DavidKBD-06 - The Slicing Strain.ogg` and reserve `DavidKBD-04 - Devoured by Darkness.ogg`. | Whole recordings only; the separately listed mini-loops do not count as extra compositions. Paid WAV archives are not required. |
| Metal — David KBD: **City Limits Crash**, **Defiant Descent** | [Reckless vol. 2 creator itch.io page](https://davidkbd.itch.io/reckless-vol-2-punk-metal-music-pack), CC BY 4.0. Free individual files are `DavidKBD-01 - City Limits Crash.ogg` and `DavidKBD-03 - Defiant Descent.ogg`. | Loopable action cues; measure actual decoded duration and review repetition across gameplay sessions. |
| Synth — David KBD: **Electric Pulse**, **Retrochrome Nights**, **Vapor Trails Pursuit**, **Synthetic Power Surge** | [Electric Pulse creator itch.io page](https://davidkbd.itch.io/electric-pulse-synthwave-retro-futuristic-music-pack), CC BY 4.0. Use its free individual `-full.ogg` files numbered 01, 04, 09 and 10, preserving their exact listed titles. | Exclude `-short` / `-sort` variants. The [Bandcamp edition](https://davidkbd.bandcamp.com/album/electric-pulse-synthwave-retro-futuristic-music-pack-original-game-soundtrack) is listening metadata with all rights reserved, not the acquisition or licence authority. |
| Synth — wekont: **runner2088** | [Exact FMA recording page](https://freemusicarchive.org/music/wekont/single/runner2088mp3/), CC BY 4.0; use its authorized recording download and retain the exact source grant. | Listed 1:37: a short-cue audition, not a 3–5-minute composition. An access failure is not permission to substitute another upload. |
| Synth reserve — Bogart VGM: **RetroRacing Nightlife** | [Exact OpenGameArt recording page](https://opengameart.org/content/retroracing-nightlife), CC BY 4.0; use the listed `Retroracing Nightlife.mp3`, with creator credit and source/Facebook link. | Exact duration remains pending. Do not infer it from the listed 6.5 MB file size. |

Some full recordings are intentionally short, loopable cues. Source loop markers
are not complete-file duration measurements. Audition the whole selected native
file, preserve its hash and licence snapshot, then derive the permitted MP3; do
not pad by repetition to claim the 3–5-minute composition target. Catalogue
entries, duplicate encodings, short variants and mini-loops do not add compositions.
David KBD's [Interstellar pack](https://davidkbd.itch.io/interstellar-edm-metal-music-pack)
remains a CC BY 4.0 reserve with duration metadata pending, outside this first slate.

**Ukrainian leads remain a separate licence and cultural-review lane.** Ivan
Karabyts' [Dysko-khorovod](https://commons.wikimedia.org/wiki/File:Karabitz-dysko-khorovod.ogg)
is a 6:08 clarinet/piano performance by Andriy Diomin and Andriy Bondarenko, with
recording-specific CC BY-SA 3.0 and confirmed Wikimedia permission. Its authorized
route is that file page's original recording. Do not relabel ShareAlike as CC BY
4.0 or send it through the existing CC0/CC BY-only intake without a delivery decision.
Kirill Fandeev's [The Bravery](https://commons.wikimedia.org/wiki/File:Kirill_Fandeev_-_The_Bravery.wav)
(2:31) and [2022](https://commons.wikimedia.org/wiki/File:Kirill_Fandeev_-_%222022%22.wav)
(4:04) have exact Commons recording pages and original-file routes under CC BY-SA
4.0. They are Ukrainian-creator electronic leads; recognizable Ukrainian motifs
are unverified. Neither creator identity nor a geographic label establishes the
requested musical character. All three remain unacquired and unapproved here.

**Delivery holds:** Electric Dreams remains the user's closest musical reference,
but the creator's [no-isolated-redistribution conditions](https://www.scottbuckley.com.au/library/using-this-music/)
hold it out of the public MP3 archive. Any synchronized game-only route requires
its own delivery review. Above All the Chaos retains its tentative user preference,
but exact source/licence/file evidence remains incomplete; the earlier comparison
is not an acquisition approval. No held recording enters this audition intake.

### Ukrainian

Use accepted Nakarada as the quality benchmark; seek six **additional distinct**
compositions with recognizable Ukrainian repertoire, coordinated rhythm sections,
strong hooks and developed arrangements. Licensed vocals and instrumentals may
coexist. Keep broader Ukrainian folk, acoustic and electronic directions active.
A generic folk-metal label, nationality or minor scale is not cultural evidence.
Another Shchedryk arrangement is arrangement variety, not another composition.

Use published licence evidence and authorized sources. No purchases, creator
messages or social-account actions are implied by this work. Preserve these holds:

- Kyle Misko: Hutzulka z Kolomyii, Sahaidachny, Haiduk, Viter Vie, Arkan, Nese Halya
  Vodu. Individual CC statements do not resolve the album's sampled-recording provenance.
- CHUR: Spring the Wonderful / Весно красна and The Pussy-Willow Board /
  Вербовая дощечка are musical references with all-rights-reserved recordings.
- Meraki Caravan — Karchata: Ukrainian folk-fusion lead; paid acquisition and
  ShareAlike delivery review remain. Not established as a heavy-metal match.
- GERAINSAN — Oy Na Gori remix: vocal/master provenance and exact licence unresolved.
- Researched Commons vocal, folk and classical performances remain candidates;
  check repertoire/language, exact performance and arrangement rights. Retain
  Lysenko and ceremonial records in the historical register below; no quota padding.
- NC/ND recordings, conflicting custom licences and unverified sample provenance
  remain outside admission. Keep every researched lead and reason in the register.

### Additional Ukrainian research — 24 September

- The Doox — **Сонце**: the [artist's exact recording page](https://thedoox.bandcamp.com/track/--2)
  links CC BY-SA 4.0 and offers paid acquisition for USD 1. No purchase is
  authorized; acquisition and ShareAlike game-delivery review remain. A label
  SoundCloud CC-BY claim for LIRA conflicts with the
  [label's all-rights-reserved album page](https://zefra.bandcamp.com/album/the-doox-lira-2018).
  Do not extend either page's terms to other recordings or admit from conflicting metadata.
  A read-only scan of all 80 supplied filenames and their ID3 tags found no Doox
  match. No supplied file was changed or publicly cleared by that scan.
- Sascha Ende — **Світло повернеться**:
  [the exact source page](https://ende.app/en/song/13316-svitlo-povernetsia-the-light-will-return-ukraine)
  lists CC BY 4.0. This is an AI-assisted contemporary cinematic Ukrainian vocal
  candidate. Full listening, pronunciation and provenance review remain; it is
  not evidence of traditional repertoire and does not fill that quota.
- Bodg — **WW3**: [the recording page](https://www.soundclick.com/track/14723325/bodg/bodg-ww3)
  is a sourcing lead only. Verify its exact licence version and native recording
  before intake. The artist's Ukrainian identity does not establish Ukrainian
  musical motifs or cultural suitability.

No additional Ukrainian recording in this update is admitted or musically approved.

### 90s Synth — balanced synthwave / outrun and electro

**24 September user decision:** replace the previous synth audition direction
with a balanced mix of outrun/synthwave and rhythmic electro. Prioritize full
arrangements, moving/funky bass, punchy electronic drums, layered synth leads,
memorable early hooks and coordinated rhythms. The later user references below
add a clearer night-drive/dreamwave and cyberpunk focus. Chiptune is an occasional
accent; higher BPM alone does not establish fit. Licensed recordings come first; original
production remains paused at 0/36 approved.

Keep **90s Synth / synth90s** stable. The eventual accepted album is displayed as
**Synthwave & Electro**, with accurate substyle, menu/gameplay, energy and theme
metadata through existing catalogue/album interfaces. No schema migration or
saved-preference reset is planned. M2's Shchedryk opening-theme decision remains.

The official [XPOSED Reloaded listing](https://store.playstation.com/en-gb/product/EP2402-CUSA28098_00-XPOSEDRELOADED01)
does not identify its soundtrack genre or composer. The user's description is
the musical brief; commercial references are not reusable assets.

#### Historical synth decisions — preserved, not admitted

DOS-88 **Race to Mars, City Stomper, Automata v2, Crash Landing** and escp
**Synthasia, Twilight City** are now rejected for the requested musical direction
and excluded from game admission, defaults and the accepted standard shuffle.
Their [immutable preview collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/synth-audition-20260924/)
and archive PR #7/#8 native sources, hashes, licence evidence, decoding and loudness
checks remain preserved. This feedback supersedes their earlier taste-pending
state; technical publication evidence is still valid. The seven earlier retro
rejections and six older metal backups below remain unchanged.

#### M5.a — source-page comparisons and user decisions

**M5.a.1 — rejected on 24 September:** the user listened to the first comparison
and replied, "none of these are exactly what we need, keep searching".
**Just Release Me, DJ Synth Wave / Funk and Neon Night are not accepted for this
direction and must not enter the game/defaults on the strength of their licences.**
Preserve the research and source-player evidence below as historical evidence.
No source audio was acquired, normalized or admitted.

| Recording | Listen on the source page | Published licence / evidence boundary |
| --- | --- | --- |
| Punch Deck — [Just Release Me](https://punchdeck.bandcamp.com/track/just-release-me) | Bandcamp Play/pause; approximately 3:55. Browser preview advanced to 00:04 and was paused. | Exact page links CC BY 4.0; name-your-price original. The browser stream is a preview, not an acquired master. |
| Alex McCulloch — [DJ Synth Wave / Funk](https://opengameart.org/content/dj-synth-wave-funk) | Click the large Play triangle under Preview; it changed to Stop in the browser and was stopped. Source page does not expose duration. | CC0 1.0; uploader Pro Sensory requests Alex McCulloch credit. Preview dj_synth_wave.mp3 and attachment dj_synth_wave_0.mp3 have different paths; exact equality/completeness still needs verification. |
| Fatal Exit — [Neon Night](https://fatalexit.itch.io/neon-night-free-cca-synthwave-music-for-games) | Under Listen Here, activate the embed and press Play, or follow its SoundCloud link. Play/Pause control changes checked. | CC BY 4.0 on itch; SoundCloud reports about 1:20 full duration. This is a complete short cue/style reference, not a 3–5-minute gameplay recording. |

The source checks above verify access/UI behavior, not full listening or musical
quality. All comparison players were stopped after checks. No login, payment or
download is needed for these source-page previews. No external player will be
embedded into the game transport.

The first comparison did not establish an accepted direction. An accepted short
cue may guide style but cannot be padded, looped or counted as a distinct
full-length gameplay composition.

**M5.a.2 — second comparison feedback received.** The user said
**Above All the Chaos "might be the closest"**, but the three videos below are
better and asked to keep searching. This is a tentative preference, not recording
approval. Time Trials 87 and Motion Blur remain unapproved; the user did not
explicitly reject them. Preserve the second-round source evidence.

The search focused on modulated
sub-bass, layered arpeggios, prominent electronic drums and developed arrangements.
A [creator description of Secret Arcade](https://forums.envato.com/t/best-music-for-science-fiction-tv-shows-film-movies/124940?page=10)
gives those concrete production references. Its association with XPOSED is only
an unofficial Switch-release lead, not verified PS4 soundtrack credits.
[Boomopera's Synthpop Supercar](https://boomopera.bandcamp.com/album/synthpop-supercar)
is an all-rights-reserved reference; it is not a free game asset.

| Second comparison | Concrete source basis | Duration / acquisition boundary |
| --- | --- | --- |
| botnit — [Time Trials 87](https://botnit.bandcamp.com/track/time-trials-87) | Full retro-electronic recording on the artist's early-singles collection; exact current artist licence is CC BY 4.0. Musical fit remains unverified. | 3:58 (238.290 seconds in artist metadata). The individual track costs $1; the artist's [Wild Days album](https://botnit.bandcamp.com/album/wild-days-the-early-singles) offers Free Download. Use that legitimate free route if selected; acquisition has not been tested. |
| Nihilore — [Motion Blur](https://nihilore.bandcamp.com/track/motion-blur) | Creator classifies it as upbeat nu-disco and includes it in Synthwave/Frantic collections. Exact current artist licence is CC BY 4.0. | 3:57 (236.769 seconds). The [creator track page](https://www.nihilore.com/latest-tracks/2018/3/24/motion-blur) offers the MP3; no file acquired. |
| TeknoAXE — [Above All the Chaos](https://www.youtube.com/watch?v=4svHIJ3WQ3g) | Creator labels it Rock/Synthwave and describes an intended metal piece developed around sequenced synths. Exact [creator track page](https://teknoaxe.com/Link_Code_3.php?q=1388) links CC BY 4.0. | Official listening video 3:45; creator MP3 offered, not acquired or decoded. |

These source descriptions and durations narrow the next comparison; they do not
prove better musical fit or full-track listening. No new large batch is acquired
until an example is accepted. The second comparison question is answered; the
next search follows the stronger user references below.

Reserves, also unapproved: TeknoAXE's [Edge of Tomorrow](https://teknoaxe.com/Link_Code_3.php?q=1242),
4:48, with a creator-described lower-pitched compressed/gated snare; Nihilore's
[Terminant](https://nihilore.bandcamp.com/track/terminant), 6:31, creator-classified
future/dark synth and aggressive. Both current exact-source licence links are
CC BY 4.0; neither has recording acceptance.

Three Chain Links is a separate research hold: the artist's
[itch album](https://jhmakesgames.itch.io/happiest-days) offers CC BY/game use,
while the [current Bandcamp album](https://threechainlinks.bandcamp.com/album/the-happiest-days-of-our-lives)
links CC BY-SA 4.0. Bind any selected source/file to its actual licence and resolve
the route difference before admission. Do not silently call every version CC BY.
Alex-Productions' current [Hawkins Lab terms](https://soundcloud.com/alexproductionsmusic/80s-synthwave-by-alex-productions-no-copyright-music-background-music-for-video-hawkins-lab)
require a paid game licence despite free-video wording; it is not a cleared free
public-MP3 candidate.

**M5.a.3 — stronger user references, 24 September.** The user said the following
three videos are better references and asked to keep searching:

| User reference | Identified source | What is established |
| --- | --- | --- |
| [City Glow](https://youtu.be/IKPxMQaezpw) | NightframeFM; 23:04; Synthwave Night Drive / Dreamwave / Chillwave | Creator describes warm analogue textures, dreamy melodies, nostalgic pads, smooth grooves and polished transitions. No published tracklist or reuse grant found. |
| [1994 Hacked successfully](https://youtu.be/tyXeh8-U780) | VHS FM Memory; 60:40; Synthwave / Retrowave / Outrun / Cyberpunk / Chillwave | Fourteen chapter entries contain twelve distinct titles; two repeat. Creator expressly reserves rights and describes AI-assisted production under its own commercial licence, which does not grant us reuse rights. |
| [1983 Heavenly Glitch](https://youtu.be/1OdQcWnzkpQ) | Synth Odyssey FM; 104:10; Synthwave / Chillwave / Cyberpunk / Retrowave | Ten named chapters correspond to a roughly 34-minute artist album. Later sequence is unverified; long playback time is not evidence of additional compositions. No reuse grant found. |

These exact video/channel descriptions were inspected as public metadata; no
audio was acquired and no full listening is claimed. Keep these as style
references unless recording-specific permissions are established. The creator's
use of AI does not restart M11 or approve our rejected original candidates.

Working interpretation, grounded in the user's preference and creator
descriptions: layered night-drive/dreamwave melodies and pads, a steady moving
bass/drum groove, memorable synth leads and darker sequenced cyberpunk options.
Retain rhythmic energy and arrangement development; do not reduce the brief to
ambient music, BPM, genre tags or chiptune. This interpretation still needs
musical comparison, not another large speculative batch.

**M5.a.4 — third comparison, feedback received below.** Preserve these source-page
research leads; none is an accepted game recording or a cleared acquired master.

| Recording | Source basis for comparison | Licence / acquisition boundary |
| --- | --- | --- |
| Scott Buckley — [Electric Dreams](https://www.scottbuckley.com.au/library/electric-dreams/) | Creator describes smooth cruising synthwave with warm pads, arpeggios, leads and an electric-piano breakdown at 2:47. | Exact track page links CC BY 4.0 and offers a full-mix MP3. Preserve [creator licensing conditions](https://www.scottbuckley.com.au/library/licensing/) and Content ID guidance; final delivery/Recording-mode review and exact-file checks remain pending. |
| Nihilore — [Glimmer](https://nihilore.bandcamp.com/track/glimmer) | 4:05 (245.368 seconds); creator identifies chillwave, newretrowave and futuresynth. Full source streaming is enabled. | Exact current track links CC BY 4.0; creator's [terms](https://www.nihilore.com/license) allow credited redistribution/adaptation. Preserve authored title. No file acquired. |
| AIRGLOW — [Memory Bank](https://freemusicarchive.org/music/Airglow/Memory_Bank/AIRGLOW_-_Memory_Bank_-_01_Memory_Bank/) | 4:58; original FMA edition, a new artist comparison for the warmer retro-electronic direction. Actual arrangement and fit remain unreviewed. | Exact original FMA page links CC BY 4.0. This is not the [2018 Remixed & Remastered release](https://airglow-stratford.bandcamp.com/album/airglow-memory-bank-remixed-remastered), which currently reserves all rights and has a different duration. Never substitute masters or transfer permission between editions. |

Next reserves if the direction fits: Nihilore's
[The Bright Lights of Summer](https://nihilore.bandcamp.com/track/the-bright-lights-of-summer)
(5:20, retrowave/trap-wave, exact CC BY 4.0);
AIRGLOW's [New Touch, original FMA edition](https://freemusicarchive.org/music/Airglow/Memory_Bank/AIRGLOW_-_Memory_Bank_-_07_New_Touch/)
(4:50, exact CC BY 4.0; FMA marks it non-instrumental, so vocals remain a listening
check); and Scott Buckley's [Neon](https://www.scottbuckley.com.au/library/neon/)
(creator-described moody arpeggios, pads and a lead solo, exact CC BY 4.0).
HOME's [Before The Night](https://midwestcollective.bandcamp.com/album/before-the-night)
remains reference-only: the current official release reserves all rights despite
offering a free download. EVA's Realizations remains held pending primary licence
evidence. No source audio was acquired, normalized, uploaded or admitted in this
research round. Content ID, gameplay-video permission, musical acceptance and
the existing release checks remain recording-specific.

**M5.a.5 — Electric Dreams is the closest reference; keep searching.** The user
answered the third comparison: "Electric Dreams — Scott Buckley is the closest,
keep searcing". Use it as the leading musical reference, not final recording
acceptance. Glimmer and Memory Bank remain unapproved, not explicitly rejected.
Above All the Chaos retains its earlier tentative preference; the three supplied
videos remain stronger user references.

The next focused source comparisons follow this feedback:

| Recording | Concrete comparison basis | Current boundary |
| --- | --- | --- |
| Scott Buckley — [Twilight Echo](https://www.scottbuckley.com.au/library/twilight-echo/) | Approximately 4:47 (286.903 seconds on the creator's [SoundCloud full track](https://soundcloud.com/scottbuckley/twilight-echo-cc-by)); warm nostalgic synthwave with a synth solo in the final chorus. | Exact track page CC BY 4.0; full MP3 offered. The alternate no-lead mix is not another composition. Source acquisition, listening and game review remain pending. |
| Scott Buckley — [Neon](https://www.scottbuckley.com.au/library/neon/) | Creator describes moody 1980s electronica with arpeggios, pads and a synth lead solo. | Exact track page CC BY 4.0; compare the full original mix. No acceptance or acquired master. |
| Shane Ivers — [Neon Noir](https://www.silvermansound.com/free-music/neon-noir) | 5:12; creator describes warm analogue bass, strings, electronic drums and DX7 character. | Musical reference / delivery hold. The track page says CC BY 4.0, but the current [licensing page](https://www.silvermansound.com/licenses) also prohibits standalone audio redistribution. Resolve that conflict before public MP3 admission; do not silently treat it as a cleared archive asset. |

Scott Buckley's [Using This Music terms](https://www.scottbuckley.com.au/library/using-this-music/)
also require synchronisation with other media alongside restrictions on isolated
resale and music-platform uploads. Keep the separate standalone MP3 archive route
on hold until this wording is resolved against the exact CC BY grant. This does
not erase the published credited game-use route: assess game delivery and archive
redistribution separately, without substituting hidden download URLs for rights.

Scott Buckley's [Content ID guidance](https://www.scottbuckley.com.au/library/copyright-claims-release/)
describes a library claim system. If admitted, these recordings must be excluded
from the existing Recording mode while classified as registered; a CC licence
does not establish claim-free gameplay videos. This is compatible with normal
in-game playback after the existing admission checks. No creator was contacted,
no purchase made and no audio acquired in this comparison round.

#### M5.b — replacement pool after direction feedback

Status: **research leads only**, pending an accepted reference, acquisition,
exact-file verification and complete listening. Prepare 6–10 full auditions
following the accepted comparison. The earlier pool below is retained as research
history; its three rejected entries are excluded. Do not promote the remaining
unheard entries merely because they shared genre tags with a rejected comparison.

| Recording | Published licence / acquisition checkpoint |
| --- | --- |
| Punch Deck — [Just Release Me](https://punchdeck.bandcamp.com/track/just-release-me) | **Rejected for musical fit**; retained as research history. CC BY 4.0; name your price |
| Alex McCulloch — [DJ Synth Wave / Funk](https://opengameart.org/content/dj-synth-wave-funk) | **Rejected for musical fit**; retained as research history. CC0; creator-uploaded file; preview/attachment identity unresolved |
| Fatal Exit — [Neon Night](https://fatalexit.itch.io/neon-night-free-cca-synthwave-music-for-games) | **Rejected for musical fit**; retained as research history. CC BY 4.0; free/name your price; short-cue reference, outside the full-length gameplay count |
| Punch Deck — [Fluorescent Color](https://punchdeck.bandcamp.com/track/fluorescent-color) | Current Bandcamp CC BY 4.0; official SoundCloud download advertised, acquisition/account requirements untested |
| Punch Deck — [VHS Heroes](https://punchdeck.bandcamp.com/track/vhs-heroes) | Current Bandcamp CC BY 4.0; official SoundCloud download advertised, acquisition/account requirements untested |
| Punch Deck — [Chrome Funk](https://punchdeck.bandcamp.com/track/chrome-funk) | CC BY 4.0; name your price; actual style needs listening |
| Punch Deck — [Neon Underworld](https://punchdeck.bandcamp.com/track/neon-underworld) | Current Bandcamp CC BY 4.0; darker electronic lead; official SoundCloud acquisition untested |
| Alex McCulloch — [80's Synth Wave](https://opengameart.org/content/80s-synth-wave) | CC0; creator-uploaded file |

Reserve pool: [Nihilore's synthwave/chillwave/outrun catalogue](https://www.nihilore.com/synthwave)
under the creator's [CC BY 4.0 terms](https://www.nihilore.com/license). Preserve
authored titles. The category includes quieter music, so tags are not an energy
or suitability review.

Some older Punch Deck announcements state CC BY 3.0 while the current exact
Bandcamp links resolve to CC BY 4.0. Preserve evidence from the actual acquisition
route and bind it to the recording/hash; do not mix versions silently. Bandcamp
prices on Fluorescent Color, VHS Heroes and Neon Underworld are not free acquisition
routes merely because their licences allow sharing. Creator whitelisting guidance
does not establish claim-free or Recording-mode eligibility.

Karl Casey / White Bat remains outside the public MP3 pool: the
[official FAQ](https://whitebataudio.com/pages/faq) forbids soundtrack distribution
separately from the game. In-game-only use needs a separate delivery review.

#### M5.c — accepted subset admission and release

Status: pending M5.a feedback, M5.b recording acceptance and shared game gates.
Evaluate early hooks, bass/kick coordination, clear percussion, contrasting
sections and sustained gameplay energy. Reject sparse bleeps, excessive
introductions and repetitive arrangements that fail the requested feel. Give menu
recordings a rhythmic but less dense mix; classify every recording individually.

Preserve native sources, exact bytes and trusted rights. Fully decode each file;
measure permitted MP3 derivatives against -16 LUFS integrated +/-1 LU and no more
than -1 dBTP. Complete listening, repeat-session, transition, warning-audibility,
mono/small-speaker and actual-game checks remain required.

Each accepted subset follows archive PR -> verified public MP3 hashes -> separate
game admission PR -> independent review and all six required source gates ->
release-owner version coordination and actual merged-source qualification ->
immutable release and reviewed Pages deployment -> direct playback and cold
offline verification. Record physical-device evidence separately from simulation.
Preserve endless mixed playback, uploads, offline contracts and explicit choices.

Hands-on estimate: several hours for the source comparison; 1–2 working days for
an accepted-direction audition batch; 1–2 working days for integration and
verification. Listening feedback, rights, shared qualification failures, CI and
release waits are excluded. Update this section with decisions, PRs, evidence and
released versions after each milestone; M4/M6 and all other master items continue.

### Metal

Prioritize articulated low/palm-muted riffs, rhythmic rests, bass/kick coordination,
double kick, contrasting riffs and controlled distortion. Reference Valfaris,
Slain, Prodeus and DOOM for articulation and arrangement, not copied melodies.

Ten newer auditions are public; full acceptance remains: David KBD **The Desolation of a
Civilization, Agony Space-deep, God of Darkness, Suffocation**; Alexander Nakarada
**The Dobermann, Folklore, Anemo, Trial of Thorns, Riffs Two, Apocalypse**.
The six older backups remain preserved. Generic folk-metal is not automatically Ukrainian.

The earlier Nakarada pair has a separate
[preview collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-nakarada-audition-20260924/),
merged through archive PR #6 and verified on Pages with exact live hashes and
both tracks playing, Next and Pause. This was a transport check, not complete-track
listening or game/device acceptance. Hosted
[intake run 35952608258](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35952608258)
fully decoded both and measured the permitted MP3 derivatives: The Dobermann
240.096 seconds, -16.00 LUFS / -3.13 dBTP; Folklore 300.539 seconds,
-16.08 LUFS / -1.22 dBTP. Native originals, creator/source/licence snapshots,
exact hashes and pending-review receipts remain in the immutable
[intake archive](https://github.com/mekhovov/revealline-soundtracks-01/tree/40a283d9a2ed2f5a00837ae60273f3884a52e706/intake/archive/metal-nakarada-audition-20260924).

Both recordings are CC BY 4.0 with registered Content ID; intake policy marks
both ineligible for Recording mode. These are candidate previews, not listening-approved tracks, Ukrainian
additions or game admissions. The four David KBD recordings are now acquired and
technically verified through PR #7 / run 35953731494, with a separate
[Eternity audition collection](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-eternity-audition-20260924/)
from PR #8. Exact originals and normalized MP3s are retained. Content ID remains
unknown for these four, Recording mode eligibility is false, and full listening/
heaviness, transition and gameplay review remain. This does not approve the six
replacement candidates or change the older six-track backup decision.

#### M6.a — groove and energy follow-up

**User decision, 24 September:** keep all four Eternity recordings. They are better
and moving in the right direction, but still not rhythmic or energetic enough.
Preserve this positive direction decision and all immutable preview/source bytes.
Full listening, transition, warning-audibility and gameplay acceptance remain.

**Later user direction, 24 September:** YannZ's **They're Going Down** pack and
**Revenge's Waiting** are closer to the required feel. Treat this as a direction
decision rather than game admission. The pack's sustained combat track **Pixel
Damnation** uses six-string distorted bass, guitar and punchy drums; **Revenge's
Waiting** is a 48-second 12/8 boss loop. Keep the latter available as a boss/climax
cue, but do not count it as a complete 3–5-minute gameplay composition or let
short loops inflate the 12–20-recording expansion target.

Prioritize a recognizable recurring riff, coordinated bass/kick accents, rhythmic
rests, clear drum attacks, contrasting riffs and developed returns. Distortion,
genre labels or higher tempo alone do not prove suitability. Verify these
properties by complete listening and repeated gameplay sessions.

| Reference | Documented direction | RevealLine selection target (our interpretation) |
| --- | --- | --- |
| [Valfaris](https://www.valfarisgame.com/) and [Slain](https://store.steampowered.com/app/369070/Slain_Back_from_Hell/) | Heavy metal; Curt Victor Bryant soundtrack | Guitar-led thrash/groove with articulated riffs and coordinated drums |
| [Prodeus — Andrew Hulshult](https://andrewhulshult.bandcamp.com/album/prodeus-original-game-soundtrack) | Creator tags industrial metal, instrumental and synth | Low rhythmic guitars, electronic pulses and contrasting sections |
| [DOOM — Mick Gordon](https://www.gdcvault.com/play/1024068/-DOOM-Behind-the) | Aggressive composition, synthesis, mixing and interactive music supporting gameplay | Memorable pulse and controlled density that leave warnings audible |
| [Broforce — Deon van Heerden](https://www.deonvanheerden.com/broforce.html) | Live percussion, power-metal stings and hybrid boss scoring | Percussion impact and guitar hooks; separate short stings from sustained pieces |

Commercial soundtracks remain references, not reusable assets. These selection
targets are interpretations of documented production directions, not claims
that unheard candidate files already meet them. This content batch does not
require a new adaptive-music system.

Four additional Alexander Nakarada compositions have completed bounded hosted
intake and archive publication through PRs #9/#10. Exact creator downloads,
licence snapshots, native files and complete-file hashes are retained. The
[industrial/thrash preview](https://mekhovov.github.io/revealline-soundtracks-01/batches/metal-groove-audition-20260924/)
remains a listening audition. Published creator metadata describes the four:

| Candidate | Source-page direction | State |
| --- | --- | --- |
| [Anemo](https://creatorchords.com/music/anemo/) | Industrial / Metal / Rock; 4:38, 131 BPM | Published preview; listening pending |
| [Trial of Thorns](https://creatorchords.com/music/trial-of-thorns/) | Death Metal / Industrial; 3:57, 133 BPM | Published preview; listening pending |
| [Riffs Two](https://creatorchords.com/music/riffs-two/) | Thrash / Progressive; 3:18, 159 BPM | Published preview; listening pending |
| [Apocalypse](https://creatorchords.com/music/apocalypse/) | Thrash; 3:37, 145 BPM | Published preview; listening pending |

All four source pages publish CC BY 4.0. Preserve attribution and exact-file
evidence. Creator Content ID registration makes them ineligible for Recording
mode. Technical processing and public previews are separate from musical
acceptance and game admission. These are not Ukrainian additions.

Diversify beyond one artist with four more source-verified leads:

| Candidate | Exact source / acquisition evidence | Remaining |
| --- | --- | --- |
| [Frog — DEgITx](https://degitx.bandcamp.com/track/frog) | CC BY 4.0, 3:54; creator-linked Night archive has 10. Frog.mp3 | Exact-byte acquisition and listening |
| [Burn Out — DEgITx](https://degitx.bandcamp.com/track/burn-out) | CC BY 4.0, 3:59; creator-linked Night archive has 09. Burn Out.mp3 | Exact-byte acquisition and listening; preserve collaborator credits |
| [Rusted Shrapnel — TeknoAXE](https://teknoaxe.com/Link_Code_3.php?q=775) | CC BY 4.0; official direct download; creator describes shredding/chugging with a softer contrast | Exact-file duration, decoding and listening |
| [Six String Shrapnel — TeknoAXE](https://teknoaxe.com/Link_Code_3.php?q=85) | CC BY 4.0; official Metal/Thrash video and direct download | Exact-file duration, decoding and listening |

DEgITx's [official site](https://degitx.com/) links the
[lossy archive](https://drive.google.com/drive/folders/1oxIqYp09HyLnbp-WyL2NJ-wE1HcOxxVD).
Its [licence file](https://drive.google.com/file/d/1XDaSdWVPqagIEwx2-TRsVOrTOFP2yOTX/view)
independently declares CC BY 4.0 with a Covers-folder exception. Preserve creator
credit **Alexey Kasyanchuk (DEgITx)** and, for Burn Out, **Ilija Rogovoi (Belle Morte),
guitars; Roman Yanko (Cardinal Line), bass**, as credited on the
[Night album](https://degitx.bandcamp.com/album/night). Do not extend that permission
to covers or other derivatives.

No audio was acquired for these four leads. Content ID remains unknown, Recording
mode eligibility remains false, and none is classified as Ukrainian. Preserve
exact source/licence evidence with later acquisition. D.E.M.O.N retains its
conflicting-conditions hold.

#### M6.b — groove-first replacement slate

Use the YannZ pair as the next comparison anchor: syncopated low riffs, deliberate
rests, bass/kick accents, forceful drum transients and a recurring hook that stays
clear during play. A candidate still needs full listening; descriptive tags and
tempo are only screening evidence.

| Candidate | Published source evidence | Intended comparison role | Remaining |
| --- | --- | --- | --- |
| [Pixel Damnation — YannZ](https://opengameart.org/content/they%E2%80%99re-going-down-%E2%80%93-game-ost-pack-by-yannz) | Creator-uploaded MP3/OGG under CC BY 4.0; 2:19 loop plus separate intro tag; creator documents six-string bass, guitar and punchy drums | Sustained combat reference | Acquire exact source bytes and licence snapshot; full listening, derivative and Content ID checks |
| [Revenge's Waiting — YannZ](https://opengameart.org/content/they%E2%80%99re-going-down-%E2%80%93-game-ost-pack-by-yannz) | Creator-uploaded MP3/OGG under CC BY 4.0; 0:48, 12/8 loop | Boss/climax cue and groove reference; excluded from full-track target | Same checks; verify repeated-loop fatigue and transition behavior |
| [Soul Ripper — Alexandr Zhelanov](https://opengameart.org/content/soul-ripper) | Creator-uploaded OGG under CC BY 4.0; described as brutal industrial metal | Doom/Prodeus-style industrial comparison | Exact-byte acquisition, duration, Content ID and complete listening |
| [German Industrial Metal — Bogart VGM](https://opengameart.org/content/german-industrial-metal) | Creator-uploaded MP3 under CC BY 4.0 with required creator link; tagged riff, drums, synth and aggressive | Riff/synth coordination comparison | Exact-byte acquisition, Content ID and complete listening |
| [Achilles — Zane Little Music](https://opengameart.org/content/achilles) | Creator-uploaded WAV/MP3 under CC0; full and loopable versions; metal/chiptune fusion | Heavier electronic-metal comparison; chiptune remains an accent | Exact-byte acquisition, duration and complete listening |
| [Heavy Boss Battle 1 — MintoDog](https://opengameart.org/content/heavy-boss-battle-1) | Creator-uploaded loopable MP3/OGG under CC0; 200 BPM | Faster boss-loop comparison | Verify duration, arrangement depth, loop fatigue and complete listening |

Keep [Eternity vol. 2](https://davidkbd.itch.io/eternity-vol2-djentmetal-scfi-horror-music-pack)
as a reserve pool rather than assuming it corrects the first volume's rhythm
feedback. Hold the large Forgotten Dawn rock archive until a hosted, bounded
acquisition can inspect its two complete djent songs without consuming the local
disk reserve. D.E.M.O.N remains excluded from acquisition while its separate
mandatory-rating condition conflicts with the otherwise stated CC BY 4.0 terms.

Next delivery is a small audition archive, not a game admission: acquire the two
YannZ recordings plus the strongest two or three comparison candidates, preserve
exact source/licence evidence, decode and measure them, publish immutable previews,
then request musical feedback. Only a user-accepted full-track subset advances to
the catalogue admission PR. Short boss loops may ship in a clearly labelled cue
collection after loop-fatigue review, but do not satisfy the full gameplay-track
quota.

The four Nakarada previews now use a new immutable collection after independent
intake, original-artifact and publication review. Accepted subsets still require
a separate game PR, exact-source gates,
immutable release and public playback/offline acceptance. Until those pass, the
count of new game admissions remains zero.

Retain the expansion target of **12–20 distinct retro/metal recordings**, normally
6–10 per family, delivered as independently accepted batches.

### Rejected and backup decisions

The following seven retro recordings are rejected for game admission/defaults:

1. Street Punks Fighting to Save the Princess
2. Rock City Ransom
3. Nario Versus Zonik
4. Welcome to Warp Zone
5. Here a Captive Heart Busted
6. The Story So Far (Sega-style FM Synth Remix)
7. Savage Circuitboard

Preserve their public historical previews. Keep the six metal previews as backups,
outside admitted standard shuffle: Vitalezzz's Curse of Moon, Realm of Torment,
Shadows Awaken Within, Unholy Surge; Bogart VGM's German Industrial Metal; and
MintoDog's Heavy Boss Battle 1. Do not label them user-approved replacements.

### Reference library retained

User references: Xpose/Xposed Reloaded, Horizon Chase, Slain/Slain 2, Crimsonland,
Valfaris, Let Them Come, GROOD, Broforce, Prodeus, DOOM and Huntdown. Expanded
references: Streets of Rage 2, Turrican, Unreal/Unreal Tournament, Tyrian, Deus Ex,
DUSK, Amid Evil, Turbo Overkill, Furi, Katana ZERO, Hotline Miami, Time Recoil,
Slipstream and Distance. Ukrainian cultural references include Authentic Ukraine,
Polyphony Project, Go_A, DakhaBrakha and ONUKA. Preserve source links in research
records. These establish musical properties, not redistribution permission.

## M7 — complete UA-FPV collection and private route

- Preserve all **80 source MP3 filenames / 77 unique recordings**, exact uploaded
  bytes and three duplicate aliases. Standard playlist lists each unique song once.
- Dedicated UA-FPV collection is selectable, mixable and repeat-all/shuffle capable,
  with title/original filename and verified source website in Now Playing/details.
- Public admission requires recording-specific redistribution, credits/source and
  applicable artwork permission. YouTube availability and possession are insufficient.
  Keep every unresolved file in the inventory with its blocker; do not silently drop it.
- Publish approved exact MP3s under a new immutable archive batch, preserve all
  alias links and existing archive inventories, then add trusted game catalogue entries.
- Keep streaming by default, optional offline album installation/removal and custom
  playlist references. Roughly 205 MiB unique audio shares the 256 MiB media budget;
  do not force the complete collection offline. Every package stays below 64 MiB.
- Preserve the existing four private volumes and upload guide. Verify the released
  route: Audio/Music library → Backups & album files → Add album file to draft for
  each volume → Save → UA-FPV or My Mix → Play/Unmute. Imports must be additive,
  not replacement. Unpublishable recordings remain usable through that private route.

## M8–M10 — existing contracts to preserve and verify

### M8.discovery — make every published recording easy to find and play

Status: **complete for the public archive.** Archive
[PR #14](https://github.com/mekhovov/revealline-soundtracks-01/pull/14) merged at
`03a31a8b0f6e478b097b4468aaca92dfa275158c`; Pages
[run 36029085098](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/36029085098)
published the historical root inventory of 104 unique recordings. Archive PRs
#18/#19 later preserved that baseline and raised the live root inventory to 128;
PR #25 raised it to 132 and PR #26 raised it to **136 unique recordings across 14
collections** at `824e34e4957ab29b7ef841115f631a579f741fc4`. The root player now searches,
filters style groups, supports
multi-style mixing and sequential/shuffle/repeat playback without leaving the
page. Historical inventories and batch pages remain addressable.

The upload fast path is also public: `intake/add-music.mjs` accepts one MP3 or a
folder, reads common ID3 title/artist fields, creates stable identities and immutable
hash paths, updates generated catalogue/player files, runs verification and can open
a scoped PR. The operator must still provide source, licence, style tags and the
explicit `--confirm-rights` assertion; automation cannot infer redistribution rights.
PR #24 adds the fail-closed structured rights contract for new CC BY and CC BY-SA
rows while retaining narrowly pinned historical compatibility.

The game-native streaming adapter merged through PR #370 and is included in the
published v0.111.0 artifact. Archive76 and primary v0.111.1 public desktop checks
above prove discovery, search and one same-page playback path for the then-current
128-recording archive. The current 136-recording catalogue introduced structured
rights that the released adapter rejected; draft PR #523 repairs that compatibility
boundary, single-element remote transport, stalled-stream recovery and trusted
online-plus-included mixing. Local live-catalogue and browser evidence are recorded
above; public released-artifact acceptance remains pending.
Primary selector acceptance is complete; the remaining style/order/repeat/fallback,
physical-device/controller and cold-offline checks are still pending. Quick controls remain
separate in draft PR #333. Preserve the archive as the canonical source; the game
streams exact immutable objects through its existing two-deck transport. Preserve
every historic root-inventory assertion and the user-visible distinction between published auditions and admitted
defaults.

### Playback and user interface

Automatic / 90s Synth / Metal / Ukrainian / Fusion / My Mix, genre combinations,
custom ordering and All Songs shuffle remain. Repeat-all avoids immediate repetition
when alternatives exist; retain ordered and repeat-one modes. Automatic matches
menu/gameplay scene, authored energy and existing level themes; explicit selection
wins and music never changes gameplay, rewards or earned artwork.

Menu/title/campaign browsing uses appropriate music; Pause, Settings, results and
quick retries preserve gameplay continuity. Honor sound intent, browser unlock,
intentional music-only pause, interruption/background recovery and nested practice.
One owner, at most two decks, default 1.5-second fade and sequential fallback;
prepare only current/next, cancel obsolete requests and release outgoing resources.

Keep simple style/playlist/shuffle controls prominent and advanced tools collapsed.
Display title, artist, source website and original filename. Explain restricted
unavailable actions briefly. Recording mode excludes known Content ID and unverified
video permissions without promising immunity from automated claims.

### Catalogue, creator tools, rights and recovery

- Catalogue v2; library/bundle v3; import v1/v2; shared IndexedDB v5.
- Preserve existing stores/blobs and historical IDs; 123 uploads, 26 custom playlists,
  256 catalogue recordings and 512 assets/references.
- Exact upload bytes, credits, tags, role/energy/themes, custom ordering, audition,
  album assembly, additive import/export and local share packs remain. Preserve
  transactional saves and existing replacement-backup behavior; no new server accounts.
- Atomic metadata conversion only after successful save; concurrent writer checks,
  rollback, frozen-reader messages and unsupported-version/downgrade refusal before
  writes or blob deletion.
- Trusted permissions bind identity AND hash and are enforced by delivery/install/
  export APIs. Renaming bytes or editing credits cannot grant permissions.
- Full backups contain every permitted referenced original exactly. Missing
  unrestricted bytes fail visibly; never silently become URL-only backups.
- Restricted references are explicitly listed before export and after import with
  “Requires online restoration for listed music.” Never label that self-contained.
  Imported references do not authorize network requests or redistribution.
- Retag old catalogue items only through a trusted ID/hash overlay preserving saved
  pins and rights. Full existing-70 curation follows new content, not a prerequisite.

### Distribution and storage

Approved redistributable MP3s belong in the project-owned soundtrack archive with
exact hashes, source/licence evidence, credits and admin download. Keep immutable
existing objects/inventories. In-game-only files remain private until licensed
delivery is approved; no standalone archive/admin download/share audio. Offline
use needs corresponding permission. Hiding URLs, preview hotlinks or external-player
embeds do not resolve licence restrictions.

Retain GameDev Market extraction/delivery holds, Pixabay standalone/context/Content
ID holds, D.E.M.O.N and other conflicting-terms holds; exclude Mixkit music. Do not
relabel ShareAlike/NC/ND material as CC0/BY to satisfy a compiler.

Optional packages <64 MiB; shared installed audio/picture/story budget 256 MiB.
Download for offline, Installed only and removal retain references and uploads.
Keep optional audio out of core precaching except the accepted single Shchedryk
opening theme. Production maximum 650 MiB, scratch 256 MiB and ≥1 GiB free reserve;
use hosted builds/small batches. Never bypass the guard or delete originals/evidence.

## Acceptance and item-by-item delivery

### Music and functional acceptance

Verify authorized exact sources and permissions; fully decode every admitted file.
Permitted derivatives target −16 LUFS integrated ±1 LU and encoded true peaks
≤−1 dBTP. Require honest complete-track and repeated-session listening, transitions,
warning audibility, mono/small speakers and Ukrainian musical/cultural review.
Technical measurements do not establish musical approval.

Reuse meaningful existing regressions: mixed queues, genre/assignment selection,
shuffle/repeat, scenes/retries, missing files, denied unlock, overlapping fades,
mute/background/practice; full-capacity legacy migration, rollback, concurrent
sound/story/picture writers, forged rights/renamed restricted hashes, exact backups,
reference recovery, additive packs, cancellation, budget refusal and removal.
Quick-control tests add keyboard conflicts, controller focus, touch and unchanged
checkpoints/gameplay/SFX. Verify online plus cold offline restart with server
stopped. Physical iPhone/desktop/controller results remain separate from simulation.
Record unavailable or skipped checks honestly.

Repair demonstrated host/parser failures, not speculative assertions. Preserve
pinned-Prettier async generator regression. Run validation, lint, both formatting
checks, production reproducibility and full required production-history tests.
Refresh Field Kit ledger for changed UI/screen/audio fingerprints with scoped review
evidence; preserve historical revisions and unapproved recording status.

### Release sequence for each item

1. Latest accepted main in isolated source; scoped commits/PR and unrelated edits preserved.
2. New audio: archive PR → verified public exact MP3s → game admission PR.
3. Independent review; required preflight + four test shards + build on exact source.
   Skipped/cancelled gates are not passes. Keep all failure and partial evidence.
4. Coordinate version/sequence with **🔥 Releases**. Refresh main before freezing,
   inspect source delta and freshly qualify the actual merged commit.
5. Freeze and independently inspect the original hosted artifact with established
   exact binding, evidence assets and immutable annotated-tag/release protocol.
   Never reuse stale qualification or retag/reupload an accepted immutable release.
6. Separate reviewed Pages selector/controller PR, checks, merge and deployment.
7. Direct public version/root/release/download markers AND actual delivered music/
   controls verification; maintain Journey/Continue, Solo/Versus/Team, Legacy and
   Playground regression behavior from accepted historical releases.
8. Cold offline/device qualification; retain exact reports, limitations and screenshots.
9. Record PR, release, evidence and next action against the stable M-item, then
   continue. Do not hold a ready item for unresolved music families or all 36 originals.

## M11 — deferred original composition brief

**Paused, 0/36 approved.** Preserve candidate scores, native renders, sketches and
rejected Idle Frequency/A/B synchronization feedback. Do not resume the rejected
method merely to satisfy a number. A better method must earn accepted retro,
metal, Ukrainian and fusion pilots before expanded production.

- 36 distinct compositions: 12 Synth +12 Metal +12 Ukrainian. Each family has
  two menu pieces, eight gameplay tracks and two finales.
- Six fusions WITHIN 36: two synth gameplay, two metal gameplay, both Ukrainian finales.
  Alternate arrangements/encodings are not additional compositions.
- Menu 2–3 minutes; gameplay/finales 3–5 minutes; early hook, contrasting section,
  breakdown and developed return with synchronized instruments and original riffs.
- Initial six pilots: Idle Frequency, Glass Highway, Embers at Rest, Furnace Heart,
  First Light, Spring Circuit; then Steel Kolomyika fusion.
- Ukrainian titles retained: First Light; Threads of the Dnipro; Spring Circuit;
  Highland Switchback; Night on the Ridge; Kobzar’s Horizon; Evening Dance;
  City of Light; Reed Current; Harvest Lines; Steel Kolomyika; Pulse over the Dnipro.
- Document regional traditions and modern adaptations. Synthesized bandura/sopilka-
  inspired timbres must be labelled honestly; instrument names alone do not prove authenticity.
- Initial originals remain instrumental-led; language/pronunciation/provenance must
  be verified for vocal textures. Licensed vocal songs are not prohibited by this rule.
- Retain reproducible GPT-authored scores, small procedural patches/DSP, seeds,
  versions, prompts where relevant and source/licence/review evidence. No hosted
  generator, downloaded model or large sample library is an active prerequisite.
  Earlier ACE-Step/BandLab route is superseded and not blocking licensed releases.
- Preserve native-resolution masters, verified lossless FLAC round-trip and 256 kbps
  MP3 derivatives. Never call a lossy-source transcode a native lossless master.
  Archive masters with verified hashes before removing redundant working copies.
- Six volumes of six compositions, each <64 MiB; selective installation under 256 MiB.
- Full completion remains 36 reviewed originals plus working framework/creator/
  licensing/recovery workflows. Licensed additions do not increment original count.

## Historical source and qualification register

The following earlier evidence and research register is retained, with clarified
immutable evidence locations. Its
candidate classifications are historical; the explicit current decisions above
(rejected retro, backup metal, approved Nakarada taste) take precedence. No held
licence or technical receipt becomes listening approval.

## Rights and musical holds preserved

- **Oleg Mazur — [Ой у лузі червона калина](https://soundcloud.com/fm_freemusic/oy-u-luz-chervona-kalina-the-red-viburnum-in-the-meadow-ukrainian-patriotic-march-by-oleg-mazur)
  and [Prayer for Ukraine](https://soundcloud.com/fm_freemusic/bozhe-velikiy-diniy-prayer-for-ukraine-spiritual-anthem-of-ukraine-by-oleg-mazur):**
  creator CC-BY leads remain held for an exact authorized original and licence
  version. Hypeddit currently asks for SoundCloud connection, comment, like,
  repost and follow; none are authorized or performed. Prayer is a solemn/menu
  possibility, not presumed action music.
- **[Mark Wilson X — Carol of the Bells](https://freemusicarchive.org/music/mark-wilson-x/single/carol-of-the-bells/):**
  [creator CC BY 4.0 statement](https://soundcloud.com/mark-wilson-x/carol-of-the-bells-royalty-free-cc-by) and approximately 1:21 instrumental metadata remain leads;
  exact acquisition/arrangement review is unresolved after the research reader's
  HTTP 403. Another Shchedryk arrangement does not add a distinct composition.
- **Pixabay [Hutsul Havoc](https://pixabay.com/music/main-title-hutsul-havoc-ethno-action-ukrainian-soundtrack-192015/), [Hutsul Fantasy](https://pixabay.com/music/folk-hutsul-fantasy-132797/) and bandura recordings:** standalone MP3 redistribution is not
  cleared. Hutsul Fantasy is credited to `_Music_for_Creators_`, not Rockot.
  Keep these outside the public archive unless recording-specific permission
  resolves delivery. Do not substitute preview hotlinks for permission.
- **Six Lysenko piano performances:** Couranta, Valse of Farewell, Barcarole,
  Dream op. 12, Song of Love and By a Cradle retain their documented Lviv
  Conservatory / Wikimedia Ukraine recording provenance and **CC BY-SA 3.0**
  status. They are held for a separate share-alike audiovisual delivery decision;
  do not relabel them as CC BY to pass the compiler. The exact file, pianist and duration table remains below. Their composition /
  edition clearance and classical context remain separate from recording rights.
- **UA-FPV:** possession and YouTube availability do not establish public MP3
  redistribution rights. Keep the existing private packs and upload guide; no
  outreach or new public admission is implied.
- **Generic geographic titles:** Holizna's _Ukraine_ and similar labels alone do
  not establish Ukrainian musical motifs. Do not use them to fill a numeric quota.

### Documented Ukrainian classical fallback — held

These six Mykola Lysenko piano recordings have recording-specific CC BY-SA 3.0
permission from the Lviv Conservatory / Wikimedia Ukraine collaboration. Yuriy
Bulka made the recordings. They are not CC0/CC BY and must not be relabelled to
pass the current admission compiler. Share-alike audiovisual adaptation terms
need a separate delivery decision. No media has been downloaded or auditioned.

| Recording                                                                                                                                                                               | Pianist               | Published duration |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------ |
| [Couranta, Ukrainian Suite](https://commons.wikimedia.org/wiki/File:Lysenko-Suite-02-Couranta.ogg)                                                                                      | Lesia Lemekh          | 3:34               |
| [Valse of Farewell](https://commons.wikimedia.org/wiki/File:Lysenko-Valse_of_farewell.ogg)                                                                                              | Zenovija-Anna Danchak | 3:55               |
| [Barcarole](https://commons.wikimedia.org/wiki/File:Lysenko-Barcarole.ogg)                                                                                                              | Olha Bilas            | 3:09               |
| [Dream, op. 12](https://commons.wikimedia.org/wiki/File:Lysenko-Dream_op._12.ogg)                                                                                                       | Iryna Posviatovs'ka   | 4:22               |
| [Song of Love](https://commons.wikimedia.org/wiki/File:Lysenko-Song_of_love.ogg)                                                                                                        | Olena Havjuk-Sheremet | 3:12               |
| [By a Cradle](<https://commons.wikimedia.org/wiki/File:Lysenko-Lullaby_(%C2%AB%D0%9F%D1%96%D1%81%D0%BD%D1%8F_%D0%BF%D1%80%D0%B8_%D0%BA%D0%BE%D0%BB%D0%B8%D1%81%D1%86%D1%96%C2%BB).ogg>) | Zenovija-Anna Danchak | 5:01               |

Dream's source identifies its folk-song basis, «На солодкім меду». The collection
is documented Ukrainian classical piano music, not an energetic folk-electronic
album. Its composition/edition clearance and gameplay context remain separate
from recording permission.

### New optional ceremonial lead — not an admission

[Luke Minovych Horenko — Ще не вмерла Україна](https://commons.wikimedia.org/wiki/File:%D0%9B._%D0%93%D0%BE%D1%80%D0%B5%D0%BD%D0%BA%D0%BE_-_%D0%A9%D0%B5_%D0%BD%D0%B5_%D0%B2%D0%BC%D0%B5%D1%80%D0%BB%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D0%B0.ogg)
is a creator-published synthesized instrumental recording under **CC0**, dated
27 March 2020, with a directly linked authorized original. Source metadata gives
93.214 seconds and 4,233,544 bytes; these have not been verified against acquired
audio. [Ukrainian government composition history](https://www.kmu.gov.ua/news/247989866)
identifies Verbytsky's music and Chubynsky's text.

Hold it for sound quality, composition/arrangement and cultural-context review.
It is an optional ceremonial/menu possibility, not a substitute for the requested
energetic Ukrainian repertoire. The US Navy rendition is the same composition and
must not be counted again. No audio was downloaded or auditioned during this lead's
research.

## Public verification records

[Reports retained on PR #321 at immutable source e6a766a](https://github.com/mekhovov/revealline/tree/e6a766abce745e1993c53a2652d8e03e50e7a5e5/docs/verification/core-soundtracks-2026-09-24) record
exact public bytes/hashes, deployed commit/run identities and limited desktop
browser observations. Those evidence files are not included in this docs-only PR
and are not yet on main; retain their immutable PR source links until admission merges. The first Ukrainian HTTP probe incorrectly required the
hidden `.nojekyll` Pages control marker to be publicly served and got HTTP 404.
That failed attempt is retained. The corrected probe excludes only that marker
and requires every runtime asset, MP3 and public metadata file to match. It does
not count the control marker as an HTTP pass.

## Historical qualification evidence — retain

- Archive failed intake runs **35943657893**, **35943774127** and **35943850666**:
  three source filenames differed from creator download links.
- Run **35944115394** passed 13 recordings and rejected _Angry Bullfrogs Riding
  Motorbikes_ below the 60-second floor. It was excluded; the gate was not waived.
- Run **35944483804** encountered source HTTP 502. Fresh run **35944843598** at
  `4e9e572848848a314cd48f31a290b83850ee6b65` passed all 13. Artifact **10786113658**
  has ZIP SHA-256
  `0b95238aa7bb27a89b12864f35ac1df850e7a69dae5b7fea3257a764ebf58f5c`.
- Source/derivative archival commit **`9e386c9c489bd193c830cd60ac6f26e7553dc335`**
  preserved all 13 MP3s, native originals and snapshots. Hosted verification
  **35945506601** checked the archive's then-total **83 recordings / 412,480,317
  audio bytes**. This is an archive count, not the game's built-in count.
- Game qualification **35944418013** at
  `913306a736443959b4b8ff913c0976093a2b06bb` failed before source validation because
  two inherited diagnostics fixtures exhausted mocked Git responses in
  `publishing/utility/test_upload_diagnostics.py`. Later gates were skipped, not
  passed. The independently reviewed fixture-only PR #322 was accepted at
  `d0c73b4723798f6490f2680a59fd8d8a59983ac1`; the soundtrack branch was refreshed
  onto that fix. Current exact-head progress is reported above.
- Four local archive-builder tests were blocked by the existing **1 GiB free-disk
  guard**. Do not bypass it or count blocked checks as passes. Use hosted audio
  acquisition, builds and actual-byte verification while local reserve is low.
- Ukrainian technical run **35945483057** passed the prepared Nakarada recording.
  It provides no full listening, instrumental-content or cultural approval.

Physical iPhone/desktop listening and cold offline checks remain distinct from
automated or simulated checks. No reviewer names, approval timestamps or musical
acceptance may be inferred from technical success.
