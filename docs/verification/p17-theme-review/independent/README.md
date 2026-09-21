# Root's independent portable-theme trial

The root reviewer rebuilt a fresh79-module source directory directly from exact
`8cffb36b`, verified every source hash, and invoked the actual compiler through
ordinary imports on Node20.19.5 and22.22.2. A separate local package file selects
module syntax; no application module was stubbed or changed.

Both runtimes emitted137 identical files totaling8,293,501 bytes. All133 source
payloads matched both the supplied bundle and exact committed asset files. Generated
Studio/runtime documents matched their parsed committed records. Every output hash
and size matched its generated manifest. Final source bytes were checked again
after execution.

Each runtime's validate-only command left the complete source directory unchanged.
Retrying an existing output failed with EEXIST and preserved every output file/hash.
Malformed input failed before creating its destination. The two successful output
inventories were identical.

See `review.json` for all commands and results, `output-inventory.json` for every
emitted file, and `source-inputs.json` for the exact closure. `verify.py` retains the
executed review script and local paths; the public-facing guide supplies portable
commands for an ordinary checkout. Existing review outputs must not be deleted or
reused merely to rerun this script.

The input is an API-created compiled collection, not a newly downloaded Studio
export. This verifies the CLI guide only. Native upload/edit/export/import, image
decoding, physical devices, final-source production and public adoption remain
separate. No game version or P17 completion is claimed.
