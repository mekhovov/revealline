# Pressure Pictures external-original pilot

This optional source fixture pairs generated `pack.json` and [descriptor.json](descriptor.json) with a reproducibly compiled `media.rlmedia`. It is outside all app catalog/default/offline/download registrations. The gameplay file alone is not a complete artwork backup and must not be advertised as an installable original-art edition through an old importer.

`build.mjs` reads only the pinned embedded `original-fpv-pressure.json` (SHA-256 `dc7b29694ec409c629e4006f11b96a2834937bf0f846e9dd9f29c5981aa5daa9`). It uses the existing full owned-PNG CRC/filter/scanline verifier and all current pack/media validators. The new pack/campaign/map identities identify the pilot; physical level fields, roster, music, theme and all three source PNG bytes remain exact. No new geometry, finished music, derivation, resizing or re-encoding is claimed.

From the repository root, run `node authoring/library/external-chapter-pilot/build.mjs NEW_OUTPUT_DIRECTORY`. The directory must not exist. It emits only `descriptor.json`, `pack.json` and `media.rlmedia`; it never replaces old evidence or originals and has no install/publish action. The large binary output remains generated, avoiding another tracked copy of already owned originals. The descriptor is checked against the committed fixture, and its exact compact gameplay SHA/length is checked in tests.

The three PNG originals total **8,024,867 bytes**. Exact payload hashes/lengths and individual original facts are in the descriptor. The payload contains complete retained original owners, descriptions and original-source credit. No copyright/license authority is inferred from hashes or successful parsing. Browser decoding/rendering remains distinct from the compiler's full bounded PNG scanline validation.

See [the install/recovery contract](../../../docs/external-chapter-originals.md) for both-database ordering, caps, required future host gates and the deliberately unimplemented existing-user migration interface. This finite slice is a technical source pilot, not a new public edition, live host, release or browser qualification.
