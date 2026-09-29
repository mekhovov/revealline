# Native menus and FPV / LINE: PR integration evidence

This candidate ports the landing task onto main `afb19ebd06db336d32dfe4660c43aa0f6711dca5` (including the v0.142.3 Confirm corrections). The shared checkout and other owners' branches are preserved. The source batch combines native landing and categorized Settings, keyboard/controller authoring, Departure Mono, eighteen scene profiles and fullscreen, FPV / LINE branding, edition `/ LINE` names, canonical DroneAid URLs and native/install artwork.

The target is a release input, not a new published version. The release coordinator assigns the version milestone, reconciles overlapping inputs, qualifies the aggregate, and publishes through the existing release process. This candidate does not change release versions, historical snapshots, workflows, save identities or bundle IDs.

## Reconciliation

- Keep current-main controller router, Confirm guard/lifecycle, native activation capture and diagnostics. Port Creator, launcher and the new authoring host to that lifecycle; a native Confirm press/release between polling frames is covered by focused regressions.
- Keep current-main Audio controls and Previous/Play/Next semantics; remove redundant landing transport while retaining passive song metadata.
- Keep mission selector #776 separate. Only the menu transition hooks in the chooser are shared with that input; card design/numbering is not duplicated here.
- Coordinate overlaps with #771 (Pause), #779 (Audio persistence), #758 (Library example-pack ownership), and #761 (authoring/presentation). A selected edition suppresses default example-pack requests without changing company catalogue ownership.
- Exclude unrelated Demo/bot/recording, gameplay signal reception, company directory/isolation and actor changes. The small pure analog helper and atlas are required by the menu artwork only. The existing first-cut demonstration remains available; the pending demo editor can receive the shared authoring adapter when its owning input integrates.
- The edition graph validates 552 selected runtime files without those excluded features. All 46 declared runtime assets match their admitted bytes and SHA-256 values.

## Fresh checks on this isolated candidate

Counts describe separate invocations and must not be added together: cohorts overlap.

| Check | Result |
| --- | --- |
| Company identity/compiler/offline tests | 76 passed |
| Actual company Solo host tests, including all 14 editions | 43 passed |
| Authoring, editor adapters, navigation and current Confirm regression cohort | 313 passed |
| Sparse reference-gallery HTTP handoff | 2 Python tests passed |
| Fonts, identity, icons, native metadata, launcher and copy cohorts | 95 passed across the recorded invocations |
| Fullscreen, artwork motion, signal-loss and analog helper | 41 passed |
| Quick music transport and passive metadata | 13 passed |
| Web/native bounded packaging fixture and edition example-pack host | 5 passed |
| Display preference transitions across actual Solo/Team/Versus hosts | 9 passed after completing the deterministic actor-transport fixture |
| Landing/retune/scene/brand cohort | 56 passed; one source-inventory check could not complete in the sparse checkout |
| Combined host navigation/settings/retune cohort | 75 passed initially; five reported failures were the display fixture and dependent subcases, corrected by the 9-pass display rerun |
| Generated sprites | All 33 artifacts match the generator |
| Brand icons and native icon generator | Verification passed |
| Changed JavaScript / presentation source | ESLint passed; Prettier passed; whitespace check passed |

Selected test output, with trailing whitespace normalized, is retained in [native-menu-integration-2026-09-29](native-menu-integration-2026-09-29/). Earlier failures from sparse missing tracked files are environment/setup failures, not passes. The remaining whole-source Workshop inventory check needs a complete checkout: its last missing baseline directory was `authoring/library/tactical-teaching`. The bounded package fixture verifies exact included menu assets and desktop/iOS staging, not a full native build.

Earlier browser screenshots, motion measurements and edition packaging receipts in the neighboring reports describe the shared development snapshot before this main reconciliation. They are useful design evidence, but do not establish browser, physical-controller, iOS-device, Steam Deck hardware or published-build acceptance for this exact PR. Those checks remain release gates. Full-suite execution is not claimed.

The whole-content localization extraction was attempted in this sparse checkout, initially stopped on omitted tracked pack metadata, and a final run was stopped during expensive content extraction while several independent checker processes were active. It is inconclusive, not a passing check. The runtime catalog was regenerated from the selected EN/UK resources; catalog parity and focused localized menu behavior are checked separately.
