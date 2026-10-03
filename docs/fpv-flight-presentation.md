# FPV flight presentation: quad proportions and Container Yard

The first FlightDivision-inspired implementation improves original local model
geometry in the existing Three.js renderer. It introduces no downloaded or
extracted assets, decoder, dependency, runtime file, flight setting or physics
change. The production change is committed at
`297760213bf4a1e02c1542c151123f68857425e7` with the final fittings/pads refinement
at `604e2d579`, based on
`cf0b62e53d352c620f1793a3539c251e8932674b`. Publication and final browser/package
qualification are recorded separately; this document does not claim the change
is publicly live.

## Visible changes

Racer and Utility now have a narrower carbon frame and arms, a long battery
seated above the frame, fitted straps, a supported antenna and attached landing
feet. Four 12 × 11 × 16 mm TPU pads sit under the frame corners, sharing one
instanced draw call. The battery changes from 120 × 45 × 130 mm to 54 × 31 × 116 mm. These are
cosmetic dimensions; handling and the existing collision sphere are unchanged.

Three broad, swept blades form each rotor, with a modest geometric pitch that
remains visible in oblique views. Racer's cosmetic blade radius is 70 mm;
Utility's 59 mm radius remains inside its existing guard. Motor centres and
simulation-tick rotor motion are unchanged. The smaller, tapered motor bells
have ventilation slots and visible inner stators. A smaller camera sits between
carbon cheeks with pivot screws; its convex, low-roughness dielectric lens
produces actual lighting highlights instead of relying on an emissive disc.

Authored materials distinguish carbon, battery wrap, propeller plastic, alloy
and glass. Selected collections retain their existing shared material factory,
colours, texture maps and role bindings. Pixel geometry, materials and transforms
remain visually identical. The same factory serves inspection, chase views and
drone actors; the player's model remains hidden in FPV.

The six named Container Yard obstacles have closed corrugated steel shells,
recessed closed doors, lock bars and corner fittings. The shell has quieter normal
detail and flatter painted-metal response. Neutral brushed fittings reuse the
world’s existing hardware material; selected Themes use that world’s existing
steel kit and texture. Each body and fitting stays
inside its existing collider bounds; the deepest door inset is 62 mm. The
5.2 m bodies read as two stacked units. Opaque shells remain across all quality
presets; small hardware appears in Balanced and Quality. Pixel-filtered Yard
views retain the existing block presentation. Existing imported GLB scenery and
all other world construction are unchanged. The added detail belongs to the
near-field obstacle bodies and remains visible when the imported scenery hides
the procedural exterior fallback.

## Cost and ownership

Merged blades and instanced Quality motor windings offset the added detail:

| Authored Racer | Previous meshes | Revised meshes | Previous triangles | Revised triangles |
| -------------- | --------------: | -------------: | -----------------: | ----------------: |
| Performance    |              49 |             44 |              1,252 |             2,448 |
| Balanced       |              49 |             44 |              1,316 |             2,512 |
| Quality        |              91 |             55 |              2,416 |             4,180 |

These are CPU scene counts, not measured frame performance. Material and texture
counts do not increase. Each single container adds a 1,132-triangle shell and
336-triangle merged hardware geometry; the stacked form doubles those figures.
Fittings share an existing world-owned finish, distinct from the painted shell;
requesting it adds no material or texture. Geometry, instancing and materials use the existing renderer disposal ownership. No package limit changes.

## Reproducible verification

The manual CPU qualifier is separate from deferred unit-test coverage:

```sh
node scripts/qualify-fpv-flight-presentation.mjs --out /tmp/fpv-flight-presentation-cpu.json
```

It defaults to the baseline above and the current visual source. `--baseline`
selects another local Git revision; `--candidate-ref` qualifies a committed
candidate without switching branches. Both visual sources use the selected
checkout's shared dependencies. The complete before/after dependency comparison
belongs to the browser fixture below. Existing receipt files are never replaced.

The recorded CPU run passed **109/109** checks over three drone appearances, three
presets and authored/Industrial materials. It verifies exact Pixel visual data,
unchanged motor centres, analytic all-angle prop envelopes, guard clearance,
battery/strap and short-pad alignment, the camera assembly, material/texture
counts, existing world-owned fitting reuse, and finite
container geometry within its original bounds. All 150 exterior ray samples for
each container size meet an opaque, outward-facing shell. The receipt is
[`fpv-flight-presentation-cpu-20261003.json`](evidence/fpv-flight-presentation-cpu-20261003.json).
Syntax, focused ESLint, formatting and diff checks also passed.

Prepare a unique browser snapshot, then open the printed local URL:

```sh
node scripts/prepare-fpv-flight-presentation-verification.mjs --out dist/fpv-flight-presentation-verification-review
```

Use a lowercase output suffix. `--baseline LOCAL_REVISION` chooses the before
commit, `--candidate-base dist/PACKAGE` selects an already prepared package. `--candidate-ref LOCAL_REVISION`
uses a committed candidate without switching branches; `--source-root CHECKOUT`
selects its repository. `--verify-only` validates the closure without writing. No network fetch or Git
mutation occurs during preparation. The bounded snapshot contains at most
80 modules per side, 6 MiB per file and 40 MiB total. Every imported local module
is copied to a unique URL and its SHA-256 verified in the browser. Changes to
supporting modules are explicitly listed in the manifest.

**Show selected view** compares close-up models and fixed World FPV/chase/overview
poses. **Run visual qualification** checks actual production renderer output,
installed Yard GLB bytes and opaque container bodies, preset/appearance views,
other-world static geometry/material invariance, resource reload/disposal and
all three model appearances. It initializes each independent Rapier runtime
before constructing World poses. **Download receipt** retains the source hashes,
raw counts, pixel comparisons and diagnostics. **Download comparison image**
exports the currently rendered before/after pair as a labelled PNG from captured
WebGL pixels. Close-ups use the production model
factory with equal inspection lighting; they do not pretend to be scored flight.

The source-03 browser run exposed a fixture initialization omission and stopped
after three checks. The repaired source-04 fixture awaits both runtime instances;
the parent’s actual browser run passed **90/90 checks across 44 rendered pairs**
with no context loss. That result precedes the final fittings and short-pad
refinement. Source-05 freezes the final hashes and updated no-new-texture
assertions; final source and packaged browser runs each pass **90/90 checks across
44 rendered pairs**, with no context loss. Receipts are retained as
[final source](evidence/fpv-flight-presentation-browser-source.json) and
[final package](evidence/fpv-flight-presentation-browser-package.json). The only
packaged supporting-module change is the expected pruned locale catalogue.
Earlier frozen snapshots and failed evidence remain preserved.

Remaining qualification includes representative player fly-throughs, art
acceptance, sustained named-device frame
times and memory, and physical controller/mobile coverage. No broad photorealism,
commercial-map compatibility, physical-device performance or novice acceptance
claim follows from this increment.

Frozen candidate91945d5c0 passed all three optional package admissions, verified
committed inputs/ZIP members and two byte-identical builds.
[Admission receipt](evidence/fpv-flight-presentation-package-admission.json).
Package review and protected publication remain separate. `npm run validate`,
changed-source ESLint, syntax and formatting checks pass. The packaged player
loads Container survey, verifies its installed recording, and resumes actual
WebGL playback without rewards; browser inspection is not physical-device acceptance.
