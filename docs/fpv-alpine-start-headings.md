# Alpine authored starting directions

The approved refined-contour revision previously used a generic heading toward the region centre. At Summit station this pointed the FPV camera into a nearby wing wall. The exact review-r2 Library pin now supplies explicit authored headings through the existing trusted presentation helper. No source descriptor, spawn position, terrain, collision, camera algorithm, flight model or recording is changed.

| Starting point | Heading | Intended initial view |
| --- | --- | --- |
| Glacial valley | East | Open glacial slalom between the erratics |
| Switchback pass | East | Clear terrace approach, with retaining terraces alongside |
| Snow saddle | South | Gap between the unequal pinnacles |
| Summit station | East | Open concourse between the station wings |
| Viaduct gorge | South | The central bridge bay |
| Reservoir dam | South | The clear spillway between the dam faces |

These hints apply only to descriptor SHA256 `a442a07717d09c703231279db41dd23c9447e0cc7f5f53aa3964eef4f74573ec`. The original review-r1 heading policy stays unchanged. Saved-place positions and headings remain authoritative. Unknown or rebound descriptors clear authored hints and retain the existing region-centre fallback.

Both Alpine rows also receive the agreed localized edition metadata: “Refined contours” / “Уточнені контури” and “Original study” / “Початковий варіант”. The separate Library accessibility change consumes these labels without changing immutable descriptor titles. The prior-row verifier allows only that display-only field to differ; delivery, appearance and heading settings remain protected.

## Verification

`node authoring/fpv-worlds/regions/alpine-highlands/verify-start-headings.mjs <exact review-r2 delivery folder>`

The production downloader verifies the unchanged pinned descriptor and local immutable payloads. Production mixed geometry sweeps confirm a 40-metre initial forward corridor, four metres wide, from every actual spawn altitude. Twelve session cases cover all starts in both modes: disarmed preparation, exact intended heading, unchanged position and scenery geometry, explicit arm, 100 accepted commanded ticks without contact, pause and disposal. Six saved-pose cases retain the stored heading; old/unknown pin fallback is checked. The exact receipt is `receipts-contours-r1/start-headings.json`.

This is functional geometry and lifecycle evidence, not native art acceptance, a flight-speed benchmark or physical-controller coverage. The frozen integrated package8cfd240f on9153 remains unchanged. Native first-person composition review of these new directions is still required, and broader Alpine representative art remains unfinished.
