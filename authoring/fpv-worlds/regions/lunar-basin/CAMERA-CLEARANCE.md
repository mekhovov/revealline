# Lunar authoring camera correction

The first mixed terrain/scenery native review found the Broken rim view below the terrain. The same exact-source audit found Central mound was also below terrain: camera clearances were −5.014 m and −7.5185 m respectively. The original source, generated composition-r1 bytes, negative screenshot and frozen 9151 review remain preserved.

The correction raises those two cameras above the sampled terrain and raises Fracture fork slightly to the common 10 m review-camera clearance. No player start, target, terrain, landmark, physics or collision changes. All twelve fixed camera/target sightlines now remain inside their required resident grid cells and at least 2 m above exact canonical-triangle terrain, checked at 401 points each. Every camera is at least 10 m above the local terrain. This is a bounded camera-clearance check, not an assertion that every landmark is visible through other scenery or that the complete viewport lies inside the resident window.

Run `node authoring/fpv-worlds/regions/lunar-basin/verify-cameras.mjs`. The saved camera-clearance receipt is automated evidence; corrected native framing remains pending. Keep the source and connecting-flight PRs in Draft until that native gate is reviewed.

Use `companion=/region/terrain/region.json` for mixed-source review. The earlier `terrain=` handoff was ignored by the old preview and initially displayed scenery alone. That first observation cannot qualify mixed-source rendering.
