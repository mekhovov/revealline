# Ukraine Atlas enemy bodies — source candidates

Seven independent enemy-body originals for the existing Ukraine Atlas roles. These source candidates use invented wood, bronze, enamel and stitch motifs from the theme palette. They are not historical reconstructions, new enemy mechanics, runtime bindings, animation rigs or a shipped pack.

| Existing type | Art direction | Existing role represented |
| --- | --- | --- |
| bouncer | Embroidered Beetle | Moving hidden-field threat |
| border-patrol | Swift Moth | Original-perimeter patrol |
| contour-patrol | Frontier Serpent | Changing captured-frontier patrol |
| claimed-rover | Clockwork Hare | Dormant body that wakes on captured ground |
| eroder | Thorn Wheel | Warned reopening of eligible captured cells |
| lane-boss | Storm Gate | Stationary timed lane emitter |
| relay-sentinel | Sunflower Keep | Linked staged core and legitimate opening |

The source is based on e9928cdaad2f55d912aadd2ef25f635fb99e938c. Current theme names, palette, enemy catalog, project Asset Creator/Character Collection skills and the enemy-role-skin workflow grounded the prompts. The existing Ukraine bell, Petrykivka courtyard and compact FPV field-hunter tank example were viewed before generation. No image pixels were supplied to imagegen; each body has one separate text-only call, an unchanged tool original and its exact prompt.

The common brief asks for north at image top, broad ivory edges, a coral orientation cue, complete appendages, transparent surroundings and large pixel clusters. Shape variation is deliberate: six-legged oval, bow-tie wings, thick S, two-ear hare, root wheel, open U and fortified sunflower diamond. Prompt examples are retained in prompts/; role-briefs.json records the exact text sent, with prompt files adding one formatting newline.

The originals remain untouched. The workspace images are exclusive independent APFS clones of the tool outputs, with no fallback copy or image editing. The whole tool originals were viewed with view_image; inspection/inspect-alpha.py performs a read-only Pillow decode and records real alpha, margins and color counts. It never saves image pixels. The CSS board displays these same files at 24, 32 and 56 CSS pixels over black and a revealed courtyard crop, with North/East and Auto/Pixelated options. CSS sizes are illustration frame sizes, not actor contact diameters or physical-device certification.

The 16–20-color and 8% margin brief is an aim, not an achieved palette contract. Repeated ornament, blended edge colors and low-alpha fringes remain. The moth is almost full width; the serpent, hare and north wheel tip leave tight margins. The wheel has five outward teeth rather than the requested six. The hare's shading gives some raised/front-face reading. These variations are preserved, with actual measurements and native observations recorded separately.

Only whole-image frame center (0.5, 0.5) and north orientation are proposed for a later binding review. Legs, wings, serpent bends, hare limbs and wheel teeth are baked into one image. Separate layers or additional originals would be needed for articulated motion. Future warning/core surface marks must stay within the body and use existing clocks; no warning timing, collision boundary, route, heading logic or live metadata is changed here.

This cohort is held outside frozen v0.42 and the current release. Adoption requires a later runtime/memory/readability review and production animation work. Existing overrides, palettes, game catalogs and build configuration are untouched.

All seven actual outputs are 1254 × 1254 RGBA 8-bit PNGs totaling 6,441,927 bytes. Each has fully transparent surrounding pixels; predominant nonzero alpha is 253. At alpha ≥128, the distinct RGBA counts range from 79,136 to 133,325, and no substantial body meets the frame edge. Low-alpha fringes do reach some edges. The raw original-plus-equal-size-Git allowance and 2 MiB inspection reserve total 14,981,006 bytes; even charging the existing shared scene clone at full logical size totals 18,267,355 bytes, below the 32 MiB cohort cap. Final staged Git accounting is separate.
