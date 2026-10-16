# Regional Overview height framing

The integrated Alpine review exposed a separate camera limitation: regional Overview placed its camera and aim around sea level even when the resident terrain was hundreds of metres high. The resident window was already bounded (normally three cells across); the camera did not mistakenly frame the entire 4.096 km world. Its vertical envelope was simply hard-coded to zero.

This correction measures the admitted terrain/scenery group once while it is detached for graphics preparation. A weak cache avoids retaining released groups or scanning geometry each flight frame. A non-prewarmed authoring window measures once on first observation. Empty pose anchors do not enter the measurement. No flight, source, collision, recorded-state or scoring data changes.

Regional Overview retains the previous viewing direction, centres the actual three-dimensional bounds and fits their projected width/height with a margin. Its far plane grows only when the measured envelope requires it; switching back restores the regional flight far plane. FPV, Chase, editor and all ordinary host camera behavior remain unchanged. The previous conservative near-plane depth correction remains active.

## Verification

`verify-overview-height.mjs` loads the exact original Alpine relief-r1 and Coaster composition-r2 source through the actual verified mixed owner. Across all twelve starts and four portrait/landscape/desktop ratios, 1,006,708 actual vertices fit within all 48 view/depth envelopes. It compares 768 ordinary/flight/editor camera outputs exactly against the pre-change source and verifies vertical translation of flat arenas. Source manifest identities are asserted. Owned geometry and textures return to zero after disposal.

The accompanying receipt is functional camera math and actual-source geometry evidence, not a GPU benchmark or native appearance claim. The earlier native Alpine snow staircase remains a separate authored visual-edge defect; this camera correction does not hide it or declare Alpine representative art complete. Native high-altitude Overview, resize and view cycling review remain required.

The existing near-depth verifier also passes: 2,016 unchanged flight comparisons, 144 generic bounds layouts and all 488,896 inspected Coaster scenery vertices. Its actual-source case now supplies measured source heights instead of a previously unused nominal 450 m ceiling, matching the corrected host contract. The existing depth-gap requirements (more than four estimated 24-bit steps and 100× the old precision) are unchanged.
