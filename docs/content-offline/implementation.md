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
chapter list. Those follow-up changes have focused test coverage and require
another exact-candidate browser pass.

## Gates still open

- Finish complete pilot runs and evaluate actual route alternatives, failures and
  difficulty before approving designs. Obtain the requested design/artwork review
  before bulk production.
- Produce replacement images, provenance and accessible descriptions. Add rotated,
  reflected, perceptual/crop/recolour screening and review contact sheets. Exact
  bytes or pixel hashes alone do not prove distinct compositions.
- Implement full independent mode bootstraps and truly lazy chapter runtime
  consumption. The current small flattened route snapshot preserves the existing
  synchronous navigation/progression contract; shared runtime still includes
  other mode hosts and recovery validators.
- Remove embedded base64 from new official chapter runtimes while retaining old
  import/export readers. Introduce rendition descriptors and qualify lossless WebP
  across colour, collections, backups and original-byte export before conversion.
- Complete saved-flight/replay dependency pinning and storage reclamation
  accounting before deleting any historical dependency. This implementation
  retains historical definitions and original bytes.
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
