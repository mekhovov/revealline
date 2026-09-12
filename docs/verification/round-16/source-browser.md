# Round 16 — configurable controller source checks

Date: 12 September 2026. Actual Codex in-app browser, owned source server `http://127.0.0.1:8802/game/`. This origin is separate from the user’s 8767 profiles. The session began on the working source after v0.5.0; source metadata was subsequently advanced to v0.6.0. Simulated controller behavior and CSS viewport checks do not certify a physical controller, phone, native package or public deployment.

## Settings and persistence

Through the visible Settings controls:

- Chose PlayStation labels and assigned ability to physical button 2 while supply was still 2. Apply rejected the duplicate and left the current Position-label/default map intact.
- Completed the swap by moving supply to 0; set menu Confirm to 5 and Back to 2. Apply adopted the complete map, restored focus to the enabled Edit button and updated the help text: Square ability, Cross supply, R1 Confirm, Square Back.
- Restored defaults into a draft, then cancelled. The saved custom layout remained intact. Reloading the page retained the same map and help.
- Set flight to axes 2/3 with vertical inversion, retained menu axes 0/1, and changed release from 0.35 to 0.27 using the native range control. Apply showed “Right stick (vertical inverted)” and 0.35/0.27.
- Set draft Release to 0.60 with Press 0.35. Apply rejected the relation; Cancel preserved the saved settings.
- Exported the player library via its normal UI. A subsequent import of the existing Round 14 complete-backup fixture restored its eight-picture collection, packs and suspended attempt, while the omitted controller preference migrated to defaults.
- **Undo complete backup import** restored the original empty collection and exact custom controller settings, including right-stick inversion and thresholds. The UI reported that the previous collection, packs and saved flight were restored.

Portable exports were read only from the visible Save JSON textarea and saved under `.cache/round-16/`. No browser storage inspection or writes were used to arrange these states. `profile-before-practice.json` is the exported baseline for the following practice-isolation comparison; it contains no earned records.

## Layout and review

[Settings viewport measurements](settings-viewports.json) record 320×640, 844×390 and 1440×900 CSS viewports. The document fit each width. The modal stayed within the viewport and scrolled vertically; measured nonzero editor controls were at least 44 CSS pixels high and did not overflow horizontally. These measurements include controls inside disclosures; they do not assert that all sections are simultaneously visible.

The initial [desktop settings capture](screenshots/controller-stick-settings.jpg) showed the applied map and draft editor. Review found that the section needed a visible Controller controls heading; this was sent back for refinement. A separate accessibility review found generated field IDs in controller edit previews; explicit readable control labels fix that problem. Later captures and controller-lab observations are recorded below as they are exercised.

## Live controller practice

The actual Controller Practice page used the saved custom map described above. Physical South / 0 joined without starting; pressing it again still did not start, because menu Confirm was remapped to R1 / 5. R1 started the mission, and Square / 2 actually activated the Scout ability, as confirmed by the objective-marking HUD message.

Editing right vertical axis 3 to −1 paused the flight. Apply returned focus, received an acknowledgement of a genuinely sampled neutral packet and displayed “Stick values applied”; the game stayed paused. R1 explicitly resumed, and applying the retained draft again produced downward movement through the configured vertical inversion.

| Observed attempt | Turning | Captured | Score | Lives | Displayed time |
| --- | --- | --- | --- | --- | --- |
| First Signal / Scout, initial v2 bridge | Immediate | 50.0% | 7,820 | 3 | 0:23 |
| First Signal / Scout, final per-load session bridge | Grid + buffer | 50.0% | 7,820 | 3 | 0:22 |

These were actual browser runs through the virtual controller, not injected terminal states. Much of the displayed time was spent inspecting controls on safe ground, so these are not speed or difficulty benchmarks. Each reached the celebration and practice result with campaign awards disabled. Release all neutralized every button and axis. R1 opened View picture; Square returned to results and restored focus to that action. [Top-of-page capture](screenshots/remapped-stick-picture-top.jpg) records the first result’s revealed scene. A full-page screenshot was discarded because the capture surface duplicated lower-page content; no layout conclusion relies on that artifact.

An independent review found queued old-document feedback could suppress new iframe messages after reload. The final bridge/lab adds a per-load 32-character session identity to both exact envelopes, checked before sequence counters. After reloading the parent and then loading a fresh grid mission, connection, deliberate join, neutral acknowledgement and the full grid clear worked. Automated queued-old-document regressions cover the race itself; this browser reload is not a forced reproduction of the race.

Using the actual controller to edit the label-family select displayed “Button label family: PlayStation labels · Direction controls changes · R1 confirms · Square (□) cancels.” Square cancelled the value preview. Applying Xbox labels through the practice settings displayed the explicit session-only warning. The 390×844 phone and 844×390 landscape iframe presets each permitted Edit, Cancel and Close; the visible Controller controls heading remained available.

Finally, the ordinary source tab was reloaded from its persisted profile and exported again through Save JSON. Its full 913-character export matched the pre-practice export byte-for-byte. Both files are retained in `.cache/round-16/`; [the comparison record](practice-profile-comparison.json) contains their hashes. Neither the two clears nor the practice-only Xbox setting changed the saved profile. Sampled source and lab warning/error logs were empty.

No continuous physical-stick jitter, physical controller, native target or frozen/offline artifact is certified by these source checks.


## Packaged candidate

Built the tested source to `.cache/round-16/candidate` as 0.6.0 with `sourceRevision: null`, then served it on the owned 8803 origin using the CLI’s packaged security headers. The game rendered, Settings opened, Xbox labels applied and reported saved success, and the displayed version was v0.6.0. Sampled warning/error logs were empty. The candidate contains 110 manifest assets; its ZIP hash is `ef716752eb2ddc6cfa8cd2c75d4a0ff973b1e537e58dca4c5a5055e4c4dee760`. This working-tree candidate is distinct from the subsequent frozen release.
