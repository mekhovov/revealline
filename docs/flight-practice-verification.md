# Flight practice verification and release handoff

Date: 2026-10-02. Workstream: discovery, launchers, offline services, package publishing and help. **Implementation evidence is not a public-release approval. Phase 1 remains open until reviewed packages are selected on GitHub Pages and the device/human gates below pass.**

## Original failure and integration

The public `/revealline/practice/index.json` returned HTTP 404 and the committed optional-package selector contained no releases. The old client treated a missing file as an empty catalogue. The rolling-main Pages workflow also did not stage the optional-package overlay. Both failure reporting and that deployment integration are now addressed; an empty selector intentionally produces an explicit empty catalogue.

Base: `4b2bdff33` on `origin/main`. Integrated SIM-owned startup correction `c3f5030b201d6b610b12d32167164803cf281a84` (local cherry-pick `72157145c`): the World Studio state object was missing a comma, preventing startup. Existing SIM package-limit corrections were already present in the base. New bounds account for the additional guides, metadata and navigation. No flight model, training content or rendering changes were authored by this workstream.

## Automated evidence

- `npm run practice:test`: **215 passed, 0 failed**. Covers flight/replay behavior, package isolation, worker verification, cancellation, removal, catalogue compatibility and the new directory tests. Updated existing test doubles for current fullscreen/radio interfaces; no assertions were removed to conceal SIM failures.
- Localization check: **12,023 messages, 7,862 references**, English and Ukrainian, passed.
- ESLint on every changed/new JavaScript module: passed with zero warnings. `git diff --check`: passed.
- All three real packages passed development preflight and the hosted-file verifier over HTTP with the repository server's restrictive CSP. Every immutable file and stable launcher copy was compared with its byte/hash pin.
- The temporary fourth-package fixture checks registration, generated four-card catalogue, stable launcher route, artifact admission, update, rollback and retirement. Its synthetic review is fixture data only, never public-release evidence. The fixture does not represent a human-completed flight in a fourth app.
- Negative tests cover malformed/foreign catalogue routes, missing translations/description fields, oversized details, stale catalogue fallback, missing workers/dependencies, changed archive bytes, source closure and package limits. Missing public catalogue is a release error.

The final committed-source candidate command and its generated verification report are the authority for reproducibility and release hashes. Development-preview hashes below are not release approvals.

## Browser evidence

Environment: macOS ARM64, Chrome 154.0.8037.93, agent-browser isolated profile, headless/software WebGL. This is functional desktop emulation, **not** physical-device or performance qualification.

- Opened all three applications. Gym starts; Flight Studio arms, pauses and resets in self-level and Acro; World Studio's first-flight entry arms, pauses and retries after the integrated startup fix. Beginner proof completion is covered by automated fixtures, not claimed as a human learning test.
- English/Ukrainian catalogue cards and launcher routes preserve the selected language; the direct Play intent opens the application's start screen without an availability confirmation or automatic arming.
- All three prepared copies opened with browser networking disabled in development preview. Gym additionally passed closing all site tabs and reopening its stable launcher offline. The final candidate still needs the complete fresh-profile/closed-tabs/installed-app matrix on supported physical browsers.
- Directory was inspected at 390 CSS pixels without horizontal overflow. CSS `zoom: 2` and reduced-motion emulation were exercised; actual browser 200% zoom and assistive-technology use remain separate qualification tasks.
- Player HTML guide loaded in Ukrainian under the repository CSP. Real app screenshots are checked in as each package's `preview.png`; their source/provenance is in each README. A long manual is not required before playing: cards and launchers link to the maintained in-app first-flight guidance.

Local HTTP preview at `http://127.0.0.1:8879/` (uncommitted development snapshot):

| ID              | Package revision                                                   | Pinned bytes | Manifest-listed files |
| --------------- | ------------------------------------------------------------------ | -----------: | --------------------: |
| civilian-flight | `8995601602f61da2801651eb5d3265bec9f361d7b64e174dc3b733735e4019b9` |      538,506 |                    34 |
| civilian-fpv    | `e0d91331225a2993d04e29681530139e23786777076e6515a2a410a35952f7cf` |    4,037,287 |                    68 |
| fpv-worlds      | `e27021188b8dc98a3c0e9dc492156f16d8eb41e3e377582ae4c0c2c18a297b20` |   12,328,876 |                    99 |

Preflight counts one additional generated package manifest in each archive. These versions use the checkout's existing version number for local testing only; they must not overwrite an existing release with that number.

## Release-blocking evidence still required

1. Allocate a normal new source-bound release, reproduce/admit the committed artifacts, and complete every existing review gate with genuine evidence. Do not reuse an old same-numbered tag for different source.
2. Run the physical keyboard/controller/touch and screen-reader checks, visible focus, actual 200% zoom, English/Ukrainian, both FPV modes and representative beginner exercises from a clean profile. Verify controller-triggered new tabs with normal popup restrictions; synthetic Gamepad API tests do not prove hardware/browser behavior.
3. On each supported browser, prepare, close all tabs, disable networking, reopen both the stable launcher and installed app. Exercise slow/stalled downloads, cancellation, denied/full storage, eviction, damaged cached assets, two live versions, failed updates, rollback and version-scoped removal while checking records/imported worlds remain intact. Automated worker/storage tests are not a substitute for this matrix.
4. Perform same-device performance and first-time-player learning/pacing reviews. Wider physical-device/content polish follows the playable release, but startup failures, broken controls, data loss and failed installation remain blockers.
5. Use the existing publisher to upload/download-verify reviewed originals, publish through the release process, and commit the selector. CI stages all three apps and checks total hosted-site capacity. The full production site/capacity check has not been run in this sparse local checkout.
6. Run `--verify-site` on GitHub Pages and repeat the public one-Play journey. At this handoff, no new package has been uploaded, selected or published; an unchanged production selector is expected to remain empty.

For procedures see [maintainer guide](flight-practice-maintainer.md), [English player guide](flight-practice-player.md) and [український посібник](flight-practice-player.uk.md). Keep this report current with exact source SHA, package hashes, device/browser, screenshots and observed results rather than converting missing evidence into a pass.
