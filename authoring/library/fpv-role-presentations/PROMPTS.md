# Body and rotor prompt contract

Use the complete effective prompt in each provenance JSON as the reproducible input. A compact starting pattern is:

> One original top-down pixel-art body, nose north, orthographic, genuine transparent alpha. Broad readable light panels and a distinctive silhouette at 16–32 screen pixels. Draw the chassis, arms and exposed circular motor hubs only. No propeller blades, discs, blur, action effects, text, logos, detached components or multiple views. Keep transparent margins and all rotating envelopes inside the complete source rectangle.

Give each role one dominant shape: camera shoulders, one support pod, six-hub twin pods, compact arrow, asymmetric spool, narrow split tail or open lattice. Describe the intended screen reading before decorative details. These are fictional craft; source references inform shape, not exact reconstruction or performance. Never copy reference pixels or overwrite reference files.

Requested canvas size and hub coordinates are instructions, not evidence. Read the actual generated dimensions and alpha, inspect the output, then author anchors against that exact image. If an output contains baked blades, an opaque backdrop or a clipped feature, preserve it as a rejected attempt and request an image-tool revision; do not silently clean or stretch it with a script. The accepted candidate here retains its original near-opaque pixels and faint alpha fringes.

The supported implementation is a static original body plus the existing procedural `rotors` recipe. `body.rotors` has independent source-relative `x`, `y`, `radiusScale`, `direction` and `phaseDegrees`; the recipe sets `bladeCount`, `bladeShape`, `radius`, `bladeWidth`, `idleRps`, `travelRps`, `maxVisualRps`, `blurOpacity` and colors. Follow [the existing animation contract](../../motion-lab/animation.mjs). Do not invent atlas frames or map an ability trigger to a cosmetic component without a separate runtime design.

The small authoring preview and verification are acceptance inputs. Review actual-size silhouette separation, source-center pivot, hub alignment, forward motion, four headings, pause and reduced motion. Keep author/source review distinct from runtime integration, browser gameplay and production approval.
