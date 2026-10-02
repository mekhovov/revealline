# Completed PWA download rejected during app selection

Investigated 2026-10-02 from the reported Update game failure. Based on freshly
fetched `main` at `b3215dfde8b95cc2b5360cb7243706880e5b277e`, independently of the
iPhone safe-area PR #936 and SIM/community downloads PR #933.

## Confirmed cause

The published [offline catalogue](https://mekhovov.github.io/revealline/offline-content.json)
contains 285 groups, of which the production `gameplaySelection({ all: true })`
selects 108 current gameplay groups. Version: `0.142.4`; downloaded catalogue
SHA-256: `b7a86de73a15278a337e9b426f7fb128113be23895e234e6345947775883290c`.
The live update marker identified build
`207c4a1214c6ecd8313ac66dc13557148e8b1370cfbb1503fd22721a0710b341`
and source revision `b3215dfde8b95cc2b5360cb7243706880e5b277e`.

`validateInstalledEdition` rejected selections above 100 entries in the same
condition as foreign/invalid scope URLs. The downloader allowed the full
selection to finish, then staging failed with the misleading message
“The installed edition is outside this app.” The identical valid URL succeeds
with the first 100 package IDs and fails with all 108. This reproduces the
reported all-game update failure without downloading the artwork again.

## Correction

- One shared, bounded selection validator supports up to 4,096 package IDs,
  each a nonempty string of at most 200 characters. It snapshots arrays and
  rejects sparse arrays, non-string entries and oversized input.
- Edition staging/activation, remembered packages and explicit selection changes
  use that same contract. A completed all-game install can subsequently add a
  bookmarked mode or remove packages without hitting the old 100-entry limit.
- Invalid selections receive a selection-specific error. Existing origin,
  scope, edition identity, build identity, profile migration and writer-lock
  checks remain in force.
- The approved candidate is checked before content transfer starts. Activation
  still validates again before modifying installed state.
- Catalogue generation validates every selectable gameplay group against the
  same contract. Future catalogue growth beyond the bound fails a build instead
  of stranding a player after a large download.

No downloaded bytes, saved progress, preferences or installed-state format are
reset. Once the correction is published, Check for updates can retry and reuse
verified cached content. Removing the icon or clearing website data is not a
repair for this programming error. A currently loaded updater may need to be
reopened to receive the corrected published code.

## Growth and compatibility safeguards

The publisher and downloads screen now call the same catalogue admission
function. It checks all choices, including unselected archives, tools and music,
before offering a download. New groups need no hard-coded downloader menu entry:
their IDs, ownership and dependencies come from the generated catalogue.

- Duplicate package IDs and file paths fail admission instead of silently
  replacing an earlier entry. Reusing the same content hash at different paths
  remains supported, provided its declared byte size agrees.
- Every dependency must exist and stay within its gameplay or soundtrack class.
  Cycles fail admission. Mission references must point to gameplay packages.
- Files use the downloader's own hash and size validator. Its existing 32 MiB
  per-file cap now also applies at build time. A larger asset needs a reviewed
  chunked/streaming format or an explicitly qualified memory-budget change;
  simply raising the cap is not a safe mobile-storage strategy.
- Dependency resolution uses an explicit stack and visits shared dependencies
  once. More chapters or deeper dependency chains do not consume the JavaScript
  call stack. Downloads still reuse verified content hashes and checkpoint
  completed files through the existing store.
- Both existing catalogue formats remain supported. Additional metadata is
  allowed; an unknown format or asset kind fails before transfer. Gameplay paths
  stay edition-relative, while virtual recording IDs retain the rights-aware
  audio-provider path.
- All-current updates include newly published current gameplay **and** retain
  extras the player already selected. Selected-only intent remains explicit,
  even if that selection happens to cover every current package. Newly added
  optional extras and recordings are never inferred from all-current intent.

These checks do not prove an authored package lists every asset it will use at
runtime. When adding a feature, its publisher must register its complete runtime
and asset closure, stable package identity and current/optional classification.
Then verify a cold offline launch into previously unvisited content with actual
outbound requests blocked. Package renames require an explicit compatibility
strategy; they are not inferred from titles. Breaking catalogue changes require
compatible reader rollout and migration before publication. Keep old saves,
replays, pinned content and installed-state readers compatible.

The bounds are deliberate, not promises of unlimited device capacity. Builds
must fail before release when content exceeds a reader contract. Quota failures,
browser eviction and physical-device update/offline qualification remain separate
release checks. None of this makes offline preparation a prerequisite for online
play, and admission does not clear installed files or progress.

## Evidence and limits

A one-off diagnostic used the actual published catalogue with the production
selection and installed-app functions. Its storage and lock callbacks were
isolated in memory; it did not access or modify a player's browser data.

| Observation                             | Result                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| Before: same valid app URL, 100 IDs     | Accepted                                                 |
| Before: same valid app URL, all 108 IDs | Rejected as “outside this app”                           |
| After: all 108 IDs                      | Validated, staged and activated; preparation called once |
| Existing progress sentinel              | Preserved                                                |
| Remember an additional mode             | 109 IDs retained                                         |
| Remove that additional mode             | Original 108 IDs retained                                |
| Foreign origin                          | Still rejected as outside this app                       |
| 4,097 IDs                               | Rejected with the package-limit error                    |

Regression cases are added to `game/test/installed-app.test.mjs` for a same-address
update with 108 packages, competing profile ownership, additions/removals,
malformed and oversized selections, copying the selection, and foreign scopes.
Automated suites remain **WAIVED_SKIPPED_NOT_PASSED** under the existing
owner-authorized `publishing/test-policy.json`. The cases are not claimed as run.

Additional cases in `game/test/download-catalogue.test.mjs` cover 4,096 deeply
dependent packages, cycles, missing and mixed dependencies, duplicate identities,
oversized files, both existing formats, additive metadata, hash aliases and
selection restoration as chapters and extras are added. These are also unrun
under the same policy. A read-only diagnostic of the actual published catalogue
passed admission for all 285 groups and 1,544 file descriptors; its largest file
was 12,358,446 bytes. The all-current selection resolved 525 deduplicated gameplay
files without selecting recorded music.

Required lint, formatting, repository validation, whitespace checking and full
in-memory build inspection passed. The [build summary](evidence/update-package-limit-20261002/build-summary.json)
pins the generated manifest and changed runtime assets. This is not a ZIP,
Pages publication admission or a completed physical iPhone
update or a full offline-download test. After publication, verify the installed
app finishes the same all-game update and retains its existing progress.

Schedule as a separate input to the existing v0.150.0 aggregate. No new release
number or frozen release modification is part of this fix.
