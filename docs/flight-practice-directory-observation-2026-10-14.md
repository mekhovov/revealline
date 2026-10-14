# Flight practice directory browser observation — 2026-10-14

## Result and boundary

**Passed: seven browser checkpoints, no page or cleanup errors**, using Chrome
155.0.8059.40 in a clean, isolated browser context. This is component-level
evidence, **not release qualification or proof that the three apps are published
and playable**.

The test uses the production standalone-directory renderer, navigation module,
in-game practice panel, panel stylesheet, EN/UK translations, package descriptions
and previews. Its local metadata fixture has three entries at synthetic version
`v9.0.0` and synthetic sizes. No simulator runtime is substituted; no password,
access gate, installation, publisher or release approval is bypassed. Launcher
destinations are checked without opening or unlocking the apps.

The measured working tree was based on `caab4312e42d9193faa3a0450aaba015b3c6ae5e`
and included the directory locale-navigation fix. The JSON receipt identifies the
actual tested source-file and harness SHA-256 values; the base commit alone does
not identify those uncommitted bytes.

## Checks performed

| Check                                | Observed result                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three-card discovery, EN and UK      | Names and descriptions match the maintained package descriptors. Each Play and Details link points to its own stable same-origin launcher, uses a new tab with `noopener`, and retains the selected language. Only Play carries `action=play`.                                                                                                                    |
| Navigation language                  | Player guide and Main game/FPV shortcut preserve `lang=en` or `lang=uk`. This check exposed the previously missing locale propagation on those two standalone-directory links; the main implementation lane fixed it and the browser rerun passed.                                                                                                                |
| Keyboard focus                       | All nine standalone-directory controls have a visible 3px outline when reached with Tab. The native panel initially focuses Back to game, keeps page focus within the open dialog, and restores the opener on Escape. Native navigation to browser chrome remains allowed.                                                                                        |
| Responsive layout and reduced motion | At 1280×900, 375×812 and 640×450 CSS pixels, the standalone directory has no horizontal page overflow. The 375px layout is one column. The reduced-motion preference is active and there are no running animations.                                                                                                                                               |
| Lightweight browsing                 | Directory inspection registers no service worker and requests no simulator entry module. Gameplay previews are real maintained assets, not generated mock images.                                                                                                                                                                                                 |
| Empty state                          | Standalone and in-game empty states retain the existing FPV/main-game and guide routes. The in-game empty state differs from the request-failed state.                                                                                                                                                                                                            |
| Error recovery, EN and UK            | A failed request preserves the validated prior catalogue with its original explicit date. Invalid optional details fall back to basic cards without blocking launch links. With no saved catalogue, a failure keeps retry and navigation available; a subsequent successful retry restores all three cards. Status uses `role="status"` and `aria-live="polite"`. |

## Repeatable run

Run the opt-in test with an existing Playwright module and installed Chrome:

```sh
PRACTICE_DIRECTORY_BROWSER_MODULE=/absolute/path/to/playwright/index.mjs \
PRACTICE_DIRECTORY_BROWSER_REPORT=/absolute/path/to/directory-browser.json \
node --test scripts/test-practice-directory-accessibility.mjs
```

Without `PRACTICE_DIRECTORY_BROWSER_MODULE`, the test explicitly skips. It does
not silently claim browser coverage in ordinary unit-test runs. The report
requires an absolute output path; screenshots are written beside it. The test
serves the source components from a loopback-only ephemeral port. Browser and
server cleanup have independent five-second deadlines; cleanup failure marks the
run failed and is retained in the report rather than preventing the report from
being written. Every recorded source file and the harness are rechecked after
observation and cleanup. Drift marks the run failed. The report path is reserved
exclusively before browser startup: choose a fresh filename for each run; existing
evidence is never silently overwritten.

This run's local receipt is `/tmp/practice-directory-browser-hardened-20261014.json`.
Six screenshots beside it show the desktop, narrow, zoom-equivalent, EN/UK cached
catalogue and cold-request failure states. Narrow and UK cached-state images were
visually inspected. The report records their content hashes. These local files
must be retained with review evidence before relying on them beyond this machine.

The hardened run finished at `2026-10-14T13:43:46.122Z`. All 23 recorded source
files/harness hashes matched at the end, and both owned resources closed without
cleanup errors. The dialog check recorded 24 Tab steps (12 per locale): 23 stops
had page focus inside the dialog with visible outlines; one moved to browser
chrome, which is intentionally allowed. This is a sampled traversal, not proof
of every possible keyboard sequence. A second invocation with the same output
path was rejected with `EEXIST` before browser startup, and the receipt hash was
unchanged (`c27c7970ede96bcd88daaaa89fffe625d70ad2a683840d70e69070d9c5bea4b9`).

## Not covered / remaining acceptance

Retained evidence: [browser receipt](flight-practice-qualification-20261014/directory-browser-caab4312e.json).
Its six screenshots are retained beside it under their original basenames;
temporary absolute paths in the receipt are provenance, not permanent links.

- 640 CSS pixels approximates the layout space available when a 1280px window is
  zoomed to 200%; it is **not a native browser-zoom test**.
- ARIA semantics and keyboard behavior do not establish actual screen-reader
  announcements, physical-controller operation, touch-device usability or human
  learning outcomes. Those still need the planned device and human checks.
- The panel is mounted in a minimal isolated host with its production stylesheet,
  not the entire main-game shell. Full-shell interactions and appearance-theme
  combinations remain separate integration checks.
- No app is started, armed, downloaded, installed, updated or removed by this
  test. Real-package play/offline/update qualification, source-bound review and
  final public-player verification remain separate gates.
