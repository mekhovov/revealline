# Implementation evidence and remaining gates

This is a staged implementation of the approved unique-content/offline plan. It
does **not** certify unique current artwork or physical-device offline support.

## Baseline

The implementation worktree was rebased onto freshly fetched `main` at
`2f2c90fba39c4d9a864071d61aecb662ecc540f0` (package version `0.132.1`). The original
checkout was preserved. An independent checkout of that exact revision passed
`npm run validate` and `npm run build`; its distribution had 1,299 files.

The unchanged full test run was interrupted after disk space became constrained;
it is not a passing full-suite result. Before interruption it reported these
existing failures:

- `actor-appearance-solo-host.test.mjs:409`: modified Custom pack selector action
  did not settle within the fixture timeout.
- `actor-appearance-team-host.test.mjs:121`: imported Team actor ownership expected
  zero requests but observed 24.
- `authored-mode-entry-host.test.mjs:240` and `:307`: four Team mode-departure cases
  rejected a picture fetch outside their registered fixture originals.
- `backup-content-feedback-host.test.mjs:111`: held-backup blur feedback failed.

A separate targeted run in that exact unchanged checkout also reproduced both
`team-journey-next-host.test.mjs` failures observed during integration: imported
mission IDs expose Next, and foreground cancellation resets Skip's confirmation
label differently from the fixture expectation. The exact-baseline comparison is
retained in `/tmp/revealline-exact-baseline-team.log`; the new host suite passed
130 of 132 tests with only those two existing failures.

Local logs are retained as `/tmp/revealline-content-baseline-{validate,build,test}.log`.
Only this task's disposable baseline build output was removed. No source,
published release or user checkout was deleted.

## Implemented foundation

1. **Inventory and preservation:** reproducible complete owner/artwork/physics
   reports; independent lifecycle classifications; Archive browsing retains
   existing IDs, exact historical routes and source factories. The default Solo
   and Versus browser shows 252 current entries, 33 archived entries are available
   separately, and All editions retains all 285 previous browsing identities.
2. **Design pilot:** five new tooling-only gameplay identities, explicit decision
   and artwork briefs, neutral board comparisons, recorded engine-input/replay
   probes and a playable Solo/Versus/Team harness with difficulty controls. No
   existing gameplay clears or reward assignments are rewritten.
3. **Package/install foundation:** generated v2 chapter catalogues and verified
   snapshots; a nine-mission Solo starter; archives, tools and recordings excluded
   from All current gameplay; direct in-game download/install controls; confirmed
   size selection followed by automatic verification and launcher preparation;
   bounded same-session retry; no automatic transfer consent after reopening.
4. **Repair and ownership:** actual launcher-byte integrity checks, safe activation
   using the existing profile writer/journal/flight safeguards, and official-file
   repair bypassing a corrupt cached response. Missing mission packages open the
   consent flow; ordinary worker requests cannot silently download missing assets.
5. **Independent Solo runtime:** the publisher emits lightweight browsing metadata
   and complete per-pack runtime snapshots. Solo boots only Horizon and loads
   another pack after its download is approved. Original campaign identities,
   mission ordinals and full-project appearance authority remain unchanged. Versus
   and Team entry points are optional runtime packages; shared compiler and replay
   helpers remain in core. The other mode browsers still use complete route sources
   inside their optional packages.
6. **Played dependency retention:** deliberate play pins the complete verified
   official chapter closure under the same storage lock as removal. Passive
   previews do not pin packages. Deselecting a played chapter cannot remove its
   runtime snapshot or original pictures. This is intentionally conservative:
   precise save/replay-aware reclamation is still a separate qualification gate.
7. **Cold bookmark recovery:** missing optional mode documents and archived route
   bootstraps reach the cached consent screen before the host needs them. Exact
   URLs are preserved; the confirmation resolves only a published destination.
   Separate checkpoints protect previous download choices, and verified additions
   are remembered for updates to the matching installed edition. See
   [bookmark recovery and its retention limitation](BOOKMARK-RECOVERY.md).

Focused integration evidence includes a published Solo saved-flight restore after
chapter deselection and reopening with optional runtime/art requests blocked. Team
tests cover preview without pinning, Start waiting for the retention lock, blur
cancelling that attempt, and explicit retry before play. Published Solo provider
tests preserve original full-source actor appearance pins across the new chapter
representation.

Final focused checks: retention/host integration **53/53**; bookmark recovery,
worker and installed-state integration **63/63**; lazy provider and identity
regressions **7/7**; bootstrap/destination publisher checks **5/5**. Counts describe
separate commands and are not a deduplicated whole-repository test total. Logs are
`/tmp/revealline-retention-final.log`, `/tmp/revealline-bookmark-bootstrap-tests.log`
and the provider/publisher commands recorded in their focused test files. Repository
validation passed at this integration; lint and formatting are repeated after the
final bootstrap change. Full-suite baseline failures above remain explicitly open.

The inventory's 386 current mission/mode owners differ from browsing-row counts:
it covers additional modes, revisions and effective presentation ownership.
Current findings remain **160 artwork-sharing groups, 144 equal normalized
physics groups and 123 matching-geometry groups**, requiring design review.

## Browser evidence, 2026-09-26

A local built distribution was tested in the Codex in-app browser. The second
candidate was build `c3d139190236688c3ba0f50aa075686752daa7ebcf00c27db2b1609501861383`
at a fresh localhost origin (port 8878):

