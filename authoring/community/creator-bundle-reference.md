# Creator content and source formats

## Portable content

`.rlpack` is an uncompressed `revealline-content-bundle.v1` manifest followed by binary payloads. The eight-byte magic is `RLCNB1\r\n`; the following four bytes are an unsigned big-endian UTF-8 manifest length. The bounded canonical JSON manifest is followed by exact payloads in SHA-256 order, without paths or archive extraction. Trailing bytes, unknown fields and truncated payloads are rejected.

The manifest contains `format`, `content`, `evidence`, `assets` and `editionId`. `content` contains the scoped editable `ContentProjectV1`, selected `packId`, used themes, generation provenance, credits and `revealline-creator-runtime.v1` compatibility. `editionId` is the SHA-256 of the canonical manifest without `editionId`; its inventory pins the actual binary payloads. Phase 1 permits one Solo mission and one PNG asset, within a 24 MiB package and 2 MiB manifest bound. Existing 4 MiB image and pixel limits remain unchanged.

- `prepareCreatorBundle` owns the selected dependency closure, verifies bytes and actual native image decoding, compiles the project and runs the bounded template route against each actual difficulty/steering configuration.
- `approveCreatorBundle` creates a process-local token bound to the exact immutable preparation. Imported approval flags are unsupported. Changed bytes or a different preparation cannot use that token.
- `exportCreatorBundle` serializes only that approved preparation.
- `reviewCreatorInstallation` binds the storage generation, exact approval, additional byte inventory and capacity estimate.
- `installPreparedCreatorBundle` requires those exact owners and checks the real generation in the final transaction. Cancellation or failed writes cannot expose a partial index.
- `creatorArtworkLoader` resolves the existing logical PNG paths only through the exact edition's verified binary payloads, preserving the shared compiler and private artwork-verification contract.

Generation stores a versioned template, bounded variant, seed, runtime seed, mission ID and gameplay policy. Current `creator-layouts.v3` generation selects twelve complete variants across First crossing, Island chain, Twin corridors, Open terraces, Soft current and Ember garden. Every current variant contains at least one interior collision wall and exactly one supported moving field keeper; family recipes may add safe islands, slow material or lethal material. Image bytes and filenames do not affect geometry. Automated evidence is regenerated on import against the actual obstacles and enemy for all three Solo difficulties and both steering policies. It establishes configuration feasibility only. The original enemy-free `creator-crossing.v1` recipe remains accepted solely so previously installed editions can still be revalidated byte for byte.

The full inventory, immutable manifest reference and payloads are committed in one transaction of the existing managed-media database, using retained generic-byte references. This adds no storage authority or database upgrade beyond the current DB5 capability. Existing still, story and audio history remains intact. The installer makes no cross-store atomicity claim; draft/player operations are separate actions. Future multi-domain operations must add a recovery journal.

Imported project sources always register in the Custom collection. Deliberate launch rechecks the complete bundle, then opens the project-backed Custom player. Progress is scoped to the full edition SHA; gameplay tuning from another host cannot silently change the verified configuration.

## Private source backup

`.rlsource` uses `RLCSB1\r\n` with the same length-prefixed manifest and binary pattern. Its format is `revealline-creator-source.v1`; it contains a draft ID, editable content, fitting information, an optional original SHA-256, and exactly the source project's picture inventory. It may retain an uncompilable gameplay draft. It never establishes approval, installation, completion or public availability.

Source checkpoints retain deduplicated picture Blobs and canonical source manifests in the same managed transaction. Checkpoint IDs are immutable and compare the prior head; a concurrent write requires recovery instead of overwrite. Fifty checkpoints per draft and existing managed metadata/asset budgets bound retention. Advanced Studio uses its existing checkpoint backend through an explicit editable-copy action, and resolves only the creator draft's pinned runtime picture for practice.

## Player persistence

Custom attempts use a bounded `revealline-creator-attempt.v1` envelope around the existing session/replay format, with full edition ID, mission ID and difficulty. The existing session verifier compares recovered simulation rules with the installed compiled campaign. A per-edition Web Lock controls local attempt writes. The existing profile backend uses a separate `custom-<edition SHA>` profile key; these receipts never enter the official Journey profile.

Pack/source downloads exclude these player records. Progress and unfinished-attempt backups are explicit separate actions in the player. Source original metadata remains private in the source backup; the shared PNG is a rendered pixel derivative.
