# Creator reliability and hosting decisions — 15 October 2026

The user authorized implementation of the recommended remaining work, chose **desktop browsers
first**, and requested **GitHub Pages** hosting. This execution record supersedes the proposed order
in the October 1 review and the old September hosting-first queue. It does not replace historical
acceptance receipts or claim that every original phase is complete on the current build.

## Source and delivery

The media branch was rebased without conflicts onto `da0b0108206a0270b4b870e747f2d1bc0e6695cb`, the
GitHub main revision confirmed at the start of work. The shared Team/Duel checkout and its local
files were preserved. Implementation continues in a local managed worktree because the old media
worktree's Git database lives on a mounted network drive. Before opening the PR, the branch was
rebased again without conflicts onto fetched main `4244ece94c25c9e5fb23391e62c3db269a6c999e`.
[PR #1347](https://github.com/mekhovov/revealline/pull/1347) merged as `d6b0cae9df77688f75992279f8cdc181f4f84bcd`.
The first Pages run failed its former size guard. A subsequent main publication succeeded:
public identity `9b416b2c0e27f40cf5adfa3b93a1477382ecef4f` includes the fix. No new immutable
release or public-site upload journey is claimed. The [browser acceptance record](creator-browser-acceptance-2026-10-15.md)
confirms actual upload, generation, installation, victory playback and separate-origin transfer.

The [follow-up acceptance and correction](creator-follow-up-acceptance-2026-10-15.md) rebased onto
`859d5cfc927daff2a350318b2325486a58959648`, completed single-image Solo/Duel and Studio Back/Forward,
and exercised a 50 MB video. It found and corrected poster/range/pairing choices resetting after
video reconversion, together with unstable generated layouts during those edits. The corrected
large video passed cancel/retry, exact-frame/range review, download, installation and Solo completion.
The new correction awaits its own protected publication.

The current `.github/workflows/publish-main-pages.yml` already publishes protected main. Reuse it;
do not add a second publisher or restore retired archive workflows. The retired Pages playbook is
stale relative to that active workflow and the user's current hosting choice. A successful source
PR, a pending deployment, a verified public build and an immutable download are separate states.

GitHub Pages hosts static HTML, CSS and JavaScript. It can deliver the game, creator and community
client, but cannot run this plan's PostgreSQL, accounts, upload endpoint or validation worker.
The chosen static host therefore does not resolve the backend deployment decision.
See [GitHub's hosting definition](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Current implementation and acceptance

| Item                     | Result / remaining exit condition                                                                                                                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid video upload       | Fixed a reproduced integration failure: intake deliberately copies anonymous Blob bytes, but mobile conversion required `Blob.type`. Conversion now inspects the bounded MP4/WebM header before loading the converter. Empty or inaccurate MIME labels no longer reject valid bytes; a fake MP4 label cannot admit invalid bytes. |
| Regression coverage      | Real owned AVC/AAC bytes now pass through the actual intake/conversion boundary. Additional checks cover absent and misleading MIME labels and invalid containers rejected before converter loading. Native poster decoding remains a separate browser check.                                                                     |
| Current access gate      | Directory/entry tests now assert the local password gate and deferred script types. Community host fixtures use the existing supported-raster inspector rather than a PNG-only decoder. No production authentication behavior is bypassed or changed.                                                                             |
| Automated service checks | All 131 community service tests passed locally. This is not a real deployed PostgreSQL, mailbox or public-account acceptance result.                                                                                                                                                                                              |
| Complete runtime cohort  | The broad run completed with 779 passing and 30 failing tests. After fixture repairs, all eight affected files passed together: 138 tests, zero failures/skips. The earlier broad run remains recorded as a failure; no fresh full-suite pass is claimed.                                                                         |
| Actual browser journey   | Password access is resolved. Paired intake, video-only poster capture, ordinary Solo completion, Replay/Skip, earned-poster reload and actual pack transfer/unfinished recovery passed in the built-in browser. Physical audio and a clean physical profile remain unverified.                                                    |

The focused video/intake/access-entry cohort passed **44/44**. The broad run exposed obsolete
fixture assumptions, a missing authoring dependency and changed document hashes. Two Coupa
picture-preparation cases also failed during that run, then passed without increased timeouts.
After the repairs, all eight affected files passed together: **138/138** at concurrency two.
The final guide-integrity rerun passed **31/31** after the documentation update. Full
`npm run validate`, changed-file ESLint and formatting passed. These reruns retain the actual
byte, hash, ownership and offline assertions; they do not relabel the earlier broad run as green.

The baseline regression was independently reproduced from `da0b010820`: the 173,394-byte owned
AVC/AAC fixture became an anonymous intake Blob and was rejected with “Choose an MP4 or WebM video
for mobile preparation.” The fixed converter produced a 172,550-byte MP4. This establishes actual
container conversion, not native browser decoding or an installed campaign win.

## Execution order and dependencies

1. **Current creator journey:** finish ordinary single-image, paired image/video and video-only
   creation; actual download/import; install; unfinished recovery; legal completion; exact poster
   and video controls. Include Studio Back/Forward and a representative multiplayer case.
   The normal password unlock and paired creation/play/transfer/recovery and video-only creation/play checks now passed.
   Single-image Solo, both Duel seats/rematch and saved Studio Back/Forward now passed.
   Complete current-build Team browser play, multi-mission continuation and cross-browser cases.
2. **Useful generated gameplay:** review a small sample for obstacle/enemy pressure and repetition.
   Six families and twelve bounded variants remain implemented. Automated routes establish exact
   feasibility; they cannot grant human enjoyment or balance approval. Scope additional variants
   only from observed shortcomings.
3. **Representative storage pressure:** exercise a large video and batch, cancellation, export and
   recovery on disposable data. An owned 30-second 1920×1080 diagnostic AVC/AAC video was prepared
   locally for the browser check. Actual Node conversion passed: 51,893,544 input bytes became
   51,887,276 bytes in 1.75 seconds, with a 513,458,176-byte peak resident process size reported by
   the operating system. The output retained 30-second 1920×1080 H.264 video and mono AAC audio;
   its MP4 metadata precedes the media payload. This measures converter-process memory only, not
   browser peak memory, batch storage, cancellation or decoded playback.
   The follow-up browser check now passed actual 50 MB inspection, cancellation/retry, custom frame
   and playback range, export, installation and completion. Browser peak memory, 12/50-image
   batches and quota/failure recovery remain open.
   Do not fill the user's disk or damage existing player data to manufacture a quota result.
4. **Desktop compatibility:** prioritize the built-in browser, then available desktop Safari/Firefox
   environments. Record actual versions/formats and outcomes. Browser availability, permissions
   and normal authentication must be established before claiming a pass. Mobile remains deferred
   by the user's desktop-first choice, not implicitly supported.
5. **Static delivery:** submit the verified fix and use the existing main Pages publication path.
   Record the exact deployed source and actual creator behavior when accessible. A hosted build can
   handle distribution qualification without creating another large local artifact.
6. **Public community pilot and operations:** select a backend host, email delivery, test accounts,
   operator and isolated restore target. Run actual two-user publication, interrupted upload,
   moderation and backup restoration together before opening public submissions. No Docker
   executable or selected backend environment was available in this local session.
7. **AWS and exhaustive failure experiments:** deferred unless the backend selection requires AWS.
   Shared S3-compatible rehearsal is not real AWS permission/recovery acceptance. Real browser
   quota exhaustion, database corruption and process-memory limits remain separate qualifications.

## Completion language

The original local feature phases have released implementations and dated acceptance; a newly
reproduced video-intake regression means “already implemented” must not be used to close the
current journey. Public community phases have service/client implementation but no accepted live
launch. Keep unresolved browser, backend and human-play work open. Do not turn missing environment
evidence into speculative feature work, skip tests, silently raise limits or claim all phases done.

## Effort and unresolved dependencies

These are planning estimates, not promised completion dates. They exclude fixes discovered during
acceptance and time spent waiting for CI or access.

| Work                                                  | Estimated hands-on effort                                    | Dependency / consequence if deferred                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current creator journey and generated-gameplay review | Half to one day on one fixed build                           | Access is resolved and the video/transfer checks passed. Single-image, Studio history and Duel passed; Team, continuation and human balance review remain.                 |
| Desktop browser matrix                                | One to two days for a bounded Chromium/Firefox/Safari matrix | Available desktop browser sessions and codecs; no broader support claim before the actual runs.                                                                            |
| Large-video browser storage and recovery              | Half to one day                                              | Disposable browser profile and sufficient free space; single-video browser flow passed; batch/quota and peak-memory limits remain unverified.                              |
| Static release batch                                  | CI/deployment queue dependent                                | Protected-source checks and deployed identity verification; a merged PR is not a successful Pages deployment.                                                              |
| Public-store pilot, moderation and restore            | One to two days of acceptance after setup                    | Backend host, email delivery, test accounts, operator and isolated recovery target; Pages alone cannot enable public submissions. Setup is not estimated before selection. |
| AWS-specific qualification                            | Half to one day after scoped access, only if selected        | Deferred; a filesystem-backed host does not need AWS.                                                                                                                      |
