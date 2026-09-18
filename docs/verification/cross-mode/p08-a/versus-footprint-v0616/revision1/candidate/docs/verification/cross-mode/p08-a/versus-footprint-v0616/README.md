# Versus board footprint — v0.61.6 source adoption

Status: isolated local integration candidate. Full source qualification, native play, immutable release and public acceptance remain pending. This correction does not close P08-A.

Versus now fits each complete board into its own available arena and gives the painter the actual fitted width. Touch controls, Large text, viewport changes and encounter instructions can resize a board without leaving its actors and trails scaled against a larger element box. Both seats settle their encounter cues before fallback measurement and painting. The accepted artwork, simulation, collision and score owners stay unchanged.

## Exact adoption

- Parent: `d34e283819376eb43e4942287d9767b22a4f6487`, tree `3af511259e14ed2af11a2e2498535744450a378f`.
- Reviewed generation 2 patch: 41,240 bytes, SHA-256 `7717a9abf68cf18bd1f80c0dacd0e82d196ecd7c345a4beb5db73e8ea96113d1`.
- Its eight source files were applied without runtime changes. Package, lockfile and build configuration move from 0.61.5 to 0.61.6; no dependency or build inclusion changes accompany the version.
- [Original packet manifest](originals/packet-manifest.json) pins all 139 retained files. Every original was copied byte for byte, including prior failures, generation 1, independent reviews and both completed generation 2 cohorts. The 73,757,243-byte input fixture collection was not copied into this evidence directory.
- [Adoption provenance](adoption.json) records the exact source, patch, versions, packet and sparse dependency selection. Historical absolute paths in original receipts remain historical; they are not rewritten to imply execution in this worktree.

## Verification and reproduction

The unchanged proposal passed 353 tests across 23 consumer files on Node 20.19.5 and 22.22.2; those original receipts remain under `originals/`. After integration and version changes, the actual-host and geometry cohorts passed 11/11 on each Node version: six unit cases and five real-host cases. These new checks retain command, timing, input and output hashes under `integration-checks/`.

From a complete checkout with dependencies installed, run:

```sh
node --test --test-concurrency=1 game/test/board-footprint.test.mjs game/test/couch-board-footprint-host.test.mjs
```

These tests exercise the actual Couch host, painter, encounter view and simulation with finite DOM, image and Canvas2D boundaries. The fallback case advances the authored sentinel encounter normally, verifies both seat widths before either paint, and requires unchanged frames to avoid further geometry reads. They do not reproduce native browser layout or certify physical devices.

## Remaining acceptance

Review actual 4:3 and 2:1 boards for both seats with touch pads, Standard/Large text, portrait, short landscape and handheld sizes. Check encounter wrapping, visible focus, Pause and explicit Resume, cached-page return, terminal departure and exact picture identity. Physical controller and touch-device checks remain separate from keyboard or modeled input.

The shared 64-logical-pixel non-boss cap still limits a 240-pixel-wide, 72-column board to about 13.33 CSS pixels. This patch makes the width accurate; the separate actor minimum-size follow-up remains open. Preserve the approved order after P08-A: P08-B feedback, P09 challenge, then the full P07 rewards phase.

Before acceptance, complete the six source gates, ordinary build, applicable production checks, exact-source freeze and inspection, reviewed source PR, immutable release, Pages publication and affected public journeys. Preserve the previous release and rollback route. A successful local cohort or source adoption is not a public release.
