# Combined creator feature acceptance

This record qualifies the media-to-campaign implementation as one source feature. It combines
the previously stacked image, batch, video, publishing, store, Versus, Team, and bounded media
editing candidates. The earlier phase records remain detailed provenance; they are not separate
release claims.

## Released identity

- Merged framework source: PR #465, merged 25 September 2026.
- Creator hardening: PR #564, merged as
  `5d6c97c850a648c5ebe93d3cf57731aeb67d0bbb`.
- Creator baseline release: `v0.141.0`, frozen from that exact creator-hardening source.
- Current stable release: `v0.141.2`, frozen from community-hardening source
  `12978e5fd3fe0ce70bbee96aa543f569f64622d4` and selected on Pages by PR #677.
- Creator-baseline predecessor preservation: Archive 94 publicly preserves `v0.132.5`.
- Creator-baseline production selector: PR #673, merged as
  `44a6ce672632a2d30cbf94374b172e213b75063c`.
- Production Pages: deployment `6679678040` from workflow run `36246645007`, completed
  successfully. Its public audit authenticated 1,877 files and 630,364,265 bytes with zero
  failures. Built-in-browser checks found no browser errors on ordinary gameplay, Creator, or Team.

The released source contains no uploaded creator image or video fixtures. Its largest new source
asset is the pinned, licensed Mediabunny browser module; generated distribution bytes remain release
artifacts rather than source inputs.

## Post-release continuation

