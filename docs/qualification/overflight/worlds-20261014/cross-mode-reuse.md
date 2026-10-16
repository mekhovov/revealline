# Shared battlefield adoption

The new worlds have actual runtime consumers beyond FPV Survivals. Default appearances are unchanged.

| Consumer | How to select | Reuse and boundaries |
| --- | --- | --- |
| Solo and Duel | Settings → Appearance → Covered ground | The shared board painter samples the native world into opaque unclaimed-cell spans. Revealed reward pictures, terrain collision, danger markers, actors and capture rules remain owned by the mode. |
| Team | Settings → Appearance → Covered ground | Uses the same native world surface below Team walls, active materials and actors. Horizontal span drawing bounds draw calls instead of drawing a separate texture for every cell. |
| Snake | Board look → FPV Survivals battlefield | Its existing scene selection maps to the three worlds. The actual shared painter feeds the existing terrain cache. Custom wall imagery stays in place. |
| SIM | Workshop → Authored theme → an FPV world; Settings → World appearance → Authored appearance | Creates an explicitly selected authored profile. A one-time 1024×384 native-world texture replaces only the generated floor material; SIM retains its 3D geometry, camera, obstacles, movement and collisions. |

The 2D ground choice is a cosmetic display preference, independent of mission and gameplay identity. Pinned chapter environments, custom terrain sources and explicit background overrides bypass it. Authored ground remains the default. Failed persistence retains the choice for the current visit and displays a notice; unsupported future preference records are not overwritten.

SIM profiles are exact opt-in copies apart from the independently selected Racer, Pixel or Utility drone. Retained pinned profiles, imported meshes and customized terrain profiles are never automatically converted. Creator's existing explicit theme-change operation detaches a retained environment only through its established editing flow. The original floor textures are disposed before the replacement is registered; the new texture is disposed by the existing renderer owner. It adds 1.5 MiB of base RGBA texture, no mipmaps and no new mesh.

Tall trees, containers and antennas are omitted from playable ground projections. These are low decorative surfaces rather than new collision geometry. Interface themes, drones and original reward pictures remain separate.

Focused integration tests exercise the actual Solo/Duel shared painter, Team painter, Snake renderer and native SIM world builder. They check identical gameplay state, exact covered-cell placement, bounded caching, custom/pinned preservation, translated controls, SIM profile serialization and texture disposal. Existing painter and SIM asset-loading tests are also run. These checks establish integration and ownership; native camera-specific contrast and complete mode playthroughs still need visual review. The new shared choice should not be described as a complete animation or combat-state rollout across all modes.

## Native review — 14 October 2026

Captured on the working implementation based on `29e3bd4a831834c55b8ecf14a204b14784252f38`, at `localhost:8901`, in the Codex browser at 1280×720. This hostname provided current modules without clearing any existing user cache.

- `solo-battlefield-settings-native.png`: native shared Display & Language panel, Freight Depot selected, existing UI theme unchanged.
- `sim-field-authoring-native.png` and `sim-field-material-preview-native.png`: Field Crossing selected in the existing Workshop; the actual 3D Creator preview uses the shared ground artwork.
- `sim-field-native-overview.png`: the same shared ground in the native mission, preserving stadium geometry and the separately selected Racer. Native review caught and fixed an overly strict profile matcher that had discarded the ground after drone selection. A regression now exercises the actual appearance snapshot path with all three drones.
- `solo-depot-native.png`: classic First Signal running with Freight Depot ground. The first mission completed through a native directional input. `solo-depot-reveal-native.png` then shows the next mission at 52.2% captured: original orchard reward picture on the captured side, shared Depot artwork only on the unclaimed side, normal relay and score feedback. The review run was left paused.
- The initial Solo Journey launch exposed `Required actor slot is missing: overflight.soldier.lookout.tactical`; its UI reported the picture unavailable. The shared lease contract was subsequently corrected to preserve historical actor requirements. `solo-original-picture-loading.png` captures the earlier loading state only, not a passed preservation check.

The SIM screenshots are from the ready, unarmed scene. They establish Creator-to-native visual reuse, not complete flight usability or performance qualification. Full per-mode movement and combat-state reviews remain outside this material-adapter evidence.

## Merged-source verification

After reconciling the parent branch and current main at `c375324951b4b510e8dd5a1814289da287300d2d`, 57 focused Snake/SIM/ground tests and 20 Snake remaster composition/art/motion/audio tests passed. The merge preserves main's 240 mission definitions, 35 chapter directions, modular structure artwork and `snake-worlds-v5`; the optional FPV appearance remains a separate branch. Existing looks retain the new remaster floor plans, while FPV ground and backdrop reuse stays opt-in. An additional 63 shared sound, humanoid reaction, Overflight ambience/commentary and recorder tests passed. No browser gameplay or GPU workload was started during this verification.

Earlier native captures remain identified as pre-merge working-tree evidence. They were not silently relabeled as captures of this merged commit.
