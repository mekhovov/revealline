# Archive-07 v0.46.0 browser acceptance

The canonical theme-framework release passed saved-flight restoration, natural victory, offline reload/play, earned-picture viewing, and coexistence with v0.45. Initial offline preparation exceeded the interface’s 60-second wait; retrying normally completed verification. The initial timeout remains in this receipt.

Canonical URL: https://mekhovov.github.io/revealline-archive-07/releases/v0.46.0/site/game/

Immutable source: `0b0d2d793d61187f2544e82f3b0fd96b251e93e1`. Archive-07’s separate HTTP audit verified 737 files / 598,250,205 bytes, zero failures/retries (Actions 34889133985; deployment 6445209075; infrastructure 2e5d22461def760f9521d08bbfd5a0fbc0ca2795). This is the published Phase 2 edition, not current P7 source.

Observed in the isolated `field-kit-public07` Chromium 153 headless profile, 1280 × 800 CSS pixels, DPR 1:

1. After v0.45 qualification, the v0.46 canonical URL displayed its own fresh profile: Standard text, no saved Continue. This is expected release-scoped storage, not automatic migration. The initial boot frame and the subsequent ready title are recorded separately.
2. Base game → briefing → Start → Pause, then Settings → Large. Reload → Continue restored the paused attempt and Large preference. Resume → Down won First Signal naturally: 52.2%, 8,160 points, Gold; displayed time 0:03 (full viewer records 3.82s).
3. Settings → Prepare offline play first timed out. A normal retry completed, and Verify reported 321/321 files, 54,213,509 bytes, no missing/corrupt files, build `1cabefba3feb01952b5c2208481cdd6d126da3deff9362be523c511a47104461`.
4. Enabled the browser’s offline emulation and reloaded the canonical URL. Its v0.46 worker controlled the document; Large and the earned Collection were available. The First Signal full picture, Gold record, points and time opened while `navigator.onLine` was false.
5. Through visible Missions controls, explicitly selected Base game / Relay Orchard. Waited for picture readiness, started, verified the running HUD, then paused. Reloaded while offline; Continue verified and restored the paused attempt at 0:06. Resume → Down made a natural capture: 52.2%, 8,660 points, relay 1/1, target 58%, flight still running. The screenshot shows the actual board, craft, HUD and Pause control. The state receipt was sampled at 0:16; the following screenshot at 0:17. Paused afterwards.
6. Restored networking. Both immutable worker registrations remained activated in distinct `/releases/v0.45.0/site/` and `/releases/v0.46.0/site/` scopes. Returning to v0.45 and Continue restored its separate Large / Relay Orchard / 52.2% / 8,660 / 0:15 state. Returning to v0.46 and Continue restored its own corresponding 0:17 state. Neither version’s worker or save replaced the other. Final network state is online.

`before-readiness-*` records an unsuccessful early attempt to start Relay Orchard before its picture was ready. No save was created; subsequent keyboard input on the title activated the featured Pressure Lines chapter. Those records are retained as failed tool navigation, not offline restoration proof. Base game was explicitly reselected through normal controls and the successful readiness → running → pause → reload journey is recorded separately. No pending-save or application-state bytes were injected.

The frozen release retains the old “Press Resume” caption until a later gameplay message; the separately qualified P7 copy fix is not retroactively applied. Page-error collection was empty. Title, Gold result, running offline flight, Collection and full-viewer screenshots were inspected. All storage effects came from ordinary player controls; no cache was cleared, worker forced, or unrelated profile touched.

This is actual Chromium interaction with network emulation, not a physical disconnect, browser-process restart, mobile/Safari test, root-redirect transfer, or long-term storage guarantee. A portable complete backup is the separate intentional transfer path between release profiles. `receipt.json` binds every evidence file by SHA256.
