# FPV propeller camera-plane correction

## Delivered

The cosmetic propeller groups were pitched 1.25 radians (about 72 degrees) toward the camera, turning their authored XZ rotor plane into a camera-facing fan. The shared renderer now uses a shallow 0.1-radian mounting angle and compensates for the actual camera tilt in radians. Projected depth and height bounds keep the swept blades above the central flight corridor and near the upper corners.

Black three-blade nominal ten-inch geometry, spin, speed-dependent blur, foreground settings, nose and knife remain owned by their existing production helpers. This change does not alter the real flight camera, aircraft collision geometry, aiming or physics. Academy, native Worlds and regional Worlds use this same positioning helper. No runtime file or asset is added.

The official [UFDS gameplay gallery](https://store.steampowered.com/app/2862860/Ukrainian_Fight_Drone_Simulator_UFDS__FPV_drone_simulator/) and the player's supplied images informed the peripheral, foreshortened composition. Geometry remains original; the reference is not evidence of a particular physical camera mounting angle.

## Inspection and package evidence

Manual browser previews import the production foreground builder and positioning helper. Captures cover landscape at FOV 82 / camera tilt 0, square at FOV 82 / tilt 25, and portrait at FOV 60 / tilt 0, with different blade phases. These are geometry previews in a simple scene, not complete gameplay acceptance captures. The local full SIM was also inspected in flight without changing the player's radio settings.

- [Landscape preview](evidence/fpv-combat/prop-plane-landscape.png)
- [Tilted-camera preview](evidence/fpv-combat/prop-plane-tilt.png)
- [Portrait preview](evidence/fpv-combat/prop-plane-portrait.png)
- [Package measurement](evidence/fpv-combat/prop-plane-package-measurement.json)
- [Source identity and inspection scope](evidence/fpv-combat/prop-plane-delivery.json)

Both packages construct within unchanged policies: Academy has 145 runtime / 147 source files and 89,146 input bytes of headroom; Worlds has 208 runtime / 210 source files and 515,217 input bytes of headroom. The receipt uses placeholder build identities and is not release evidence.

Syntax and diff-whitespace checks passed. No automated suite was run. Exhaustive camera/rotor-phase combinations, physical-radio flying and performance qualification remain pending.

## Integration

This focused child is based on frozen radio-autosave parent `2951625582f63bf4d8e78461a1177507a6c840ef` (#1800). It does not modify frozen #1799 or #1800. Releases must reconcile it after the parent integration. Separately, the player confirmed that radio switch assignment persists after closing and reopening setup without Save.
