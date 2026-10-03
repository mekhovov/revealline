# Campus full-height facade levels

This bounded D2 increment gives the four existing closed Campus buildings full-height rows of solid Pixel panes, narrow storey bands, vertical piers and a roof cornice. It does not claim whole-world artistic completion. The base is `287eec95c81687fb8a6d176f750f7c65a60e1fe3`; the accepted renderer SHA-256 is `da58d19f101fb82ac0e4761d7b493940582c1b4467a7a68eb9871b91e75ec03f` (+3,429 source bytes).

## Scope and ownership

Only authored Pixel/nearest Campus (`rooftops`) plaster boxes with the four exact canonical IDs and dimensions receive the composition: west-low 18×9×20 m (3 rows), east-mid 18×14×20 m (4), west-high 18×19×22 m (6), east-high 18×23×22 m (7). Shared presentation collections and non-Pixel authored themes retain their prior visuals. Renamed, resized, rotated, typed or nonfinite boxes use the previous detail. Valid same-size translated boxes remain supported.

The existing eight flush marking batches, their two quality thresholds, material ownership and disposal remain in place. No extra GPU object, texture, material, base box, roof, bridge, collision surface or shadow caster is added. Canonical skybridge attachment bounds omit two painted panes where the bridge meets the closed wall; this is blank facade paint, not a new opening. The canonical four buildings contain 398 panes and 128 accent quads: 1,052 triangles, +540 over the former detail; position/normal arrays grow 38,880 bytes. A supported translated box arrangement without that attachment can reach 400 panes, +544 triangles and +39,168 bytes.

Low quality hides both existing facade batches and retains exact visible output. Expanded bounds of existing batches can alter frustum culling at some views: zero new batches is not a universal promise of identical per-frame submissions. Browser evidence records actual calls/triangles and bounds the additional detail.

## Qualification checkpoint

The manual CPU command `node scripts/qualify-fpv-campus-facade-levels.mjs --out NEW_RECEIPT.json` passed **780 checks across 138 scene cases** against the exact renderer above. [Complete CPU receipt](evidence/fpv-campus-facade-levels-cpu.json) covers all five Campus courses, three quality presets, all 17 shared collections, three non-Pixel authored profiles, thirteen other environments, strict negative guards, translated boxes, skybridge attachment, unchanged base/edge/UV/material bytes, flush closed-pane bounds, quality transitions and once-only disposal. World/obstacle scope stays at 40 geometries, 76 materials, 12 textures and six instance batches; raw texture storage remains 196,608 bytes. This CPU scope excludes camera/actor/objective/imported-model rendering, PMREM, browser GPU timing and flight proofs.

Root independently inspected the actual frozen source renderer at close 3 m, full facade 9 m, bridge-attached 23 m and overview views. The bounded facade composition was accepted: panes remain solid Pixel markings, height/bridge context is more readable, roofs and silhouettes remain unchanged. [Close](evidence/fpv-campus-close-review.png), [facade](evidence/fpv-campus-facade-review.png), [bridge](evidence/fpv-campus-bridge-review.png), [overview](evidence/fpv-campus-overview-review.png). Frozen v1 remains a preview, not a functional matrix result.

The full browser matrix, fresh authenticated ten-recording replay, clean source-bound optional admission and full admitted-player checks are pending at this checkpoint. Do not infer hardware performance, public deployment, installed/offline identity, new unit coverage or human-learning qualification from this source review. D6 additional unit coverage remains deferred.
