# Onboard FPV crop revision — 2026-10-20

## Changes

- Removed motors, bells, hubs, nuts, arms and stationary guards from the optional camera foreground. The physical aircraft is unchanged.
- Enlarged curved blade sweeps to a nominal 127 mm radius, with about 2.5 times the previous projected span at the inspected 82° view. Invisible pivots sit below the lower screen edge, showing only the rotating portions of the props.
- Added independent width/height and depth caps so narrow screens retain a clear middle and wide fields of view cannot move the rear blade arc into the lens.
- Strengthened feathered exposure blur while retaining configured blade count, handedness and paint. Rotation uses accepted simulation ticks; pause and reduced-motion behavior are preserved.
- Replaced the tiny detailed canopy with a broad, shallow cropped frame lip. Removed microvents and screws. Utility and ducted aircraft retain wider/softer profiles; the selected paint appears as one simple strip.
- Combat plating follows the same broad surface. Equipped barrel ends and flashes extend beyond the front lip after review caught possible occlusion by the enlarged shell. This is appearance only and does not confer armor or change weapon rules.

## References and interpretation

- [iFlight Helion 10](https://www.iflight.com/cn-helion-10.html): 10-inch prop scale, aeroshell and frame/camera relationship.
- [Mihail Svilenov's Helion 10 flight review](https://www.youtube.com/watch?v=A7vrEx-nSPM): inspected the Flying the Helion10 chapter, including airborne footage around 11:17. That footage has a clean forward view; it does not establish that every 10-inch aircraft shows its propellers.
- [Rekon 10 Pro builder's camera-placement notes](https://www.rotorbuilds.com/build/33696/): prop intrusion depends on the camera mount even with a deadcat frame.
- [Liftoff optional props and camera clipping](https://www.liftoff-game.com/news/experimental-branch-update) and [translucent props](https://www.liftoff-game.com/news/update-1410-released): retain a visibility option and omit obstructive parts.

The resulting crop is an original presentation of the user's requested visible-prop experience, not a geometrically exact reproduction of one reviewed aircraft or copied simulator artwork.

## Evidence and limits

- Inspected the actual local application at 1108 × 1163, High quality, 82° FOV, in Original course and Target hunting. Inspected props at idle, 43–65% throttle and in flight, plus the combat armor lip and exposed barrel ends.
- Screenshot: `fpv-camera-crop.png` (Target hunting, airborne). The center and horizon remain clear; the shallow lip occupies approximately the bottom 9% at this aspect, with blade tips entering from the corners.
- Restored Original course and USB radio after previewing. No calibration or saved radio bindings were edited. No real-radio flight pass was performed.
- Read-only review confirmed no motor geometry, near-plane clearance and retained material/texture ownership. ESLint and whitespace checks passed. No automated tests were added or run for this revision; the entire preset/FOV/aspect matrix was not exercised.
- In-memory package admission passed using synthetic candidate identities; this is not public-release qualification. No new packaged runtime file.

| Package | Runtime files / bytes | Source files / bytes | Source-input headroom |
|---|---:|---:|---:|
| Flight gym | 95 / 3,795,556 | 97 / 3,830,416 | 3,363,951 B |
| Academy | 145 / 12,071,812 | 147 / 12,113,763 | 17,433 B |
| Worlds | 208 / 19,275,704 | 210 / 19,325,932 | 503,681 B |

Package details: `fpv-camera-crop-packages.json`. Changes remain local in the isolated workspace.
