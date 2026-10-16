# FPV optional player — cached launch qualification, 14 October 2026

This is a bounded browser observation of an unchanged cloud candidate, not full
offline release acceptance or hardware performance qualification.

## Exact candidate

- PR #1211 source: `7b1f700955330a094863afd48907c61d568aca5a`.
- Source tree: `6f98b32aaf0ecee566846851d3db50e3c8fe4217`.
- Actions run: [38573626614](https://github.com/mekhovov/revealline/actions/runs/38573626614), artifact `11899535678`.
- Artifact SHA-256: `c5b9d0100e94425cb26bc13d196a31aa3c1ebd693f5a550779daa79046d2e461`.
- Worlds package revision: `f6a4238b66ac863efdb78f23e5fb6f878e6909c77a199ced0296aae65b7953b8`.
- 15 top-level checksums and all 126 Worlds archive members verified;
  Worlds package contains 17,038,808 bytes.
- Cloud receipt reports committed inputs and two reproducible builds. Its
  `publicEligible: false` remains unchanged.

The original archive and receipts are retained on the external build volume under
`fpv-package-qualification-20261014/pr1211`. No package bytes were modified and no
heavy local package rebuild was run below the stable 3 GiB free-space floor.

## Actual browser sequence

In the Codex in-app browser at a 1280×800 viewport, using a separate loopback origin
on port 9012 and the artifact's exact `/releases/v0.151.1/site/` path:

1. Opened Library and chose Play for Coaster Practice Park. The exact pack installed
   and prepared a disarmed FPV session; motors off, health 100 and time 0.0 s.
2. Opened Settings → Content & Offline and chose Prepare simulator offline.
   The progress surface appeared; after it finished, Library explicitly reported
   **Offline runtime preparation completed.** The Remove button was not treated as
   evidence of readiness.
3. Stopped only the dedicated verification server with its PID/command-validated
   controller, then reloaded the same package URL.
4. The cached player and Library reopened. Catalogue metadata failed gracefully
   with **Installed worlds are unchanged**. Coaster remained listed as installed,
   digest prefix `a0483ee22fab`.
5. Chose Fly on that installed row. The Coaster scene rendered in FPV, with the
   camera/setup controls, motor-off state, health 100, time 0.0 s and the prompt to
   choose controls and arm. Reload and launch did not arm the drone.
6. Captured the rendered scene and restored the verification server. No player
   data or unrelated server was removed or changed.

Coaster pack SHA-256:
`a0483ee22fabdc190fc65858c458ed4730297a0179f8ede793383775a7568025`.
Local screenshot evidence is retained as
`~/.codex/visualizations/fpv-catalogue-20261014/coaster-origin-unavailable.jpg`.

## Limits and remaining checks

The package origin was unavailable; this was **not** a network-wide airplane-mode
test. Remote origins were not disabled. This establishes cached player startup and
installed-world launch for this exact candidate, not complete offline coverage.
It predates catalogue layout PR #1214. No physical iPhone, Steam Deck or radio was
tested, and no device FPS claim is made.

Still required: network-wide offline checks, install/update/rollback and quota
failure, interrupted preparations, all optional hosts/worlds, device/controller
qualification, sustained memory/performance and actual public player launch.
Preparation completion currently appears in Library rather than the initiating
Settings panel; a focused status-feedback correction is being developed separately.

## Publication reconciliation

PRs #1213 (verified terrain binding), #1214 (catalogue scrolling layout) and #1216
(Canyon authoring preparation) are merged. Main was observed at
`01abc1e3a` during this receipt. The public deployment marker reports
`0bd7888594b1e64f2e21518c248cd72d01f47758`; the actual public SIM was not launched
as part of this observation.

## Follow-up: public launch and safe workspace reduction

Later on 14 October the public marker advanced to
`456f7c3c0716fc2d9bedefc06c78a399457a08e4`. The actual public SIM at
`https://mekhovov.github.io/revealline/optional-practice/fpv-worlds/index.html?lang=en#packs`
was then opened in the Codex in-app browser. All 20 catalogue rows were visible.
Play on Coaster Practice Park downloaded and rendered its scene, with motors off,
health 100 and time 0.0 s. The camera control switched FPV → Chase → Overview;
the session remained paused. This confirms that public launch path at the observed
deployment, not every world, all hardware or sustained gameplay.
Screenshot: `~/.codex/visualizations/fpv-catalogue-20261014/coaster-public-launch.jpg`.

Internal disk exhaustion interrupted small Git writes despite using the external
volume for packages. The task's clean, already-pushed checkout was reduced with
Git sparse checkout, excluding archived publication evidence, verification/research
documents and content-design files. This recovered approximately 1.1 GiB; Git status
retained only the known untracked source-verification worker. No other checkout,
unpublished change, commit, recovery ref or browser/player storage was removed.
An earlier external archival copy was stopped before its verification/removal stage;
its partial copy is retained and is not claimed as a complete backup. Free space
briefly reached 3.2 GiB but remained variable, so this does not waive the stable
3 GiB heavy-build floor.

The merged #1219/#1221 feedback was separately checked against the current source
preview. Its deliberately non-installable development worker produced the expected
failure, now visible beside Prepare in Settings in Ukrainian. Changing language to
English repainted that same result without another installation attempt or a false
success. The original Ukrainian preference was restored. This is a failure/locale
browser check of the new UI; the successful offline operation above remains evidence
for the unchanged earlier cloud candidate.
