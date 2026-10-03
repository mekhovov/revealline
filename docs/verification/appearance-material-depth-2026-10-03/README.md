# Material-depth review — 2026-10-03

## What changed

The previous restoration recovered the six-pixel rims but kept control faces flat.
Historical filled SVG centers were also uniform: simply restoring border-image
`fill` would obscure semantic hover/selection colors without restoring surface depth.

Industrial now has original static steel grain across panel and control faces,
broad directional lighting, layered mechanical bevels, recessed input wells,
corner fasteners, small panel vents and ridged slider grips. Default steel becomes
amber with paired dark text on hover; a pressed control reverses its depth. No
control moves or changes size. Selection, error, disabled and keyboard focus cues
remain separate. No Factorio textures or artwork are distributed.

Other materials received their own finishes: black woven linen and panel stitching,
porcelain glaze, enamel hairlines, horizontal timber, diagonal composite facets,
LCD display film, copper brushing and warm satin. Obsidian, Deep Space and Moonlit
have derived variants that follow a community candidate's exact interface basis.
Their differences survive an independent game/SIM/Studio interface choice.
Desktop 98 keeps texture-free raised/recessed plastic; DOS keeps flat double rules.
The [reference and decision table](design-references.md) documents the individual review.

The Studio role inspector no longer paints inline colors or frame sources over
runtime rules. It displays the same native controls, role/state colors, materials
and focus behavior as the player. Uploaded asset frame previews remain independent.
The standalone SIM interface embeds the exact shared stylesheet.

## Browser evidence

- [Before](industrial-before.jpg) and [after](industrial-settings.jpg): the same
  local game Settings / Display screen, at 1280 × 720.
- [Industrial audio](industrial-audio.jpg): textured navigation and transport,
  recessed option group, raised checkboxes and panel ventilation details.
- [Actual pointer hover inside DOS](industrial-real-hover-in-dos.jpg): an Industrial
  specimen retains steel/amber material inside a flat DOS scope.
- [Studio role inspector](industrial-studio.jpg): real default, hover, pressed,
  selected, disabled, loading and error samples, with an independent DOS editor.

The browser review checks all fifteen appearances through a real-runtime fixture.
Reading twins use the same CSS as adjacent labels, leaving their faces blank so
captured pixels can be measured without glyph antialiasing. A first pass caught
insufficient contrast on two Dnipro blue actions; narrowing the white highlight to
the rim corrected it. Moonlit control fibres were also refined after visual review.

**361/361 reading twins pass**, covering 15 normal appearances and four high-contrast,
large-text, reduced-effects captures. The lowest normal result is **4.94:1**; the
lowest high-contrast result is **11.22:1**. The [measurement summary](rendered-contrast.md)
and `rendered-contrast.json` record final results and source screenshot hashes.
The browser provides JPEG bytes; the sampler decodes those bytes without changing
the original and requires an extra 0.2 ratio margin. This is captured-pixel evidence,
not a claim of lossless browser paint or certification for every device.

Off removes finish images and asset rims. High contrast removes decoration and
retains paired text; reduced effects removes control transitions. Native hover
changes steel to amber without changing the measured control rectangle. Nested
DOS/Industrial scopes were checked in both directions.

## Automated verification and limits

**441 tests pass across 51 files.** The final fixture assertions separately pass
19/19 after adding muted and combined-state cases. ESLint, formatting, and both
generated-presentation checks pass.

`integrated-tests.tap` and `integrated-checks.json` record the explicit appearance
workflow cohort, including World, Academy, recording compatibility, package bounds,
community themes and Studio. Pinned interface documents, SVGs, Arcade pixels and
SIM materials retain their existing golden digest. Bootstrap and embedded SIM
stylesheet checks detect generated-output drift.

This pass changes interface material rendering; it does not change simulation
geometry, physics, proof generation, campaign pictures or saved theme revisions.
Physical controller/touch checks and target-device performance qualification remain
open release gates. The existing full Company candidate edition also exceeds its
64 MiB distribution cap; no cap was raised or unrelated packaging rule changed here.

## Reproduce material checks

Serve the checkout, open `game/test/fixtures/appearance-materials.html`, select a
family and capture all states with its measurement JSON. Include Off, high contrast,
large text, reduced effects and nested themes. Run:

```sh
python3 game/test/fixtures/sample-appearance-contrast.py CAPTURE_DIRECTORY --output report.json
```

The fixture saves no player preferences and uses the exact production resolver and
stylesheet. The sampler accepts actual PNG or macOS-decoded JPEG screenshots,
checks dimensions and PNG checksums, samples every captured reading pixel, and
reports failures or missing captures explicitly.