- Opened Install & offline play directly from the Solo main menu.
- Downloaded only the starter; automatic verification and active-launcher selection
  completed. The soundtrack status remained 0 of 71 installed.
- Stopped the HTTP server and confirmed connection refusal using `curl`.
- Closed the game tab, opened a new tab at the prepared app launcher, and reached
  the game without the origin being available.
- Started First return, then selected and started the previously unvisited
  Long way home mission; actual gameplay advanced with no browser console errors.
- A missing Border Bloom mission opened chapter selection and its download-size
  confirmation instead of adopting the unavailable mission.
- On the fresh origin, Start opened the starter consent panel; approving its
  displayed 56.6 MiB maximum automatically prepared the launcher and started First
  return after verification. Focusing the downloads iframe did not cancel it.
- With that origin's server stopped and connection refusal confirmed, a new
  launcher tab restored the saved First return flight (timer resumed), then
  started the previously unvisited Long way home mission with its 72% objective.
  No console errors were recorded.

This is a limited desktop browser smoke check. It does not constitute an installed
icon/device test, a completed full Journey, an external-network traffic capture,
or proof of every mode. The IAB tool did not expose its exact engine version.
Follow-up review fixed bounded catalogue cancellation, cancellation during final
verification/activation, and the position of download confirmation above the long
chapter list.

The strict-runtime candidate `ee63b744b95f13b9bde35a6aa1d97d6996ab0618d7f9c01e56a969658e641a62`
was then built and checked at a new origin, port 8879:

- Start displayed a 56.9 MiB confirmation with zero recordings selected; approving
  it automatically prepared the launcher and started First return.
- With the HTTP server stopped and connection refusal confirmed, a new launcher
  tab restored the saved flight, then launched the previously unvisited Long way
  home mission (72% target). The timer advanced and no console errors were reported.
- Direct undownloaded Versus and archived `whole-spatial-v10` bookmarks reached
  their cached, correctly targeted size-confirmation screens without the server.
  No download was approved while the server was stopped.

That visual check exposed a CSS override of the HTML `hidden` attribute on recovery
choices. A final CSS-only correction restores hidden-state precedence; the core
runtime behavior above was already verified. The package report records the final
rebuilt artifact, separately from this predecessor's exact build ID.
Final build `757fd1ac920697fb0bc55ddef275173591f036c3d920855a0297044d141af6b8`
passed build validation (1,362 files); its recovery page was checked at a fresh
origin on port 8880 and correctly hides unrelated starter/all-game choices. The
UI showed its exact 58.6 MiB fresh Versus selection and zero installed recordings.
No optional transfer was approved in that final display check. Full-origin-failure
gameplay evidence above applies to its otherwise identical CSS predecessor.

## Gates still open

- Finish complete pilot runs and evaluate actual route alternatives, failures and
  difficulty before approving designs. Obtain the requested design/artwork review
  before bulk production.
- Produce replacement images, provenance and accessible descriptions, then obtain
  visual approval. The supplementary screening report now covers exact transformed
  copies and perceptual/crop/recolour hypotheses using a pinned decoder and
  comparison implementation. Its current matches are review candidates; no
  replacement composition has been approved.
- Qualify additional chapter splitting inside the optional Versus and Team
  runtimes. Solo now consumes independent chapter snapshots; other modes retain
  their existing full-route browsing/restore contract after their runtime download.
- Remove embedded base64 from new official chapter runtimes while retaining old
  import/export readers. Introduce rendition descriptors and qualify lossless WebP
  across colour, collections, backups and original-byte export before conversion.
- Qualify precise storage reclamation and report bytes actually reclaimable after
  retained saves/replays/collections. Played dependency closures currently remain
  pinned conservatively; a downloaded-but-unused package may be removed. Historical
  definitions and original bytes remain available.
- Complete recovery/quota/eviction, multi-window update/rollback and failed-save
  migration journeys against the exact candidate with zero or partial soundtracks.
- Collect physical iPhone/iPad/Android and desktop installed-app evidence with
  exact versions, screenshots and failure logs. Browser automation is insufficient.

## Release preparation

At scheduling time, public release `v0.132.1` existed and minor release milestones
`v0.133.0` through `v0.141.0` were already reserved. The next unreserved minor slot,
[v0.142.0 — Unique content and offline packages](https://github.com/mekhovov/revealline/milestone/37),
is reserved for reviewed inputs. This reservation does not publish or freeze a
release. Keep the inputs draft/stacked; qualify the eventual exact merged main
revision through the existing serialized release train. Do not edit immutable
published releases or advertise unpassed uniqueness/device-support gates.

See [package measurements](packages.md) for the measured development-build byte
breakdown, dependency closures and remaining packaging limitations. New unique
artwork will change that budget; the earlier 393 MiB projection remains withdrawn.

## Research constraints retained in implementation

The core/content separation follows [web.dev's PWA assets guidance](https://web.dev/learn/pwa/assets-and-data)
and the [Santa Tracker scene-packaging example](https://web.dev/case-studies/santa).
Installation and cache preparation remain separate states. Apple installation help
keeps the [WebKit website-data transfer limitation](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)
visible. Encoding conversion remains gated: the [WebP encoder's exact-transparency
and metadata options](https://developers.google.com/speed/webp/docs/cwebp) must be
qualified against original-byte export and the existing PNG readers before a
conversion can count as a saving.
