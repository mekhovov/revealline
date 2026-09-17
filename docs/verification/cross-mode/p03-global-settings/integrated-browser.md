# Integrated Settings / Motion browser check

17 September 2026. Local source: `a506b0606224c771353eb6f6160cf3a42dea662b` plus the four followups identified in `integration-evidence.json`. This is a targeted native browser check, not frozen/public release qualification.

The Codex in-app browser used a temporary private test tab at `http://127.0.0.1:8876/`, at its existing **1280 × 720** viewport. No viewport override or existing public tab was changed. Observations below come from native UI actions and the accessible DOM, not injected events or application-state mutations.

## Observed journeys

- **Solo keyboard:** From focused Continue, Tab through Missions and Collection to Settings, then Enter. Appearance was the initial category. Tab to its tab and Left selected Audio; the next Tab reached Master volume, with only the Audio panel visible. Escape closed Settings and restored the Settings opener.
- **Workshop / Motion:** Keyboard navigation opened Workshop then Motion Lab. Its shared-reading explanation named `Settings → Appearance & accessibility`. Selecting Large in Motion Lab, then native browser Back and reopening Solo Settings, showed Large. This Back navigation did not demonstrate a persisted BFCache restoration; the modeled restoration tests remain separate evidence.
- **Cross-mode reading:** Selecting Plain in Solo, then following Team, showed Plain and Large in Team Settings. The Team dialog fit the viewport (1040 × 688 at x=120, y=16). Its Reduce effects label measured 956 × 44 CSS pixels. Versus later showed the same Plain/Large choices.
- **Team pause ownership:** Started a disposable Relay Yard attempt, pressed Escape at 0:04, opened Settings and changed master mute through Audio. Closing Settings left Both players paused at 0:04, with 0.0% territory, three reserves and Settings focused. The quick Sound control reflected the change.
- **Mode-switch cancellation:** Choosing Versus from that paused attempt opened the discard dialog. Escape retained the same paused state and restored focus to the Versus link. A second activation and explicit confirmation left only this disposable test attempt and reached Versus.
- **Saved sound adoption:** Team's explicit Unmute was reflected by Versus's Sound: on control. Muting in Versus was reflected by Solo's Sound: off control and Unmute sound action. Solo's master fader then matched the shared 0.65 value.
- **Cleanup:** Through visible controls, restored Theme font, Standard size, muted sound and the initial Solo volume of 0.8. Closed the temporary tab. No saved Solo flight was resumed; the title continued to offer its saved flight.

## Existing first-use difference

Before this visit's first explicit sound change, Solo showed volume 0.8 while Team showed 0.65. Source review confirmed the existing P02-A contract: Solo reads its legacy profile fallback, while Couch uses the adapter default when no valid shared record exists. Initialization deliberately does not write or migrate preferences (`docs/shared-master-audio.md`, `game/audio-preferences.mjs`). After an explicit action saved the shared record, the modes agreed. Preserve this as first-use consistency debt; this check does not claim automatic legacy migration.

## Limits

No physical controller, touch-only hardware, rotation, audio listening, browser zoom, offline play, exhaustive map playthrough, or public-source identity check was performed in this targeted pass. No screenshots or native event instrumentation were retained. Earlier responsive/browser receipts remain tied to their original sources; this pass does not relabel them as integrated evidence. The local development footer reads VERSION DEV and is not a release identity claim.
