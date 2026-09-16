# P03 scoped recipe review

Reviewed 16 September 2026 for the **Cross-mode navigation update**. This is a source and browser review of two changed recipe inputs. It does not accept all of P03, the complete animation catalogue or physical devices.

## Changes reviewed

Compared with published P02 source `c93019a344f6f4c6ac03940c77ea09c81122d911`:

- **Screens:** only `game/ui/field-kit-surfaces.css` changes within this recipe group. Disabled Versus menu buttons/links receive muted text, the panel background and a dashed border. The prior backdrop rules, source images and P01 recovery rules remain unchanged. The ordered screen input fingerprint is `fde77f2222b0e6d021ff10af22f551532dd9139229b7871aaf584b40cfd1f44a`.
- **Motion:** only `game/ui/actor-presentation.mjs` changes within this group. Optional finite `bodyOffset` translates the body, rotor and badge together. Its save/restore encloses that cosmetic translation; the contact footprint is drawn at the real frame position. Zero, absent or non-finite offsets retain the ordinary path. The ordered motion input fingerprint is `39127024d6fb37fb50e42a4d3e1e7034b633be8e7e31225b638963a577e63554`.

The producer approves those exact fingerprints. Changing either source group reopens its recipe review; title raster images retain their separate image approvals. The UI, audio and effects groups retain their previous fingerprints and historical approvals.

## Evidence and limits

The [native observation log](native/observations.md) records actual keyboard journeys in Solo, Versus and Team, including successful Versus Next preparation and its disabled Next/focused Cancel state. Team reading was inspected at 390×844 and 844×390. Actual Team and Versus arenas loaded their original pictures. Screenshots were inspected inline in the CUA conversation; no exported screenshot files or fabricated image hashes are claimed.

The final native server audit retained 1,022 response records, including 1,019 successful GETs across 343 distinct admitted paths. It rehashed all 427 admitted source files. The three 404 rows are the explicitly unavailable source-only build-info/favicon endpoints; there were no unexpected responses or changed-source errors. A server log establishes response attempts and source pins, not receipt by the browser, complete route coverage or public qualification.

The complete Team integration cohort passed 205/205 on Node20.19.5 and Node22.22.2 at its recorded inputs before the reviewed production successor. It covers separate actual contact coordinates and cosmetic placement. The supplementary verification record carries the later measured production/binding checks; these cohorts overlap and are not summed. The native Team view used fpv25; final fpv26 changes approval metadata while preserving every original payload. Public testing must use the final released revision.

Native foreground switching, real controller/touch journeys, complete actor scale/animation review, audio listening and offline-media recovery remain separate outstanding checks. The unavailable foreground attempt is retained in the native log. This scoped review cannot close those gates.

## Immutable production result

Canonical write and check produced **fpv26**, 293 slots, 131 compiled files, 127 original payloads and 4,007,816 original bytes. Required recipe coverage reports 194 reviewed records; the other 99 source records are not newly completed assets.

Published P01/P02 prefixes remain exact. The measured intermediate **fpv25** remains a source-stage checkpoint: seven screen@13 and seven rotor@6 records under parent fpv24. This review appends seven screen@14 and seven rotor@7 records under fpv26. No original image, font or audio bytes changed. Team's explicit picture envelope advances to the actual theme26 while keeping the exact pack/map/image IDs, revisions and hashes.

The production-history test reconstructs the published P01 and P02 bundles from independently pinned metadata, ordered records and original payloads. For the historical append calculation only, it restores producer slot insertion order after canonical JSON serialization; an exact canonical equality assertion proves that no historical content changed. It then requires the original P02 bytes, retains fpv25, reproduces from the entire current ledger and rejects history mutation. Source-invalidation cases separately prove that a changed recipe reopens its own review without disturbing the title images or other groups.

The initial history test attempt passed 8/11 and exposed test-fixture ordering plus image/recipe classification mistakes. Its original log is retained. After correction, the complete file passes **11/11 on each runtime**; no historical oracle, published bytes or runtime retention algorithm was changed to make it pass.

Final exact-source qualification, the original frozen artifact, publication and affected public journeys remain mandatory for the feature release. **P03 remains In progress.**

## Reference guidance rechecked

The review rechecked primary guidance on 16 September 2026. [W3C's modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) supports focus inside an active dialog, a visible close action, keyboard containment and logical return focus. [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports consistent digital-input navigation and focus order matching the visible layout. These inform the existing acceptance cases; they do not certify the game.

[MDN's Page Visibility guidance](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) distinguishes window focus from document visibility. Accordingly, the implementation handles the relevant lifecycle paths, and the verification record does not treat an unchanged hidden-tab probe as proof that a real foreground transition occurred.
