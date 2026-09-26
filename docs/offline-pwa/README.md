# Offline game and optional recordings

Implementation branch: `codex/offline-pwa`, based on freshly fetched `origin/main`
`23e6129782e08ed826686f137a0989e5f154732a` (0.131.0 source line). The existing
`codex/fpv-redesign` checkout and its uncommitted work were preserved.
The prepared release slot is v0.132.0 because v0.130.0 and v0.131.0 are already
allocated. The candidate package and build configuration are prepared as 0.132.0;
this branch does not publish or tag a release.

## Player flow

For a local packaged preview, run `npm run build`, then
`node scripts/game-cli.mjs serve --root dist --port 8778` and open
`http://127.0.0.1:8778/game/downloads.html`. Use the packaged build for worker tests;
the ordinary source development server is not an offline release. Keep the same
origin and port when stopping and restarting the server to test cached launches.

Open **Game data → Install app · Game and soundtrack downloads**, prepare all
gameplay or selected chapters, verify it, and select **Use this edition in the
installed app**. Install from the stable `/revealline/app/` launcher. The first
preparation requires a connection. Subsequent icon launches select the stored
edition immediately, without waiting for an update request.

The icon and the downloaded game are separate states. On Apple devices, prepare
inside the installed app and use the existing complete backup/import controls to
move browser progress. The launcher offers platform instructions and an explicit
update check. `/app/?manage` opens management without automatically entering play.

Recorded music starts unselected. Download individual existing albums/volumes or
use **Download all soundtracks**. Every complete verified file commits immediately.
Closing or pausing a download preserves those files; resume restarts only an
interrupted file. Music yields to active gameplay and gameplay downloads. A music
failure or removal never changes gameplay readiness or the selected game edition.

Game playback selects local recordings or the procedural score. An explicit genre
or playlist skips missing recordings and explains an empty selection in Audio
settings. The public archive remains an explicit streaming action. Imported music,
playlists, assignments, mute and pause preferences are preserved.

## Storage and dependency model

`offline-content.json` is generated from exact frozen build bytes. It records hashes,
sizes, chapter dependencies, soundtrack groups, original-image offsets inside
official media bundles, and mission-to-group mappings. The inventory currently
covers **1,697 mission entries** across Classic, historical/current Journey and Team.
Every indexed Classic source and authored asset is checked against its shipped bytes.

`offline-inventory.json` classifies every shipped file plus optional recording
metadata and reports deduplicated gameplay bytes, core bytes, recording bytes and
conservative two-edition storage requirements. It is publication evidence, outside
the worker's cache inventory to avoid a recursive hash. The gameplay total is
computed from dependencies; the distribution's historical 568 MiB size is not used
as a download constant. Reachable tools and authored original artwork use a
conservative shared dependency group, so selecting chapters has a substantial
shared minimum.

| Owner | Storage | Lifetime |
| --- | --- | --- |
| Launcher | Scope-specific launcher cache | Only small launcher files; `/app/` worker scope |
| Shared runtime | Existing edition-scoped core cache | At most 2,000 files / 64 MiB; file checkpoints |
| Official chapter/art/music bytes | `revealline-official-content-v1`, keyed by SHA-256 | Shared across editions and download groups |
| Download selections | `revealline-official-downloads-v1` | Incomplete and complete group references |
| Original image lookup | `revealline-official-original-index-v1` | Exact verified bundle offsets |
| Player imports and saves | Existing IndexedDB/profile stores | Existing import limits and recovery mechanisms |

Official chapters mount through existing pack validators and serialize as small
verified references, independently of the 12 imported-pack slots / 48 MiB imported
pack budget. Large official mounts are bounded to two at a time, while downloaded
chapter bytes remain available. Original pictures can be read from verified media
bundles through zero-byte IDB references, without consuming the 256 MiB import budget.
Native and source-mode import behavior retains the existing storage path.

