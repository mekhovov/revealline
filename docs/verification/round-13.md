# Round 13 — shared game, native packaging foundations

Date: 12 September 2026. This round adds maintainable native shells around the existing game. It does not establish a public website deployment, notarized desktop distribution, iPhone installation or human enjoyment certification. Exact frozen-artifact evidence is recorded separately after the source commit.

## Implemented changes

- A shared platform adapter selects browser/desktop downloads or the bundled iOS Share adapter, and connects native inactivity to pause/input-release/audio handling in solo, couch and Replay Theater.
- Export UI distinguishes preparing JSON and requesting a download from an actual saved file. Native Share cancellation/failure is retained. Transfer JSON remains compact and fits the same 84 MiB + 32 KiB envelope as valid complete backups; adding indentation no longer inflates a near-limit backup beyond its contract.
- Native apps explain their bundled offline content instead of offering the browser service-worker installer. iOS provides an explicit runtime diagnostic link.
- Safe-area insets now reserve room around solo/couch controls and the nested workshop/theater pages. Actual notched-device comfort still needs a device test.
- A verified staging CLI preserves source releases, bounds reads, rejects traversal/symlinks/unsafe replacement, records native/source inventory hashes and stages the complete relative file tree. iOS staging inserts an early CSP meta policy; desktop serves its policy through the custom protocol.
- Electron 44.3.0 / Packager 20.3.0 / Fuses 2.1.3 are isolated under `platforms/desktop/`. The sandboxed local shell has a stable origin and persistent partition, strict resource/navigation/download handling, immutable package labels, verified fuse readback and the game's original icon.
- Capacitor 8.5.2 is isolated under `platforms/ios/`, with an official generated SPM project, exact native dependency version, iOS 15.4 target, App/Filesystem/Share bridge, privacy manifest, `.mjs` type declaration and diagnostic bootstrap that can report a module MIME failure. Complete runtime license notices are retained in its bundled adapter.
- Native art generation reuses the exact existing pixel emblem, produces the iOS icon/splash and a macOS ICNS, and defaults to read-only verification. The source icon renderer's default web outputs remain unchanged.
- A thirteenth project skill, Native Packager, covers packaging, backup transfer, rollback and evidence. It was validated and linked locally without replacing the twelve existing skills.

## Automated and static verification

`npm test`: **555 / 555 pass** (486 prior tests, 7 shared platform tests, 16 native staging tests, 24 desktop tests, 16 iOS adapter/diagnostic/configuration tests, 6 native art tests). `npm run lint`, `npm run format:check`, `npm run format:native:check`, `npm run validate` and `git diff --check` passed.

Validation finds 82 browser source files, 12 base maps, four themes and seven classes. Four navigation warnings are intentional: source motion lab, source reference atlas, source versions index, and the iOS-only diagnostic route. Each is hidden in environments where it is unavailable. No deterministic core, map, class or expansion data changed; the previously recorded solvability and equipment proofs were not regenerated unnecessarily.

The isolated desktop dependencies reported zero npm audit vulnerabilities at installation. The current-host ARM64 candidate package was generated, every bundled-site inventory entry was checked and all configured security fuses were read back. Its custom resource handler returned the entry page with status 200. See [candidate report](../../platforms/desktop/verification-candidate.md); these are packaging/resource checks, not observation of native gameplay.

The iOS project was generated and synced using installed Node 22.22.2 without installing a global toolchain. Native project, Info and privacy property lists parse successfully. The native art's seven ICNS PNG members were validated, and Apple's `iconutil` decoded the actual ICNS. The skill validator passed in an isolated temporary Python environment with PyYAML 6.0.3.

## Actual browser observation

The source v0.3.0 game loaded and completed First Signal through its real tap direction control: **50.0% captured, 7,820 points, three lives, 26 seconds**, then exposed its earned picture. A brief keyboard press did not sustain movement in hold mode; no keyboard-clear claim is made for that attempt. Earlier recorded keyboard/control tests remain distinct.

The full-backup control produced its corrected status and exposed a valid 29,501-byte `xonix-backup.v1` through the game's copy/paste field. It retained five pictures, installed campaigns and a suspended attempt. A download request alone was not treated as proof of a saved OS file.

All six solo and six couch preview sizes were checked through the actual playground controls. Solo controls meet 44 × 44 on the phone/tablet/coarse-oriented fixtures; the desktop mouse layout retains its existing 34 × 28 minimum. Couch controls are at least 44 × 44, with whole boards/actions visible and no horizontal overflow. These are same-browser CSS fixtures, not emulated Safari or physical controllers. See [measured readouts](round-13/layout-fixtures.json) and [earned picture](round-13/screenshots/browser-completed-picture.png).

## Target-specific unfinished verification

- Desktop process launch succeeded, but two Computer Use captures reported pending macOS Accessibility and Screen Recording permissions. No native window, real Save dialog, imported collection, restart persistence, audio or controller interaction was observed. OS protections were not bypassed.
- This host has only Xcode Command Line Tools; full Xcode and `simctl` are unavailable. No iOS compilation, simulator launch, physical iPhone test, Share/Files roundtrip or native storage/MIME certification was performed.
- Native wrapper data remains versioned web storage. Actual custom-origin Web Locks and IndexedDB behavior, larger collections, updates/eviction and interruption recovery require native runtime evidence; the writer guard remains intact.
- The macOS app is a local unsigned/ad-hoc development artifact, not Developer ID signed or notarized. No Steam, TestFlight, App Store or public-host submission was made.

These limitations apply to the affected target. The existing browser game, retained releases and user collections remain available.
