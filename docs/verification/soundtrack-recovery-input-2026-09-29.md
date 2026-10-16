# Soundtrack recovery input verification — 2026-09-29

This is the separate top-level soundtrack backup in Pictures & Stories. It does not requalify the completed picture/story editing workflow or the separately owned Audio Library.

Source: `b38c96445` introduces operation focus ownership and BFCache retry recovery; `dbb95e900a84711adb2ee043a56017be145faab1` adds the busy Cancel owner after a real browser failure. Use both changes. PR [#782](https://github.com/mekhovov/revealline/pull/782) remains an integration input, not a published build.

## Problem and correction

The old asynchronous preparation always focused Download, even after the player had moved elsewhere. A page-owned focus lease now retires on newer focus/input, another dialog, hidden/blurred state, abort or page exit. Completion restores Download or the retry control only while ownership survives. BFCache return re-enables preparation when its retained connection is available.

The first virtual-controller run of this correction **failed**: neutral controller polling correctly removed the disabled Prepare button from navigation and focused Open local media. That retired the lease before completion. The final correction provides a visible **Cancel preparation** button as the busy focus owner. Neutral polling retains it; Confirm, Back or native Escape cancels only preparation, keeps the connection open and fences late completion. Deliberate navigation still prevents focus restoration. No global navigation or production guard was weakened.

## Automated checks and review

**76/76** focused checks pass: 47 Still host cases and 29 Confirm guard/lifecycle cases. The host coverage includes neutral controller frames through success/failure, Cancel/Back/Escape, newer native/controller focus, hidden/blur/pagehide, retained BFCache retry, reopened panels, disposal and late-result fencing. The initial correction passed 71 checks; the final five regressions cover the discovered polling race and cancellation.

```sh
node --test --test-reporter=spec \
  game/test/still-media-host.test.mjs \
  game/test/controller-confirm-guard.test.mjs \
  game/test/controller-confirm-lifecycle.test.mjs
```

Independent review and targeted rerun found no outstanding issue. Lint, formatting and whitespace checks pass. Existing localized Cancel text is reused; no new translation key is introduced. Full EN/UK localization passes: **10,912 messages / 8,579 references**.

## Actual browser workflows

The source server used the preserved test origin `http://127.0.0.1:8989`. Existing records remain intact. The virtual case is `game/test/manual/authoring-controller.html?tool=soundtrackRecoveryCurrent`; it uses real shared gamepad pulses, not application-handler calls. The only pointer action starts the test runner.

The fresh complete rerun **passes**: Open local media → verify retained records → Close workshop → Prepare → explicit Download → repeat Prepare/Download → Close local connections. The fixture observes completed native link dispatch, validates the actual prepared Blob using production import/export, and compares all three domain snapshots before and after. Generations remain **audio 0 / media 4 / story 3**. Final focus returns to Open local media.

A separate standalone native-keyboard journey repeats the same path using unbound Enter, Tab, Shift+Tab and Escape. It requires no pointer reset or programmatic focus. Both preparations focus their Download link; both actual OS downloads finish; closing connections restores the opener.

The empty backup completes too quickly to qualify timed cancellation in this real browser. Pending-operation Cancel/Back/Escape and lifecycle interruption have automated evidence, not a claimed browser timing result.

## Actual downloaded artifacts

All four files in `/Users/oleksandr.mekhovov/Downloads/` remain preserved:

| Input              | Files                                                                | Bytes each | Result                                                       |
| ------------------ | -------------------------------------------------------------------- | ---------: | ------------------------------------------------------------ |
| Virtual controller | `fpv-line-soundtrack.rlsound`, `fpv-line-soundtrack (1).rlsound`     |        192 | Production import and canonical export reproduce exact bytes |
| Native keyboard    | `fpv-line-soundtrack (2).rlsound`, `fpv-line-soundtrack (3).rlsound` |        192 | Same exact result                                            |

Every file has SHA-256 `97cf00ac47a512848c19869483c075c69b1142da21e8a15ddced77b31f1a4d1e`. Production catalogue-aware validation reports `revealline-soundtrack.v1` with **zero audio originals**. The preserved picture/video records are excluded from this audio-only backup. The validator refuses to substitute a fake codec probe for nonempty audio.

Local receipts: `/private/tmp/soundtrack-recovery-virtual-downloads-20260929.json` and `/private/tmp/soundtrack-recovery-all-downloads-20260929.json`; reusable validator `/private/tmp/validate-soundtrack-recovery-20260929.mjs`. These are verification artifacts, not product exports.

## Boundaries

This qualifies empty-library recovery and exclusion/preservation of existing picture/story data. It does not qualify real MP3 decoding/playback, nonempty/restricted/missing-original browser recovery, target-store restoration, OS file pickers, physical controllers, installed offline behavior, native platforms or a published release. Existing unit coverage of those data paths remains separately attributed. The full native-menu plan is incomplete.

## Final source attribution

At final source `dbb95e900a84711adb2ee043a56017be145faab1`, the default Still/Video dependency capture contains **243 inputs, 209 modules, 667 module edges and 48 resource edges**. Combined with the unchanged **835 edition inputs and six compiler pins**, all **877 unique paths** match Git and disk. No manual fixtures enter the default collector. The prior 14-edition compilation remains attributable without another build; generated source-revision metadata is preserved. This is source/compile evidence, not installed-offline acceptance.

Final receipts are `/private/tmp/still-video-authoring-source-closure-recovery-final-20260929.json` and `/private/tmp/still-video-commit-attribution-recovery-final-20260929.json`. Earlier Video-only source receipts remain attributed to `40c35003e`.
