# Weapon controls and aiming marker delivery

## Diagnosis and corrected local controls

The supplied settings and HUD both named Autocannon as primary. Live observation later showed Scatter 6/6 after radio switching. The player clarified that their physical Fire switch dropped a bomb instead of shooting.

In Radio setup, Fire was assigned to Channel 5 and Deploy to Button 0. The player held only their intended Fire switch: Button 0 read 1.00 while auxiliary channels 4–7 remained -1.00. The saved action assignment, rather than the selected weapon, caused the mismatch.

Using the visible **Swap Fire gun ↔ Deploy payload** control exchanged these two assignments and saved automatically. Fire now uses Button 0; Deploy uses Channel 5. The active radio's stick calibration, other switches, and existing saved profiles were preserved. This is a repair of the observed player's layout, not a speculative global remap of all Oxbot radios.

The player then confirmed **“Yes, gun fires correctly”** after releasing Fire, starting flight and activating it again. The subsequent Survival HUD showed Autocannon 23/30, 187 shots, 14 hits, and all three bombs still available. These are attributed user hardware observations, not full release qualification.

## Delivered presentation

- A 30 CSS pixel open-center cross and small outlined centre dot replace the faint text plus. Light marks and a hard dark edge remain distinct against light and dark scenery, including analog noise. No aim coordinates, camera projection or flight physics change.
- Worlds and Academy share the marker. A remembered **Aiming marker** checkbox in **HUD & widgets** controls visibility independently.
- HUD labels distinguish **Gun · Autocannon** from **Payload · Bomb ×3**.
- The weapon action names the next equipped gun, such as **Switch to Scatter**. Hints use the selected input source; six-switch radios show their assigned channel/button instead of unrelated keyboard shortcuts.
- Radio setup shows live ON/OFF indicators and highlights the action activated by a physical switch. Fire is explicitly labelled **Fire gun**; Deploy describes payload release.
- The swap control uses existing layout validation, autosave and fresh-activation rules. It is unavailable during calibration/capture/practice and needs both bindings. **Restore previous controls** retains its existing recovery path.

## References and application

[UFDS official store presentation](https://store.steampowered.com/app/2862860/) and its [developer updates](https://steamcommunity.com/app/2862860/announcements/) were inspected alongside the player's supplied UFDS footage. They informed the restrained FPV composition; no UFDS assets were copied and no undocumented gun control behavior was inferred.

[Betaflight OSD](https://betaflight.com/docs/wiki/app/osd-tab) provides configurable overlay elements and live layout preview. The independent marker toggle applies that principle here. [Xbox contrast guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102) illustrates light/dark outlines for changing backgrounds; the new aiming marker applies that treatment without relying on colour alone.

## Evidence and limits

[Delivery receipt](evidence/fpv-combat/weapon-reticle-delivery.json), [package measurement](evidence/fpv-combat/weapon-reticle-package-measurement.json), and [delivered HUD capture](evidence/fpv-combat/weapon-reticle-delivered.png).

Syntax and whitespace checks passed. Package construction remains within unchanged policies: Academy 145 runtime/147 source files with 71,084 input bytes remaining; Worlds 208/210 with 493,688 input bytes remaining. Local zero build identities are placeholders, not release evidence. No automated tests were added or run. Full browser, input/layout catalogue and performance qualification remain pending.

## Integration

Separate child of frozen #1804 (`79811b2c52715511f92966559dde51176077f066`). Published parent refs are unchanged. Six runtime source paths changed. `world-reaction-runtime.mjs` was regenerated from the canonical encounter-controls module with the existing 42-module/24-recording generator. Styles were added outside generated TOKENS/FULLSCREEN sections, and fullscreen-module edits are outside the generated shell body. No simulation, replay or profile format changes.
