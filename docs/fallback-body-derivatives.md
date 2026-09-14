# Standalone body transport derivatives

The seven FPV enemy bodies and seven Ukraine Atlas player bodies retain their
appearance IDs, role mappings, source hashes, full-frame centers and animation
recipes. Their standalone runtime paths use the fourteen reviewed 128×128 RGBA
PNGs from source cohort `b8774ec65d3dcc36a600b865eeb8b6c89ca97367`.

The optional `derivation` member records the exact compiler recipe, original
path/bytes/SHA-256/dimensions and output bytes/SHA-256/dimensions. Existing `src`
points to the runtime file; enemy transport fields describe that file. Player
`originalSha256` continues to identify the original, while `derivation.output`
identifies its runtime pixels. Records without this member retain their original
path contract. Source originals remain in Git and authoring provenance.

This is the existing fallback path, independent of the thirty compiled Field Kit
defaults and their 32/64px slot metadata. It adds no registry, renderer primitive,
collision change, cropped frame or animation rig. Manual appearances keep their
existing precedence. The player loader still uses its existing Image route;
enemy transport still verifies byte length, SHA-256 and PNG dimensions before
decode, sharing and releasing the same bounded leases.

Build inclusion replaces 12,396,181 bytes of original PNGs with 920,318 bytes of
runtime PNGs plus the 17,386-byte reviewed manifest. That saves 11,458,477 bytes
before the small record/helper changes. The 64MiB core cap is unchanged; actual
candidate-build measurement remains a separate gate. Full source checks retain
the original-art assertions, while the focused derivative checks read all
fourteen runtime files and reject foreign source/role/output bindings.

These derivatives preserve the full authored canvas using nearest-center
sampling. Fine detail and alpha edges inherit the cohort's recorded limitations;
128px is transport resolution, not a new gameplay size or strict palette claim.
