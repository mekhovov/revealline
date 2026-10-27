# Peripheral FPV props — 2026-10-20

## Delivered

- Removed the long front arms, wires and diagonal carbon strips from the optional FPV presentation.
- Enlarged the peripheral propellers and placed them near the lower left/right edges. Curved blades retain the configured blade count and motor handedness.
- Added a shared 64 × 64 feathered exposure texture. Blade opacity decreases with throttle as the subtle blur increases. Rotation still advances with accepted flight ticks; pause freezes it and reduced motion suppresses it.
- Added a compact, cropped canopy with model palette, vents, fasteners and a center strip. Ducted craft retain their configured guards and a rounder canopy. Utility styling has a wider nose.
- Moved equipped weapon mounts onto the compact nose. Loadout-owned cosmetic plating follows the curved shell and disappears in course flight. It does not confer armor or change damage rules.
- Kept the existing shared FPV scene, material/texture disposal, camera pose, aircraft physics and saved props preference.

## Research applied

- [Liftoff’s optional prop visibility and camera clipping changes](https://www.liftoff-game.com/news/experimental-branch-update): keep visibility optional and omit camera-obstructing aircraft parts.
- [Liftoff’s translucent Gemfan props](https://www.liftoff-game.com/news/update-1410-released): translucent curved blades informed the material treatment.
- [VelociDrone’s official manual](https://www.velocidrone.com/desktop_manual): preserve the player’s camera angle/FOV and aircraft choices. Our foreground framing is an original implementation, not copied artwork.

## Evidence and limits

- Inspected the actual local Worlds view at approximately 1108 × 1163, FPV 82°, quality High, including visible rotation at 43% throttle, clear aim area and no arms.
- Saved `fpv-prop-view.png` from the local application.
- Restored the original Racer selection and USB radio control after previewing with keyboard. Radio calibration was not edited.
- Static review caught and corrected details intersecting the rounded canopy; surface patches now follow its curvature.
- ESLint and whitespace checks passed. No automated tests were added or run for this revision. Full preset/FOV/aspect and physical-radio coverage were not rerun.
- Package admission measurement passed for the local candidate; it uses synthetic revision identities and is not public-release qualification.

| Package | Runtime files / bytes | Source files / bytes | Source-input headroom |
|---|---:|---:|---:|
| Flight gym | 95 / 3,795,556 | 97 / 3,830,416 | 3,363,951 B |
| Academy | 145 / 12,074,266 | 147 / 12,116,217 | 14,979 B |
| Worlds | 208 / 19,278,158 | 210 / 19,328,386 | 501,227 B |

No new packaged file was needed. Unrelated workspace changes remain preserved.
