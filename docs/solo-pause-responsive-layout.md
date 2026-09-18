# Solo Pause at narrow widths

Status: bounded P03/P05 correction for v0.61.24. The scoped browser layout and keyboard checks passed; final committed-source gates, build and public verification remain required. Physical input and actual browser zoom remain separate open checks.

## Observed issue

The release coordinator observed public v0.61.22 at 280×800 with Plain/Large text. Its board measured 254×190 and the corrected top craft was fully visible, but Pause retained two action columns. Resume, Restart, Mission brief and Main menu wrapped into fragments of roughly two or three letters. This was an actual public keyboard observation with an inline screenshot, not this candidate’s native test. It remains recorded as the failing baseline.

The separately fetched public `field-kit-surfaces.css` and `pixel-theme.css` bytes match v0.61.22 source `17e0a455f76c3f4a72f2e596397a0e73463335a5`. The affected surfaces stylesheet is also unchanged in v0.61.23 source `2f1074a37ade9c731ea7be37a6e56e533b51d1ac`.

## Correction

Exclude `data-kind='pause'` from the generic overlay grid at widths up to 600 pixels, using `:where(:not([data-kind='pause']))`. `:where()` adds no selector specificity. Every other overlay continues to match the same mobile rule with the same specificity.

The stylesheet order is pixel theme, device controls, then field-kit surfaces. The later generic mobile grid had the same specificity as the earlier Pause selectors, overriding their one-column portrait layout. Removing that match restores the existing Pause rules, including the deliberate two-column arrangement in short landscape. Resume and Main menu retain their full-width landscape rows.

No font sizes, hit targets, wrapping rules, navigation listeners, simulation state or artwork change. This preserves the existing design; it does not by itself prove that every layout is readable.

## Native qualification matrix

Use a real paused flight and the four visible actions. Record the active element and next focus destination; a selector or computed grid value alone cannot prove readable labels.

| Surface                                 | Verify                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 280×800, Plain/Large                    | Complete words, icons and focus borders; every action visible or deliberately reachable; targets at least 44 CSS pixels; one action column.               |
| 280×800, Theme/Standard and Theme/Large | Equivalent readable actions without reducing text.                                                                                                        |
| Portrait widths 600, 601, 680 and 681   | Stable one-column Pause layout across both existing breakpoints.                                                                                          |
| 844×390 and 600×400 landscape           | Existing two columns, wide Resume/Main menu rows, readable complete Pause controls. Check the board and flight controls separately after explicit Resume. |
| Portrait → landscape → portrait         | Same paused checkpoint and intended focus; no automatic Resume.                                                                                           |
| Actual 200% browser zoom                | Readable, reachable actions; report this separately from viewport resizing.                                                                               |
| Ready, Lost and Won                     | Their intended action grids and navigation remain unchanged.                                                                                              |

The [retained browser record](verification/cross-mode/solo-pause-layout/root-native-layout-review.json) establishes the stated candidate Pause layouts, rotations and keyboard routes. It also retains the initial interrupted loading attempt and known separate HUD/Brief issues. Actual zoom, touch activation and modeled controller routing remain separate evidence. Physical controller qualification remains a separate required category. Preserve a currently paused flight when opening Help or leaving for Main menu, using existing host behavior.

## Integration and release

Apply only the related CSS and documentation hunks. The patch is based on v0.61.23 and must also apply cleanly after the sealed Team entry/Next documentation additions; neither those candidates nor an existing release may be rewritten.

After native correction review, the release coordinator synchronizes package/lock/build versions, runs the six source gates and relevant browser/build checks, commits the exact source, freezes a new immutable release, deploys Pages and verifies public bytes and Pause interaction. Record source SHA, publishing revision, test URL, inputs, viewports and evidence limits. Do not call this source-only candidate a completed phase or a public fix.
