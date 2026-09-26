# Creator content and source formats

## Portable content

`.rlpack` is an uncompressed `revealline-content-bundle.v1` manifest followed by binary payloads. The eight-byte magic is `RLCNB1\r\n`; the following four bytes are an unsigned big-endian UTF-8 manifest length. The bounded canonical JSON manifest is followed by exact payloads in SHA-256 order, without paths or archive extraction. Trailing bytes, unknown fields and truncated payloads are rejected.

The manifest contains `format`, `content`, `evidence`, `assets` and `editionId`. `content` contains the scoped editable `ContentProjectV1`, selected `packId`, used themes, generation provenance, credits and runtime compatibility. `editionId` is the SHA-256 of the canonical manifest without `editionId`; its inventory pins the actual binary payloads. Historical Solo-only image editions retain `revealline-creator-runtime.v1`, historical Solo video editions retain runtime v2 with explicit victory-story bindings, qualified image editions use runtime v2 with explicit Solo and Versus modes, and qualified video editions use runtime v3 with both modes and story bindings. The same format supports 1–50 ordered missions and their exact dependency closure. Image-only packages remain within a 24 MiB bound, packages containing verified original video may use the 256 MiB media bound, and every manifest remains within 2 MiB; existing 4 MiB per-image and pixel limits remain unchanged.

For one mission, provenance remains one object and evidence remains the original six-route array so Phase 1 files stay byte-shape compatible. A multi-mission manifest stores provenance in authored mission order and evidence as one `{ missionId, routes }` entry per mission. Each entry contains the six difficulty and steering recordings for that exact compiled mission. Repeated runtime bytes are stored once by SHA-256 even when several missions reference them. Pack and campaign order, rather than incidental object or hash order, controls player continuation.

- `prepareCreatorBundle` owns the selected dependency closure, verifies bytes and actual native image decoding, compiles the project and runs the bounded template route against each actual difficulty/steering configuration.
- `approveCreatorBundle` creates a process-local token bound to the exact immutable preparation. Imported approval flags are unsupported. Changed bytes or a different preparation cannot use that token.
- `exportCreatorBundle` serializes only that approved preparation.
- `reviewCreatorInstallation` binds the storage generation, exact approval, additional byte inventory and capacity estimate.
- `installPreparedCreatorBundle` requires those exact owners and checks the real generation in the final transaction. Cancellation or failed writes cannot expose a partial index.
- `creatorArtworkLoader` resolves the existing logical PNG paths only through the exact edition's verified binary payloads, preserving the shared compiler and private artwork-verification contract.

Generation stores a versioned template, bounded variant, seed, runtime seed, mission ID and gameplay policy. Current `creator-layouts.v3` generation selects twelve complete variants across First crossing, Island chain, Twin corridors, Open terraces, Soft current and Ember garden. Every current variant contains at least one interior collision wall and exactly one supported moving field keeper; family recipes may add safe islands, slow material or lethal material. Image bytes and filenames do not affect geometry. Automated evidence is regenerated on import against the actual obstacles and enemy for all three Solo difficulties and both steering policies. Current v3 packs also replay those exact routes on two independent equal Versus boards and require equal legal results for the actual compiled mission, difficulty and runtime seed. See [Phase 6 generated Versus qualification](phase6-versus-qualification.md). These checks establish configuration feasibility only. The original enemy-free `creator-crossing.v1` recipe remains accepted solely so previously installed editions can still be revalidated byte for byte and remains Solo-only.

Generated Team qualification uses a separate cooperative registry and portable
JSON boundary. It does not change image/video `.rlpack` semantics, and the
installed Custom player does not adopt the Team artifact. The production Team
file picker reverifies and installs the exact portable bytes under their SHA-256
edition identity. A later browser visit discovers every immutable edition and
replays the complete qualification before deliberate launch. Legal clears are
partitioned by that edition and shown in the Team library.
See [Phase 7 generated Team qualification](phase7-team-qualification.md) for
its two-seat contribution, Retry, continuation and transfer contracts.

Team editions and their completion receipts use a bounded dedicated IndexedDB
database. They retain exact unfinished attempts, package-bound reward pictures,
optional victory videos and durable legal-clear receipts. The package SHA-256
remains the edition identity.

Team package bytes also participate in the existing 256 MiB managed-media
ledger. A pending external-usage claim is recorded before the dedicated Team
transaction, finalized after commit, and reconciled against verified installed
editions after interruption. This is an explicit recovery journal across the
two storage authorities; it does not claim cross-database atomicity.

The full inventory, immutable manifest reference and payloads are committed in one transaction of the existing managed-media database, using retained generic-byte references. This adds no storage authority or database upgrade beyond the current DB5 capability. Existing still, story and audio history remains intact. The installer makes no cross-store atomicity claim; draft/player operations are separate actions. Future multi-domain operations must add a recovery journal.

Imported project sources always register in the Custom collection. Deliberate launch rechecks the complete bundle, then opens the project-backed Custom player. Progress is scoped to the full edition SHA; gameplay tuning from another host cannot silently change the verified configuration.

## Private source backup

`.rlsource` uses `RLCSB1\r\n` with the same length-prefixed manifest and binary pattern. Its format is `revealline-creator-source.v1`; it contains a draft ID, editable content, fitting information, optional original SHA-256 references, and exactly the source project's picture inventory. A Phase 1 source uses one SHA-256 or `null`; a Phase 2 batch uses an ordered array and retains deduplicated payloads. It may retain an uncompilable gameplay draft. It never establishes approval, installation, completion or public availability.

Source checkpoints retain deduplicated picture Blobs and canonical source manifests in the same managed transaction. Checkpoint IDs are immutable and compare the prior head; a concurrent write requires recovery instead of overwrite. Fifty checkpoints per draft and existing managed metadata/asset budgets bound retention. Advanced Studio uses its existing checkpoint backend through an explicit editable-copy action, and resolves only the creator draft's pinned runtime picture for practice.

## Player persistence

Custom attempts use a bounded `revealline-creator-attempt.v1` envelope around the existing session/replay format, with full edition ID, mission ID and difficulty. The existing session verifier compares recovered simulation rules with the installed compiled campaign. A per-edition Web Lock controls local attempt writes. The existing profile backend uses a separate `custom-<edition SHA>` profile key; these receipts never enter the official Journey profile.

Pack/source downloads exclude these player records. Progress and unfinished-attempt backups are explicit separate actions in the player. Source original metadata remains private in the source backup; the shared PNG is a rendered pixel derivative.
