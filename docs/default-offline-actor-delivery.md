# Default offline actor delivery

The actor expansion retains its full online content while restoring the default
offline installation to the existing 2,000-file / 64 MiB budget. No cap, artwork,
level, recovery identity or source asset was removed or changed.

Actor recordings use `game/audio/reactions/actors-v1/`. The optional-voice matcher
previously recognized only the older recordings directly under `reactions/`, so
48 new clips incorrectly entered the mandatory cache. Versioned actor clips now
join the existing English and Ukrainian optional voice downloads. Runtime
catalogues, captions, on-demand online playback and imported recordings remain
available. Each language download contains 32 clips: eight existing originals and
24 actor lines. English is 559,499 bytes; Ukrainian is 652,107 bytes.

Bounded distribution projections supply the remaining headroom:

- The generated content registry retains every tuple, identity, text and shared
  field object using the existing pinned LZ-string 1.5.0 codec and license. The
  build verifies the exact known generator wrapper and lossless data round trip,
  then records the canonical source hash in the distribution copy. Its size
  changes from 639,343 to 315,625 bytes.
- The generated mission index uses compact JSON after the ordinary source checks.
  Every mission and nested source descriptor remains unchanged. Its size changes
  from 300,737 to 205,717 bytes.
- After merging the Theme Studio material update from `cf0b62e53`, the main UI
  host's distribution copy also uses the existing verified indentation packer.
  It preserves the exact AST, code tokens, comments, literals and line breaks;
  only spaces and tabs between lexical content change. This applies exclusively
  to `game/app.mjs`, reducing it from 529,551 to 419,178 bytes. CSS and all other
  modules retain their source form through this specific projection.

Repository originals are untouched. Byte-pinned recovery catalogs, compiled
appearance manifests and actual mission bodies are excluded from this projection.
The final catalogue, worker and distribution inventory hash the emitted bytes.

## Capacity evidence

The [receipt](evidence/default-offline-actor-delivery.json) records production
offline preparation, without a ZIP or expanded output. The initial result uses
mutable source based on `bb805128f368b30a57e0792487787781aa389181`; it does not
replace the subsequent committed-source build or public-release qualification.
The main comparison loads exact `66d83c424` modules and original build blobs;
unchanged optional/external bodies retain their catalog-verified byte identities.

| Default core         | Files |      Bytes | 64 MiB headroom |
| -------------------- | ----: | ---------: | --------------: |
| Main `66d83c424`     | 1,321 | 67,122,412 |         −13,548 |
| Expansion before fix | 1,382 | 68,360,684 |      −1,251,820 |
| Expansion after fix  | 1,334 | 67,085,504 |          23,360 |

The table records the pre-Theme Studio production offline stage, which passed its
unchanged guard and emitted its worker and inventory. The merged Theme Studio
build requires a fresh committed-source capacity result; the additional host
packing saves 110,373 bytes without removing its new material styling. This fix
is independent of the still-oversized largest Company edition.

Scoped lint and formatting pass. Regressions cover exact registry reconstruction,
unexpected generator/codec rejection, retained mission source descriptors and
recovery bytes, and optional actor voices across all three core modes. They are
authored but unexecuted under the explicit automated-suite waiver.
