# Reproducing the retained FPV revision 54 runtime

Fresh and saved visual policy selects `field-kit-fpv@54` by the exact original
runtime hash `91a3d66966e1b1a3c2e9b5c68aebcc4be284edff4e7b9b272731a769a4f66ace`.
Journey production currently selects revision 58. Keeping revision 54 records
in the theme ledger alone does not preserve that original serialized runtime.

The code-owned input is
`authoring/library/fpv-field-kit/retained/runtime.91a3d66966e1b1a3c2e9b5c68aebcc4be284edff4e7b9b272731a769a4f66ace.json`.
Its 978694 bytes are copied unchanged from
`b810521a53af7be145acb8dedce0a01a747339cf:game/presentation/compiled/runtime.json`.
`scripts/field-kit-retained-runtime.mjs` pins its path, byte count, SHA-256 and
provenance. The generator reads this authoring input, never incidental output
directory history. Do not reserialize or format this immutable file.

`readFieldKitRetainedOutput` validates the exact raw input, compiled schema,
revision 54 source/theme identity and canonical dependency paths. It obtains
every lazy image/font/audio original from the production ledger by SHA-256 and
checks byte count and hash. It constructs explicit `previousOutput` for the
existing compiler retention contract. Missing or corrupt history fails before
the controlled writer adopts anything; there is no current-theme substitution.

The production compiler keeps current artifacts on their existing formatting
path, but skips every hash-named retained runtime. It rebuilds the ownership
manifest after formatting. The original runtime and its exact dependencies
therefore reproduce under the same retained filename on a clean checkout.
The narrowly scoped `.prettierignore` entries also protect hash-named compiled
and authoring runtime inputs from broad formatting commands. `runtime.json`
remains checked; retained files are validated by exact hashes and schema instead.
The controlled writer remains responsible for verifying the complete inventory
and refusing deletion or mutation of already admitted retained runtimes.

This change does not revise the theme ledger or grant recipe approval. Preserve
all 127 existing payloads and all immutable records, including revisions 54–58.
Later revisions may add payloads and records; they must retain this original
input and its dependencies. Advancing fresh policy requires a separately reviewed
catalogue revision and explicit retained inputs for every promised old revision.

The focused test exercises bad input hashes/counts, missing/corrupt lazy
dependencies, original runtime preservation, repeat generation and unchanged
current compiled artifacts/history. Run it against the composed prerequisites.
Full generation/check, retained-output/writer, source qualification, native
restoration, offline and public release acceptance remain separate gates. No
generated artifacts are adopted by the source packet itself.