Prepared chapter/save and original-image references conservatively pin their
official bytes. Removing a chapter selection does not delete those pins, player
imports, shared artwork or saves. Consequently removal may reclaim less space than
the original download; automatic garbage collection of obsolete saved-reference
pins is deliberately not attempted. Backups containing official chapter references
need the matching edition's offline downloads before restoration on another device.

All caches share the browser's origin quota. Free-space estimates are advisory;
actual quota errors preserve committed files and working editions. Persistence is
requested only from the visible player action. Integrity verification reads one
bounded file at a time. Background Fetch/Sync is not required.

## Updating and recovery

The stable launcher points at an immutable edition. Checks and downloads are
explicit. Supplemental hashes are shared; runtime files reuse verified hashes
from previous editions and identical files within an edition. Runtime caches
remain independently addressable so the old edition continues working.

Selecting a new edition requires verified selected gameplay, writer locks for both
profiles, no pending backup/external-chapter journal, and a matching source review
from the existing **Bring progress from an earlier release** transaction. The download
screen links to Classic → More → Scores & saves → Saves & loads for this transfer.
Journey receipts keep their existing content-edition stores and separate backup controls. An
incompatible suspended flight, changed source profile, busy writer or interrupted
migration keeps the previous edition selected. A completed migration is invalidated
by another profile replacement or Undo. There is no forced reload or `skipWaiting`.

**Restore previous edition** opens that edition's download screen for verification
and explicit reselection of its preserved profile. It does not merge newer progress
back into an older profile. Music completeness is never an activation condition.

The frozen-release publisher copies only the lightweight launcher to the stable
root and writes its current-edition pointer. Gameplay stays under the immutable
release path. The existing publication capacity checks remain in force. Snapshot
creation now uses the checked-out tree only when it is clean; a dirty checkout of
the selected commit is rebuilt from its Git archive to preserve frozen provenance.

## Verification and publication gate

| Phase | Implementation and evidence | Remaining gate |
| --- | --- | --- |
| 0 — Inventory | Fresh-main worktree; baseline build; generated hashes, ownership, mission dependencies and sizes | Repository baseline has unrelated failures; retained comparisons document them |
| 1 — Installation | Stable manifest/launcher, local active edition, installation guidance; cold launcher URL tested offline | Actual OS icon/window qualification on supported devices |
| 2 — Gameplay downloads | File checkpoints, integrity, pause/resume, official storage, chapter mounting; all gameplay prepared with zero MP3 requests | Physical closure, eviction and quota-pressure journeys |
| 3 — Optional recordings | Independent albums, local playback, procedural fallback, import preservation; focused tests and blocked-host browser checks | Device playback with zero/some/all albums and a partial album |
| 4 — Updates and lifecycle | Explicit checks, hash reuse, journaled migration, writer-lock gates, previous edition, input/wake-lock handling; real A → B and offline rollback | Device background/resume, controller and multi-window qualification |
| 5 — Publication | Frozen publisher integration and build/release checks; evidence retained | Full repository suite is not green; hardware matrix and publishing remain pending |

The final local v0.132.0 candidate contains 1,298 manifest files. Its required core is
46,660,811 bytes across 1,121 files, with zero MP3 files, below the 64 MiB limit.
Deduplicated gameplay is 597,252,702 bytes and the 71 optional recordings total
363,627,890 bytes. The generated inventory records a 611,447,099-byte first-download
peak and a conservative 1,210,535,752-byte two-edition update peak.

See [verification.md](verification.md) for commands, browser evidence and outstanding
hardware checks. Automated tests and an embedded browser are not a substitute for
installed-device qualification. **Do not publish universal installed-app support
claims until that device matrix is complete.**

The implementation follows the separate essential/additional asset model described
by [web.dev](https://web.dev/learn/pwa/assets-and-data), handles full cached media
before range responses as described by [Chrome](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video),
and accounts for [origin storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
and [Apple installed-app storage](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/).
