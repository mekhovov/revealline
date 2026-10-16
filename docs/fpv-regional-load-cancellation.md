# Cancel installed-region verification when the player leaves

The Library previously aborted its UI wait when a player cancelled, navigated away or reached the operation deadline, but did not pass that cancellation into `openRegionalLibrary.load`. The abandoned load could continue opening and hashing every saved asset. It could not adopt through the cancelled UI lease, but still consumed work after the player had left.

The Library now passes its existing signal to the load operation. Load checks it before and after the read-only persistence request, while verifying the descriptor, and before each payload. Existing stream cancellation closes the active reader and prevents scheduling subsequent reads. A persistence request or WebCrypto digest already executing cannot be forcibly cancelled; its result is discarded after it settles. No install transaction is aborted or changed, and stored revisions remain intact.

This is a cancellation correction, not a claimed remedy for the observed long Desert revision switch. The separate isolated native diagnostic did not reproduce that delay: both baseline installs and serial verification completed quickly. A production phase diagnostic is still needed before attributing the stall or publishing a performance optimization.

Verification: `node authoring/fpv-worlds/regions/verify-cancelled-library-load.mjs` executes the complete production load method with only a read-only store dependency substituted. It covers a successful exact-inventory load; cancellation before storage (zero reads); cancellation while the storage result is pending (zero payload readers); and cancellation during the first payload reader (reader closed, no subsequent files). The prior frozen e006 implementation failed the pre-cancel scenario because it ignored the signal. Scoped lint passed. Native cancellation, final package qualification, all-network-offline testing and device performance remain separate gates.

The test uses valid paired manifests and hash-pinned opaque fixture payloads because load verifies inventory bytes; geometry decoding belongs to the existing runtime admission checks. It does not claim this fixture is a flyable scene.
