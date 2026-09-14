# Archive-07 v0.45.0 browser acceptance

The canonical typography release passed the bounded play, saved-flight, offline-reload and Collection journey. Initial offline preparation exceeded the interface’s 60-second wait; its worker completed afterwards and normal retry plus Verify succeeded. That limitation is retained in the evidence.

Canonical URL: https://mekhovov.github.io/revealline-archive-07/releases/v0.45.0/site/game/

Immutable source: `adacdfbe15359bfd73e96ce03695b369b5097bc8`. Archive-07’s separate HTTP audit verified 737 files / 598,250,205 bytes with zero failures or retries before this browser check (Actions 34889133985; deployment 6445209075; infrastructure 2e5d22461def760f9521d08bbfd5a0fbc0ca2795). This is the published Phase 1 edition, not current P7 source.

Observed in the isolated `field-kit-public07` Chromium 153 headless profile, 1280 × 800 CSS pixels, DPR 1:

1. Fresh title displayed version v0.45.0. Selected Base game / First Signal using existing Missions controls, started and paused a flight, and selected Large text in Settings.
2. Reload → Continue flight restored the paused attempt and Large preference. Resume and a normal Down input completed the cut: 52.2%, 8,160 points, Gold, 0:03. The result and earned picture appeared.
3. Settings → Prepare offline play initially timed out. Retrying normally returned ready, and Verify reported 313/313 files, 53,550,063 bytes, no missing or corrupt files, build `df1079b01d45d81a01b66115c02862681e6019cd76a7433d51b99e9083fabc6d`.
4. Next uncleared mission selected Relay Orchard. Started and paused it, enabled browser offline emulation, then reloaded the canonical URL. `navigator.onLine` was false; v0.45’s own immutable service worker controlled the document. Large and the saved flight remained available.
5. Continue → Resume → Down produced an offline cut. Subsequent pause recorded 52.2%, 8,660 points, 0:15, one required relay obtained, target 58%; message “Line secured. 52.2% revealed.” The screenshot is the paused overlay; the state receipt binds the resulting HUD, not a claim that its board is visible beneath that overlay.
6. Opened Collection offline. The First Signal Gold record and 8,160-point score remained available. Restored networking (`navigator.onLine` true). Page-error collection was empty.

No save/cache bytes were injected or rewritten, no worker was force-activated, and no unrelated browser profile was used. The normal journey intentionally leaves its saved flight and preference intact. Frozen v0.45 retains the old saved-flight caption until the next gameplay message; the separately qualified P7 fix is not retroactively applied here.

Scope is real browser interaction with emulated network loss, not a physical disconnect, process restart, Safari/device test, or storage-retention guarantee. v0.46 coexistence is recorded separately. Screenshots of title, victory, paused offline flight and Collection were inspected. `receipt.json` binds the evidence files.
