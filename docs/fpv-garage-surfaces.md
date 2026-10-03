# Garage ramp, deck and column surfaces

This bounded art increment adds readable finishes to the existing Garage ramp,
upper deck and six columns. Its original baseline was
`822188e9bebdcf3d46119b48bfd0558e708eb051`. Final qualification compares with main
`a1cb86c85cd52db7256ad2ed16c30c8f40f90c32`, including the merged Stadium, Field
recipe and Woodland tree-form work. The original Woodland foliage finish remains
present alongside the new published crown lobes, branches and exterior tree turns.

## Visible change

- The ramp and deck use a matte concrete finish with six-metre pour joints and
  restrained wear. World-aligned UVs keep the finish continuous across the crest.
- Flush enamel edge bands run up the slope and continue around the deck's side
  and rear edges. Paint uses the same world-aligned UV phase at the crest. The
  slab's exposed fascia has a thin stripe; its front seam remains open and its
  underside remains unchanged.
- The six columns have painted lower bands and original geometric numerals
  1–6. The number plates and bands sit on the existing faces. They are readable
  on Low, Balanced and High without changing the existing High-only accent.

The new details are 14 opaque material batches and 572 triangles across eight existing solids.
They use polygon offset to avoid surface flicker, receive shadows, and do not
cast additional shadows. No rail, bumper, barrier, opening or support is added.
The 25 cm gap beside the ramp's right edge remains the same authored gap.

`renderer.mjs` selects `garage-concrete` through the environment's exact-ID
selector. `buildGarageSurfaceGeometry()` in `world-visuals.mjs` returns separate
enamel and rubber batches: local coordinates for boxes, and the original world
coordinates for the ramp's trimesh. It refuses incompatible ramp topology.
Production changes are confined to these two visual modules.

## Preserved contracts

Only `garage-ramp`, `garage-deck`, and `column-[01]-[0-2]` opt in, within the
Garage environment. The authored solids, winding, transforms, IDs and physical
triangles remain unchanged. So do collision/support queries, bounds, fog,
visibility, route steps, actors, proofs and saved identities.

The full current catalogue contains 196 unique entries: 138 world entries and
58 school entries, including the 12 legacy routes. Its 18 Garage entries include
nine canonical courses (`garage-01`–`garage-08`, `beginner-41`) and nine Snake
courses. Snake's `target-platform-*` and `obstacle-*` geometry receives none of
this detail. Beginner 41's separate `school-upper-deck` remains unchanged,
including its plain material and UV mapping. Garage 02 still lands on
`garage-deck`; Beginner 41 still lands on `school-upper-deck` and the floor.

The concrete body is labelled with the concrete material role. A shared Themes
collection supplies its own concrete, rubber and enamel textures. Authored
Garage resolves to the Operations profile with linear filtering; the existing
Pixel profile resolves to nearest filtering and keeps all of the new paint and
numerals. Pixel is exercised through a renderer-only course clone with
`world.theme = 'pixel'` and authored presentation: there is no built-in SIM
collection named `pixel`. The course used for retained proof identity is never
modified to make this appearance preview.

Both source paint and renderer clones stay reachable through the world's normal
material ownership. Detail caches clear on course replacement and final disposal.
The kit keeps texture ownership; no external image, font, model or package
dependency is added.

The indoor walls, roof, glass and canonical obstacles are the primary Garage
scene. Imported scenery supplies distant exterior buildings, vehicles and lights;
it replaces only the procedural backdrop. This increment does not alter the
imported scenery template, manifest or filtering contract.

## Reproducible functional qualification

Additional unit-test coverage remains deferred to D6/R7. These commands prepare
and exercise a bounded manual fixture; they do not add unit coverage:

```sh
node scripts/qualify-fpv-garage-surfaces.mjs
node scripts/prepare-fpv-garage-surfaces-verification.mjs \
  --out dist/fpv-garage-surfaces-verification-source
node scripts/game-cli.mjs serve --port 8836
```

Open `http://127.0.0.1:8836/dist/fpv-garage-surfaces-verification-source/`.
The fixture compares the pinned main baseline with the current candidate using
the actual renderer, and records the original baseline separately. Its browser
receipt is `window.fpvGarageSurfacesReceipt`.
The output directory is immutable: use a fresh descriptive suffix for each
candidate. `--verify-only` preflights the selected candidate and baseline import
closures without writing a fixture; it does not recheck an existing output.
The functional command accepts `--out NEW_RECEIPT.json` to retain a new receipt;
existing evidence files are never overwritten.

