# Foundation authoring: generation, play, export and recovery

Exact game source: `8cffb36b29a38013eb9213845efd675c4864c9d8`. This is a complete trial of the existing small procedural teaching example, not complete P17 or public release acceptance.

A fresh authoring directory contained 35 exact committed modules/template files (315,108 bytes), listed in `source-inputs.json`, plus a local `package.json` declaring ES modules. `execution-receipts.json` records that local configuration, actual runtime versions, commands, outputs and pack hash. It used normal Node imports, file reads, validators and simulation. No module loader or image decoder was substituted. This was a minimal authoring closure rather than a full repository checkout/build.

## Generated and saved artifacts

| Artifact                  | Bytes | SHA-256                                                            |
| ------------------------- | ----: | ------------------------------------------------------------------ |
| `foundation-pack.json`    | 5,270 | `81232e84fee5389f4566dffc489b498e1e3ea82de21f458f3ac85cc0a4c06611` |
| `downloaded-library.json` | 3,605 | `6ec2b4ec4f4c31e9d30f18d10e5223b2b45510d0cbac0fca4262f040a153d65b` |

Both Node 20.19.5 and Node 22.22.2 generated identical pack bytes. Both Immediate and Grid + buffer fixed-tick routes won with three lives: 978 ticks, 24.0764% coverage and 5,670 points. Their complete reports are retained separately by runtime.

The browser export was found as the newly saved `revealline-expansion-packs (2).json` in Downloads and copied unchanged to this record. The browser download-event observer timed out after ten seconds; that timeout is retained as an observation limit, not a failed export claim. File modification time, identity, byte count and SHA are in `download-receipt.json`. Both runtimes checked the actual file against the expected prepared-library export and a complete import/export round trip.

## Browser journey

At 1280×720, source origin A installed the generated JSON through Settings → Game data → Installed chapters. Play closed Library/Settings and focused explicit Start. Ordinary Left made the first 1.2% connection, then Right completed the map at 49.9%, 11,750 points, three lives, GOLD and 0:33. The native route differs from the CLI route. Results showed Campaign complete and Browse campaigns.

After actual export, fresh origin B started without installed teaching content or earned pictures. Importing that exact downloaded file restored Island connections 1.0.0 and First bridge’s 20% target, three lives and explicit Start. Collection remained empty. After reload, Home Start launched First bridge; Left captured 1.2% and 290 points, then Escape paused with Resume focused. The source origin retained its original result and earned picture after export.

`native-evidence.json` separates the two local origins, exact served-byte verification and browser limitations. `served-source.jsonl` and `served-destination.jsonl` bind each unique served file to its committed Git blob. Each origin served 380 distinct logged file bindings / 8,540,013 bytes. Identical records were deduplicated; these are inventory totals, not total HTTP requests or network traffic. Both consoles were clear; temporary tabs and servers were closed. The downloaded test file is retained.

This trial does not cover artwork decoding, binary audio, `.rltheme` adoption, all game modes, production challenge/enjoyment, physical inputs or the complete release pipeline. Player-save and earned-picture transfer remain separate from content transfer. Release owners still qualify committed source, immutable packaging, deployment and public play.
