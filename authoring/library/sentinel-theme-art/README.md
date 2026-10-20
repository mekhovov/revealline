# Sentinel theme picture candidates

Each image came from one independent built-in `image_gen.imagegen` call using the
complete approved prompt in [prompts.json](prompts.json). There were nine calls,
no input images, no retries and no edits. The tool originals remain at their
recorded paths, and the PNGs here are byte-for-byte copies. There was no cropping,
resizing, reencoding, palette conversion or metadata stripping. All nine actual
outputs are 1774 × 887 RGB PNGs, total **23,108,412 bytes**, each below the unchanged
4 MiB still limit and within 1920 × 1080. These dimensions are observed outputs;
generation was not repeated to obtain that width.

| Theme         | Listening Court                                                   | Switchyard Gates                                                      | Open The Circuit                                                       |
| ------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Ukraine Atlas | [Courtyard of quiet craft](ukraine/originals/listening-court.png) | [Carpathian station exchange](ukraine/originals/switchyard-gates.png) | [The mountain thread hall](ukraine/originals/open-the-circuit.png)     |
| 1994 Forever  | [The radio-repair courtyard](retro/originals/listening-court.png) | [After-hours cassette dispatch](retro/originals/switchyard-gates.png) | [The hilltop night transmission](retro/originals/open-the-circuit.png) |

The three compositions progress from an open court through two gates to a large
circular landmark. Their broad silhouettes and detailed foregrounds follow the
existing [FPV Sentinel cohort](../sentinel-circuit-art/README.md). Each themed
composition was generated independently; those FPV originals remain unchanged.
The scenery suggests observation, a controlled crossing and a final connection.
Painted paths, gates, light seams and cables do not define gameplay routes,
equipment effects, hazards, boss schedules or objective positions.

Ukraine material references were primary text pages: the Pyrohiv museum's
[Novi Sanzhary forge](https://www.pyrohiv.com/exponat/kuznya-iz-selishcha-novi-sanzhari)
informed household ironwork and timber/clay vocabulary; a Chernivtsi University
[handloom workshop account](https://art-deco.chnu.edu.ua/novyny-kafedry/ekspedytsiia-do-sertsia-hutsulskoho-lizhnykarstva-an-expedition-to-the-heart-of-hutsul-lizhnyk-making/)
informed wool and loom materials. The railway-operated
[Kyiv page](https://dytiacha.uz.gov.ua/kyiv) supplied general rail and viaduct
context, not a location claim. No reference image was downloaded or supplied to
the generator; no particular maker's pattern or symbolic meaning is attributed
to the generated cloth. Reference roles and access dates are retained in
[provenance.json](provenance.json).

[generation-results.json](generation-results.json) preserves each tool path,
verbatim output hint, complete-prompt SHA-256 and output bytes/hash.
[provenance.json](provenance.json) also records per-image observations and the
unchanged source-context pins. [verification.json](verification.json) records
all PNG chunk CRCs, bounded full scanline decoding, pixel hashes, exact file pins
and the 15 protected context files. Run from the repository root:

```sh
node authoring/library/sentinel-theme-art/verify.mjs
```

This check reads source files and uses the existing unchanged RGB PNG decoder.
It emits no image or runtime files. `--record` creates the initial verification
file exclusively and refuses to overwrite one. No game tests or site build are
needed for this art-only check.

Future adoption must bind each picture to its exact authored theme/mission and
presentation through a reviewed chapter compiler, preserve original backups and
respect the existing pack/index and managed-media budgets. Native partial-reveal
contrast, storage, saved/earned ownership, offline behavior and public delivery
remain unqualified here. These nine stills are not animations, nine stories or
finished music, and do not complete the 116-picture content target.
