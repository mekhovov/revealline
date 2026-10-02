# Racing Stadium demonstrations

World Studio adds 16 examples for all eight Racing Stadium challenges in
Self-level and Acro. The previous 72 Academy, Woodland Park, Ukrainian Courtyard
and Warehouse examples are unchanged. The catalogue now offers 88 demonstrations
across 44 challenges. Container Yard and Parking Garage stay playable while their
examples remain in preparation.

The Stadium examples cover the wide oval, chicane, altitude ladder, double
hairpin, moving hazards and mixed-gate capstone. Each recording completes its
exact original course with health 100 and zero contacts. Durations range from
26.58 to 78.38 seconds. At horizontal speeds of at least 1 m/s, the drone faces
forward throughout every recording; 99.39–100% of travel distance is within 45°
of its heading.

The pilot stages 4 m before each gate, settles, and crosses toward a point 1.8 m
beyond the plane. A line 0.9 m above the gate centre separates it from the
physical pace rival. Stadium 07 returns at 6.2 m above moving hazards before
landing on the unchanged pad. These are recorded inputs: routes, gate geometry,
actors, scoring, collisions and physics are unchanged.

The existing player supplies mode selection, pause/resume, restart, half speed,
FPV/chase views and **Fly this challenge**. Viewing earns no medals, completion,
playlist progress or personal-best comparison. An example must match the exact
normalized source, then reproduce its result against the pinned runtime,
response, rules and conditions before playback begins.

## Reproduction

The portable `authoring/fpv-worlds/demonstrations/generate-stadium.mjs` runs the
actual v2 runtime and records its consumed commands. A fresh execution of the
installed generator reproduced all 16 complete course/proof artifact SHA-256
hashes exactly. Independent replay confirmed completion, full health and zero
contacts. All 24 original v1 and 48 previous v2 proof hashes remain identical
after appending this batch.

`stadium-provenance.json` retains source/runtime hashes, generator identity,
per-artifact and per-proof hashes, heading measurements and verification evidence.
The new proof data totals 777,758 bytes. The generator stays in authoring tools
and is excluded from the player package.

## Player verification

- All 16 new proofs replayed in the final built Chromium runtime to completion
  with health 100 and zero contacts. The catalogue has 44 example links and
  accurately labels 88 mode-specific recordings; uncovered worlds get no example
  action.
- Wide Oval, Neon Chicane, Altitude Ladder, Double Hairpin, Crossing Lights and
  Stadium Final were inspected in FPV and chase views. Numbered gates remain
  readable along the demonstrated approaches, the rival has clearance, and the
  hazard return keeps the landing pad ahead while flying above the moving actor.
- Restart, mode switching, half speed and **Fly this challenge** passed. Playback
  remains timing-only and creates no personal-best or completion records.
- Offline reload retained all 44 example links and completed Stadium 01.
  Ukrainian coverage and playback controls fit a 390×844 viewport without
  horizontal overflow. The walkthrough reported zero JavaScript page errors.
- Focused lint, syntax, whitespace and package-closure checks passed. The separate
  playtest contains 75 files and 11,679,377 bytes.

Final built-browser findings are recorded in the provenance manifest. This slice
is a development playtest; physical-device performance and unfamiliar-player
qualification remain outstanding. The remaining 32 mode-specific demonstrations
and final-phase unit coverage are separate work.