Community hardening merged through PR
[#675](https://github.com/mekhovov/revealline/pull/675) as exact source
`12978e5fd3fe0ce70bbee96aa543f569f64622d4` and is published as stable
[`v0.141.2`](https://github.com/mekhovov/revealline/releases/tag/v0.141.2). It adds a same-origin
administrator report-triage page, production Compose/preflight contract, exact interrupted-tus
fault proxy, source-to-target recovery rehearsal, and bounded deployed two-user journey over the
already released community API. Exact-head local coverage passes 556/556, including the direct
63/63 service suite. Live infrastructure execution remains a separate acceptance record. See the
bounded [v0.141.2 publication evidence](v0.141.2-publication-evidence.md).

## Included behavior

- One or many images generate deterministic missions and campaigns from six layout families and
  twelve bounded variants. Every current variant has collision obstacles and one supported moving
  enemy. Review cards show the generated enemy and obstacle counts.
- Actual compiled mission identity, difficulty, steering policy, and runtime seed are replayed
  before approval. Gameplay changes invalidate that evidence.
- Paired image/video and video-only missions retain exact poster and story dependencies. Victory
  keeps the earned poster and offers Play, Skip, and Replay without blocking Next.
- `.rlpack` export, import, immutable installation, unfinished-attempt recovery, earned pictures,
  exact updates, and reference-aware installed-media offload/reinstall preserve edition identity.
  Offload keeps manifests, saves and rewards, detaches only assets unused by another active edition,
  and requires an exact retained recovery package before deleting runtime bytes.
- Account sessions, tus upload, isolated validation, catalog publication, browsing, reporting,
  unlisting, download, update, and offline recovery are implemented across the static client and
  self-hosted community service. PostgreSQL-backed admission limits work across API replicas;
  tus request locks and leased expiry cleanup coordinate across replicas; creator email
  verification and password reset use bounded, injected mail delivery and revoke old sessions;
  concurrent duplicate reports resolve idempotently; report triage is paged and audited. Exact
  blob hashes are authenticated again at download, and database/blob snapshots support verify and
  journal-backed restore.
- All current generated layouts have exact equal-board Versus replay qualification, and portable
  package validation repeats that proof. Installed project-backed editions now register as Custom
  Versus campaigns in the real two-board host, retain their compiled level, runtime seed and
  verified difficulty, own their exact artwork, record edition-scoped clears and pictures, and
  support Retry and Next. Creator picture progress also passes scoped export/inspect/restore.
- Purpose-built Team layouts support direct verified Couch file launch, immutable SHA-256
  installation, fresh-session library discovery, replay-verified launch, exact unfinished-attempt
  recovery, stale-tab rejection and edition-scoped legal-clear progress. The bounded binary Team
  media format binds one exact picture per level and an optional inspected victory video to the
  complete installed edition identity. A
  browser creator generates and verifies the cooperative pack, normalizes exact reward derivatives,
  shows each media binding/range and shared-storage requirement, invalidates stale approvals, and
  installs or exports the reviewed `.rlteammedia` bytes. Team payloads participate in the shared
  256 MiB managed-media ledger through recoverable pending/committed claims.
- Playback ranges and decoded-frame stepping stay separate from physical editing. Physical
  trim/conversion accepts one silent browser-decodable MP4/WebM video track or one AVC plus AAC MP4,
  exports AVC/H.264 MP4, and re-verifies changed bytes, duration, reviewed dimensions, MIME, hash,
  track inventories, decoded audio windows, A/V endpoints and aligned decoded start/end pictures.
  Bounded Balanced and Compact profiles add no-upscale resizing, reviewed bitrate evidence and
  explicit display-orientation checks. The built-in browser has exact landscape, rotated-portrait
  Compact and audio-bearing trim evidence.

## Integrated evidence

- `npm run test:creator-feature`: **544** top-level subtests and **546/546** total
  creator/runtime tests passed for the `v0.141.0` baseline. Its community service suite passed
  **43/43** checks. The later `v0.141.2` exact-head local aggregate passes **556/556**, including
  the direct **63/63** community-service suite. Qualification run `36250777506` used the explicit
  automated-suite waiver, so it has no hosted test total. The `v0.141.0` full runtime run first
  exposed five sparse
  checkout omissions and three injected-host database-model conflicts; the exact owning cohorts
  passed after restoring the release inputs and limiting automatic cross-database accounting to a
  standard browser IndexedDB factory. Explicit managed-store injection remains covered.
- Community Fastify, Better Auth, tus, validation-worker, storage, admission, moderation, recovery,
  account mail, report-race, exact-blob, and store-client coverage is included in that **43/43**
  service result. The decoder-failure regression also proves its opened package stream is closed.
- The current focused Team/shared-ledger/UI cohort passes **43/43**, including exact picture
  normalization, package/install/intake, aggregate quota pressure, abandoned-claim reconciliation,
  storage review and immutable edition accounting. The complete rebased creator cohort passes
  **544** top-level subtests and **546/546** total tests after the installed-campaign continuation repair, unfinished middle-mission recovery addition, offload/audio slices and visible Creator
  Versus continuation fix.
- Installed creator Versus, bundle, qualification, profile-edition and picture durability coverage
  passes **30** top-level tests and **32/32** total tests including nested host checks. The real host
  runs both boards, replays the generated legal route, awards the exact picture, exposes Cleared
  state, keeps its verified difficulty, advances both boards through pointer Next, and restores the
  exact clear and earned picture in a fresh host. Injected asynchronous storage failure either
  commits a receipt-only clear or retains the complete scoped event for Retry/Export.
- The exact navigation cohort that failed on the rebased PR now passes **194/194**. The repair keeps
  the controller Confirm release guard current after a controller starts a race, so a later direct
  touch is accepted after the finite Steam Input echo window. Navigation fixtures now exercise
  controller-authorized menu activation and strict Team file intake with real `Blob` values.
- The focused controller/router overlap with the new `main` short-tap lifecycle passes **84/84**,
  including the actual Steam Deck short-tap host case and native-input echo ordering.
- The exact `fpv91` managed-media continuation retains the reviewed Team picture bytes for current
  play and preserves immutable `fpv58`–`fpv90` attempts. Its bounded 34-policy authority and the
  three current/retained picture cohorts pass **108/108**; unknown `fpv92` still fails closed. The
  two changed shared-media dependencies are bound by review record SHA-256
  `16f3eb26f28eae82f6529c8a872438c216a05d7a905e0fee0b3d6b0e9601e998`.
- Rotated-orientation and physical-transform focused cohort: **50/50 passed**, with **114/114**
  across the expanded video/editor/intake/bundle group.
- The final AAC slice passes **34/34** focused tests. Its owned six-second 640 × 360 AVC plus mono
  48 kHz AAC fixture was physically converted in the built-in browser over 1–5 seconds. The
  79,176-byte output passed exact-byte identity, aligned endpoints, three decoded PCM-window
  comparisons and visual-boundary checks before the download became available.
- Exact-edition installed-media offload passes **15/15** store tests and **61/61** related
  creator/media checks. Coverage includes physical unshared deletion, shared-byte retention,
  immutable profile/attempt keys, no-recovery refusal, stale-generation refusal, interrupted journal
  recovery, Web Lock serialization and network-free exact reinstall.
- The focused story, media-intake, video-bundle, creator-install, community-offload and managed
  storage recovery cohort passes **126/126**. This covers active-page disposal, missing-original
  diagnostics and refusal, exact retained-package recovery, transactional storage rollback and
  quota-failure reservation cleanup.
- A focused two-picture recovery regression suspends the second mission during its verified route,
  restores and legally completes that exact mission, and binds the completion to its distinct
  picture bytes. Reordering the campaign produces a different immutable edition and attempt key;
  the changed edition refuses the old attempt and loads an empty scoped profile while the original
  profile retains the second-mission clear. The built-in browser also restored and legally completed
  that second mission, retained both clears in the exact-edition progress backup and exposed a
  reload-lobby regression that restarted mission one. The combined candidate now resolves the
  explicit library handoff, first uncleared mission and latest earned reward deterministically. On
  the corrected source the same installed edition visibly reopened with picture02 earned and Start
  launched picture03, the first uncleared mission.
- The built-in browser loaded an exact 810,180-byte local `.rlpack` through a one-edition catalog,
  installed creator edition `6033108fe9e7acc279cb888b19cfccb7033aa9ce20999dc5213b58e282873467`,
  showed its installed and offline-copy state, offloaded its runtime media, replaced Play with
  **Reinstall exact edition**, restored it from the retained package, and opened the ordinary Custom
  player with **Start mission** enabled.
- `npm run validate`: passed for 1,244 files; exact whole-spatial snapshot SHA-256
  `e62ef45089df1bbaea04cceb932949fbe8d29377a4eeefcac8280125006495b3`.
- Exact presentation SHA-256 after the `fpv91` managed-media continuation:
  `b353a6d57e674a257ac6b15bc44ce922c290c826211ea5e93b76bb672ac49807`.
- Root and community-service ESLint and Prettier checks: passed.
- Native formatting, Motion Lab syntax, Field Kit producer check, and Field Kit readiness: passed.
- Root and community dependency audits: zero reported vulnerabilities.
- A local `npm run build` passed for **1,304 files** at source version `0.141.0` before the final
  presentation-only rebase, with distribution SHA-256
  `3fb91ab6f0b4d3cbc7d70c5a750cfaf13ced4c62c94f8b0dc4c78b690c77cc2e`. The authoritative hosted
  qualification, immutable freeze and publication completed successfully from exact source
  `5d6c97c850a648c5ebe93d3cf57731aeb67d0bbb`.
- Built-in-browser evidence in the phase records covers single-image completion, 12- and 50-image
  batches, cancel/resume and splitting, video-only victory playback, and verified silent-AVC trim.
  On the current combined source, a fresh picture generated a visible moving enemy and two collision
  walls, installed under its immutable edition, launched through ordinary Custom play, and exposed
  the saved-attempt Resume action after reload.
- A fresh built-in-browser video run selected the repository's silent six-second H.264 MP4,
  inspected real 10/50/90 percent poster candidates, selected the 0.6-second candidate, generated a
  visible moving enemy and two collision walls, approved, downloaded and installed the exact
  `.rlpack`, completed ordinary Custom play, retained the earned poster after reload, and exercised
  victory Play, Replay and Skip without replacing the picture. The package retained the complete
  original video. A later AVC+AAC run verified browser playback, Play/Replay/Skip and earned-poster
  reload; sound reaching physical speakers, WebM creator playback, Firefox, Safari and mobile
  behavior remain unqualified.
- On installed AVC+AAC edition
  `f976eb92c24b7d0585238b723ae621fd8c0d59c44f146a396e813ac51e7d5bd3`, a repeated legal win
  reached 65 percent with three lives and 14,720 points. **Play** reached active story playback;
  reloading at that point stopped the video and reopened with the exact earned poster, saved clear
  and **Start mission** enabled. No playback resumed without an explicit action.
- The AVC+AAC acceptance download was an actual 237,678-byte `.rlpack`, SHA-256
  `9e7dacb3813351b2eb95747d11d817dbc1bf89c661c52e3d0932ac0a5a4a157c`. Independent parsing
  authenticated every payload with zero trailing bytes, retained the complete 173,394-byte,
  six-second source video and bound a nondefault 1–5 second playback range. The separate
  `localhost` origin revalidated, installed and opened exact edition
  `58b94e7c4c632f1a9fd4f6eb2ff4fa752e2549962246c06392c20c4fa4a17aeb`. An authenticated
  MPEG-2 MP4 was rejected per item before poster, story, generation, approval or installation.
- The same two-mission pack was imported from the actual downloaded `.rlpack` on the separate
  `localhost` origin as immutable edition
  `6033108fe9e7acc279cb888b19cfccb7033aa9ce20999dc5213b58e282873467`. Reload restored the
  unfinished Solo attempt, both legal Solo wins, the selected 0.6-second poster and story controls,
  and the edition-scoped Versus clear. In the physical two-board host, the first mission completed
  with Sunflower while Skyline remained idle; the visible results action named the exact second
  mission, and a pointer click launched both boards on runtime key `media-2-53f1206a11a8`. This is
  separate-origin browser evidence, not a claim of a separate physical browser profile.
- A real 223,097-byte rotated portrait AVC upload was inspected as 360 × 640 and produced three
  poster candidates. The selected midpoint generated a 72 × 36 Twin corridors level with one
  moving enemy, two collision walls and verified Solo/Versus routes; its 0.33 MiB package retained
  one exact PNG plus the complete four-second video. Approval and installation created immutable
  edition `1ba2f4b1430e3a1f27118ccf71c4ad3d1433a7cdaee9d56e1e98b0fb9c948a52`, ordinary Custom play
  started successfully, wrote an unfinished-attempt checkpoint, and emitted no browser warnings or
  errors.
- In the built-in browser on the rebased candidate, Team generation produced two purposeful levels
  and 12 verified configurations. Two actual PNG files became exact 1152 × 576 review rewards; the
  0.04 MiB picture-only package approved and installed as edition `7a8acc000fd1…`. Adding the real
  six-second repository MP4 invalidated that approval, re-inspected the complete video, defaulted
  the explicit 0–6 second range, and produced a 0.11 MiB review with three exact assets. A fresh
  cache-busted visit repeated generation and picture review after the ledger integration and showed
  0.05 MiB of shared managed storage in use with the package ready to install.

## Publication boundary

The static release can ship local creation, portable packages, installed Custom play, offline
behavior, and the community client. GitHub Pages cannot run Fastify or PostgreSQL. Accounts,
uploads, validation jobs, and the public catalog become live only after deploying the included
community service and completing its PostgreSQL/container restart, real database/blob restore,
two-account browser, proxy interruption, TLS/domain/secrets, exact trusted-proxy configuration,
Better Auth mail and account recovery, shared tus locking/cleanup, and isolated media-worker
acceptance.

Installed creator play is accepted locally for Solo and for the real two-board Versus host.
Generated v3 packages retain equal-board qualification evidence; installed Versus revalidates the
exact package before launch and records edition-scoped progress and pictures. Automated host and
scoped progress-transfer tests pass, and the built-in-browser separate-origin import/reload and
visible pointer Next path are accepted. A distinct physical browser profile remains unclaimed.

Verified Team gameplay or media bytes install under the SHA-256 of the complete portable payload.
Fresh Team library visits discover each immutable edition, replay its qualification before launch,
restore exact unfinished attempts, reject stale writers, and retain exact picture identities in
legal-clear receipts. Media editions revalidate every dependency before launch and offer optional
Play, Skip and Replay after a win without blocking Next. The strict package API and playable intake
are included together with end-user assembly and aggregate managed-media accounting. Interrupted
cross-database writes retain a bounded pending claim and reconcile it against the verified Team
inventory on the next review, install or inventory read.

Bounded silent MP4/WebM input and single-track AVC+AAC MP4 can now be physically trimmed or converted
to AVC MP4, with optional Balanced or Compact resize/compression profiles and exact output
verification. Other audio layouts and codecs outside each browser's successful decode probe remain
unsupported. Firefox, Safari, Balanced portrait and physical mobile media qualification remain
unclaimed.

Missing source/runtime originals are accepted at deterministic storage scope: failed items remain
attached to their input, incomplete dependencies cannot be approved, and offloaded media can be
restored only from the exact retained package. Atomic quota-failure rollback is also covered by
injected IndexedDB failures. Deliberate browser database corruption and genuine browser-wide quota
exhaustion are not claimed as end-user browser acceptance.

PR #675 is merged and `v0.141.2` is published from exact merge source
`12978e5fd3fe0ce70bbee96aa543f569f64622d4`. `v0.141.1` remains an intermediate immutable
GitHub release that was not selected on Pages. Archive 95 preserves the replaced `v0.141.0`
edition. Selector PR #677 merged as `34f45503c32479591dcdc36e7236aaa2eb348a2f`, and production
Pages deployment `6680716352` / run `36252239829` passed its public audit with 1,888 files,
630,471,797 bytes, 1,888 attempts, zero retries and zero failures. The public release record,
Creator route and community route resolve to `v0.141.2`. No `v0.141.2` release, archive or Pages
selector gate remains.

The remaining acceptance is environment-dependent: live community infrastructure and the complete
two-user journey need 0.5–1 day after PostgreSQL/proxy/mail/blob infrastructure is available;
Firefox, Safari, physical mobile, physical-speaker and broader-codec qualification need 1–2 days
when those environments are available. Genuine browser-wide quota exhaustion, deliberate storage
corruption and measured peak-memory acceptance also remain unclaimed. Because `v0.141.2` is the
highest published stable release, earlier working allocations are stale. Future candidates require
fresh allocation after checking the open `v0.142.0` through `v0.149.x` ranges.
