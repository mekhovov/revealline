# Garage ramp, deck and column surfaces

This bounded art increment adds readable finishes to the existing Garage ramp,
upper deck and six columns. It starts from `822188e9bebdcf3d46119b48bfd0558e708eb051`
and integrates main `ce6af3e65`'s field-recipe fix while retaining that baseline's
Woodland foliage work. It is independent of the parallel Stadium art increment.

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
The fixture compares the pinned baseline with the current candidate using the
actual renderer. Its browser receipt is `window.fpvGarageSurfacesReceipt`.
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

Source browser review, committed package admission, packaged browser review and
publication remain pending for the integration owner. Physical-device
performance, novice-player sessions, broader art acceptance and deferred
regression/unit coverage also remain open. No package or public player is
qualified by this source-only handoff.
