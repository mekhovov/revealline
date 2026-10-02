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

Required lint, formatting, repository validation, whitespace checking and full
in-memory build inspection passed. The [build summary](evidence/update-package-limit-20261002/build-summary.json)
pins the generated manifest and changed runtime assets. This is not a ZIP,
Pages publication admission or a completed physical iPhone
update or a full offline-download test. After publication, verify the installed
app finishes the same all-game update and retains its existing progress.

Schedule as a separate input to the existing v0.150.0 aggregate. No new release
number or frozen release modification is part of this fix.
