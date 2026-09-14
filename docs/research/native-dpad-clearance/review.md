# Landscape D-pad and Tactical containment review

Source `7393a404` adds D-pad side clearance. The follow-up CSS hash in `evidence.json` identifies the two-line containing-block correction used for the final screenshots. This is source-preview verification, not a release or physical-device certificate.

The in-app browser loaded the real game through a wrapper configured as an 844×390 CSS iframe. Full-page captures 24–32 retain the browser's full-page scaling; viewport captures 34–37 show the configured iframe at a larger visible scale. All JPEG bytes are retained without cropping or editing. No numeric DOM rectangle measurement is claimed.

## What passed

- Arcade: both hands × both touch sizes × both text sizes. The entire board stays visible with four distinct D-pad arms beside it. The four visible buttons accepted successive clicks in Right/Regular/Large-text mode.
- Tactical: after the correction, Right/Regular and Left/Large with Large text show the complete board and opposite Scan/Boost controls. Escape can focus and pause the arena again.
- The running game retains its compact HUD; ordinary Arcade has no manual equipment buttons.

## Defect found and corrected

The legacy classic/open selector also matched a hidden status card. Its higher specificity kept the Tactical parent panel narrow. D-pad clearance then subtracted two side reserves from that narrow parent, reducing the inner board to zero. Screenshot 34 records the failure. Switching Off in the same flight restored the narrow board (35), supporting the source diagnosis. The running parent reset now includes that exact state; screenshots 36–37 show the corrected full board. Paused layout and the compiled inner-board header cap are preserved.

## Limits and retained failures

The original Node22 five-file D-pad run passed 39/41; two first-cut cases remained pending picture readiness. A diagnostic copy passed 1/2, not original-source pass credit. Node20 compact/hand/steering checks passed 21/21. No timeout was relaxed. The cause of pending readiness remains unproven; a separate source trace records the possible asynchronous preparation stages.

Physical touch comfort, numerical hit rectangles, nonzero safe insets, all Tactical warning transitions and the later merged/packaged source still need qualification. Optional Equipment Workshop installation was unavailable in this session-only tab; the built-in Tactical level was used. A notice that another tab owns saving remains visible in these previews and is not an assertion of writable-profile testing.