The functional command derives catalogue and Garage counts from the current
modules, compares canonical course/recording bytes with the baseline, checks
the eight target solids and excluded Snake/school objects, and runs every
installed Garage demo through the actual replay API: 16 original mode-specific
recordings plus Beginner 41 Acro, 17 total and 38,251 command frames. Real support
probes cover the ramp toe, middle, crest, upper deck, floor under the deck and
school deck. Reported support heights preserve the solver's actual integer
answers, including its radius/slope correction, rather than idealized plane
coordinates.

In the browser, inspect near-flight slope, crest, deck underside and column
views; switch all three presets, authored/Pixel/shared Themes, original/school/
Snake courses, and imported/procedural scenery. Confirm the markings remain on
the real solids, do not block the flight line, and survive course replacement
without disposed or growing texture/material ownership. Retained courses,
support witnesses, collision identities, bounds and fog must match the baseline.
Each unrelated non-Garage control world uses fresh renderers and retains exact
zero-pixel comparisons across its Low/Balanced/High sequence. Separate continuous
multi-course cycles verify resource stability; every renderer owner is disposed.

For a later committed package candidate, build and admit the exact committed
inputs before generating a second fixture:

```sh
node scripts/build-fpv-worlds-playtest.mjs --out dist/fpv-garage-surfaces-playtest
node scripts/bundle-optional-practice.mjs \
  --out .cache/fpv-garage-surfaces-admission \
  --packages civilian-flight,civilian-fpv,fpv-worlds
node scripts/prepare-fpv-garage-surfaces-verification.mjs \
  --candidate-base dist/fpv-garage-surfaces-playtest \
  --out dist/fpv-garage-surfaces-verification-package
```

Admission verifies committed-input digests, package limits, ZIP membership and
two byte-identical builds. Compare the prepared fixture's recorded module hashes
with the admitted candidate and run the real browser fixture again against the
packaged modules. A source receipt does not qualify a package or public launch.

## Qualification status and limits

Local `npm run validate`, `npm run lint`, changed-file formatting and the manual
functional command passed. The retained CPU receipt is
[`fpv-garage-surfaces-cpu.json`](evidence/fpv-garage-surfaces-cpu.json): 148 checks,
17 exact demonstration results, 30 support probes and three elevated
landing/departure witnesses, including four matched crest vertices with equal
paint UV phase. The bounded browser fixture prepares successfully;
preparation alone is not browser verification.

Candidate `79c68c0c8` passed all three optional package admissions with two
reproducible builds, committed input verification and ZIP member checks. Its
packaged browser fixture passed 528 checks and 249 image pairs; 32 frozen candidate
modules matched the player and admitted Worlds ZIP exactly. These receipts remain
bound to that pre-Woodland-integration candidate. Final integrated package admission
and observer review are reported separately by the integration owner. Physical-device
performance, novice-player sessions, broader art acceptance and deferred
regression/unit coverage remain open; no public launch is inferred from the
package fixture.

An earlier run of the original, unmodified fixture against candidate `6b00a2e6d`
reported six differing pixels out of 518,400 in Courtyard Balanced after hundreds
of prior loads. The candidate buffer matched both sides of a subsequent
48-frame diagnostic, including a baseline-against-baseline control; all generated
scene, UV, material, texture and ray hashes matched. A second run of that original
full fixture passed all 528 checks and 249 image pairs without changing its
assertions. The first result remains an unresolved transient, history-sensitive
rendering observation, not a proven shader warmup defect. The fresh-owner control
scope above keeps zero tolerance and does not claim to resolve every long-session
rendering variation.

The refreshed source fixture for `79c68c0c8`, compared with main `53907d8d`,
reported one differing pixel out of 230,400 in Courtyard Low, with equal draw,
triangle and shader counts. That source control is a disclosed non-pass; its
pixel assertion was not relaxed. The final packaged fixture passed the same
zero-tolerance comparisons. A 70-draw focused diagnostic found zero pixel
differences while semantic draw-submission order varied for both the candidate
and an unchanged baseline duplicate. A full baseline-duplicate history completed
528 diagnostic checks and 249 image pairs; Garage-change expectations in that
diagnostic are deliberately non-blocking and are not a feature qualification.
Existing imported-material submission-order variability is a renderer determinism
follow-up. The evidence does not prove it caused either isolated pixel deviation,
and this Garage increment does not change the loader, sorting or comparison
tolerance to address it.

Current-main integration `a1cb86c85` preserves the complete renderer and Garage/
Stadium helper functions byte-for-byte from the browser-qualified candidate.
The only changed visual function adds the incoming Woodland tree forms. A
separate CPU comparison matched all 162 Garage visual-input cases (18 courses,
three presets, authored/Pixel/shared Themes) and all 100 generated non-Woodland
GLBs exactly. The refreshed Garage qualifier passes 148 checks and all 30
existing scoped visual/acceptance checks pass. These semantic comparisons support
a bounded final observer review; they are not a new full browser-matrix receipt.
