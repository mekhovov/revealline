# Optional character pack r1 — local release record

## Artifact and distribution

The optional appearance pack provides 36 family/cast variants with shared CC0
MakeHuman body/clothing, original equipment and motion, live/distance rigs,
authored damage regions and wound caps. It is textured game art with realistic
proportions, not photorealistic art. Gameplay hitboxes and damage remain unchanged.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `manifest.json` | 52,499 | `8121b18a0a6c1ea2c625cb355ef2d5efee0ed6c1486a835d415c3119fc555357` |
| `characters.glb` | 13,557,808 | `bf99cfa8cfcdb6d20a11b3594eda0cfd5c0f9a85edf48e2fd55e6f4fa2e5c8ad` |

The download is **13,610,307 bytes** including its manifest. Source and detailed
provenance live in `authoring/library/fpv-character-art/r1/`. Only manifest, GLB and
provenance enter the main site's explicit build list; the pack stays outside the
bounded base FPV optional package. These are local working-tree artifacts, not
published deployment evidence.

Admission estimates: 60,691 unique POSITION vertices, 103,546,328 decoded bytes,
125,981,328 GPU bytes. The limits remain 24 MiB download, 16 MiB/model, 128 MiB
decoded and 160 MiB GPU. These estimates are separate from measured browser heap.

## Reproduction and the settled-clothing correction

The portable `authoring/rebuild.sh` documents source/tool inputs and isolated
Blender directories. The final two Node stages were rerun against the same raw
wardrobe export in a fresh output directory; both manifest and GLB reproduced
byte for byte. This checks finalization, not a fresh end-to-end Blender rebuild.

The in-game gallery caught a rest-pose mismatch: live sleeves were correct, while
settled body regions used idle frame zero. `settle-equipment.mjs` evaluates the
same authored idle pose and adds 25 transformed nodes sharing existing equipment
mesh indices. No geometry or textures are duplicated. The `remainsRoot` field is
validated independently; live bone attachments are unchanged. Independent
matrices computed through the browser loader agreed within 1.1e-7 per component.

Admission tests reject missing, skinned and over-budget remains roots. Consumer
tests check connected clean arms, parent/child transform preservation, shared
resource lifetime and blood/Brutal choices. All 36 actual-loader High-detail
clusters retain complete bodies within the 24-call effect cap.

## Player behavior

Selection, explicit download, verified cache, cancellation and Current fallback
use the separate appearance preference. Loading or changing art does not change
accepted attempt state, hitboxes, damage, results, radio profile or blood settings.
Restored remains use their saved identity without another defeat event or sound.
The same admitted model/recipe interfaces serve flight and Studio previews.

## Qualification

The final gallery and sustained desktop renderer report are linked from the
[presentation method](realistic-roster-method.md). The equipped-roster benchmark passed: 600.014 seconds, 35,453 frames and zero
errors. Total presentation CPU p95 off/on was Low 1.5/2.6 ms, High 1.4/4.1 ms and
Ultra 1.3/3.6 ms; all increases were below 3 ms on the reference M4 Pro. Effect
draw calls stayed within 16/24/40. Final admission, 107 appearance/package tests,
136 host tests, 54-file lint and generated-projection freshness checks passed.
No mobile or cross-browser performance claim is made.

## App delivery and selection

An isolated browser profile exercised Settings in the established test host,
which mounts the production World app with a test-only bootstrap. The protected
local page, password form and the user's profile were not part of this check.

- Selecting Realistic before installation retained Current art and made no pack
  network requests.
- The explicit **13.0 MiB** download fetched the exact 52,499-byte manifest and
  13,557,808-byte model. Admission completed and the renderer activated all 36
  characters with the final pinned identity.
- Switching between Current and Realistic preserved the complete accepted
  snapshot byte for byte at paused tick 479, including the attempt, actors,
  health and counters. Shot/hit counters were zero in this delivery scenario;
  sustained combat and recovery have separate evidence.
- Reloading with all character-pack requests blocked restored the installed
  cache, activated all 36 characters again and made zero pack resource requests.
- Built-in Workshop clean and bloody previews used the installed character art.
  Closing the preview removed its canvas and lost its graphics context. Final
  app disposal terminated both workers and disposed the main renderer, with zero
  browser or worker errors.

See the [UI delivery report](realistic-delivery-ui.md) for screenshots, exact
scope and limitations. Cancellation has focused automated coverage; it was not
exercised during the fast local UI download.
