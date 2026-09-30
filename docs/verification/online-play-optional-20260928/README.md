# Optional online play: v0.142.0 follow-up

## Source and delivery boundary

The public v0.142.0 build reports frozen source
`813dee5feff5d42c54ef91292f6dd434d39d311a`. The two fetched startup/access modules
match that source byte for byte and still require offline preparation. See
[deployed-source.json](deployed-source.json). This is a deployment gap, not proof
that the optional helper already queued for publication still opens a popup.

This follow-up starts from release-root PR #768 at
`5636af7726b3c0fed15e7455306409fbf371e74b`. It does not allocate a version, modify
that release branch, or rewrite frozen public files. Delivery remains through
the protected release queue. A local build does not certify public deployment.

## Additional fix

`createSoloRouteHost` previously threw “Download this chapter before playing”
when an embedding host supplied no offline integration. The integration is now
optional; network chapter loading retains size/hash/content validation. An
explicit host callback still preserves its cancellation/ownership contract.

The regression loads every published Solo chapter without that integration and
compares its mission execution identity against the original full source.
Ordinary-access checks cover group, chapter, all three modes, tools and mode
destinations with `prompt: true` and both retention settings. Unexpected fetches
or prompts are counted and asserted after the helper returns, so swallowed
exceptions cannot produce a false passing result. Versus tests also exercise
current, shipped, official-import, user-import and Creator ownership paths.

## Executed checks

- [Chapter-loader regression before the fix](chapter-loader-red.tap): one
  selected test fails with the old download-required error; seven are skipped.
- [Baseline](baseline.tap): 74 passed, one failed. The existing cold-menu fixture
  omitted the ownership checkpoint's required `hashes` array. The fixture now
  includes that field; production ownership validation is unchanged.
- [Focused checks](focused-green.tap): 86 passed, zero failures/skips. Includes
  chapter providers, cancellation, optional access, company startup, service
  worker network fallback, denied storage, deliberate install controls, tool
  navigation and Versus ownership.
- [Host checks](hosts-green.tap): eight passed, zero failures/skips. Includes
  unprepared Solo/Team entry, online saved-flight restoration, mode departure,
  and restoration of deliberately prepared content with actual fixture network
  requests blocked.
- Repository CLI validation, changed-file ESLint and Prettier checks passed.

The first local build attempt was rejected by the unchanged symlink guard because
macOS `/tmp` resolves to `/private/tmp`. The corrected build uses the canonical
path. The corrected [build](build.json) passed: 1,757 files, development
distribution SHA-256
`46ef7edd90491bf5ba4d039a585361206cb593ee92e2c35115c0d9d64c1396c5`.
Its `sourceRevision` is null because it was built from the edited checkout, not
frozen as a release. The packaged worker contains neither the old mandatory
download redirect nor the HTTP 409 gate. The packaged chapter provider contains
the new optional integration.

## Packaged browser smoke check

Executed in the Codex in-app browser against the completed distribution at a
fresh local origin, `http://127.0.0.1:8927`, without choosing any offline download:

1. Solo title showed **Start**, then **First return** entered active play with a
   running timer and three lives. No offline chooser appeared.
2. Paused Solo and followed its Versus link. The normal saved-flight departure
   confirmation remained; it verified the save and opened Versus without an
   offline prompt. **Start race** displayed both running boards.
3. Opened Team from the observed mode URL. **Start together** displayed the shared
   Twin Landings arena and running timer without an offline prompt.
4. Paused Team, deliberately opened **Install & offline play**, then used **Back
   to game** without starting a download. The chooser closed and the paused arena
   with **Resume together** remained available.

These are observed startup/menu transitions, not complete mission playthroughs,
physical-device evidence or public deployment. The temporary browser tab and
server were closed after verification.

The published browser profile already had usable local content and could resume
its existing flight. It was paused again; no cache/profile data was cleared.
That observation does not reproduce or disprove the unprepared-player report.

No full-suite, physical iPhone/iPad, Android, installed-app, public-release or
whole-game acceptance is claimed by these focused checks.
