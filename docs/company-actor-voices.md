# Optional actor voices in Company editions

Company editions now carry the same 48 original actor recordings as the main
game: notice and caught lines for twelve families, in English and Ukrainian.
They are available in Capture and Classic Snake through the existing reaction
director, master/dialogue routing, warning priority and bounded decoder. They
do not create another sound system or change gameplay.

In **Settings → Audio → Character reaction sound and captions**, each compiled
Company edition offers **Offline enemy voices**, with English and Ukrainian
download/repair and remove actions. These controls also appear in the Company
Snake Audio settings. Cancelling, closing Settings, hiding the page or leaving
it aborts the current download; verified completed files remain resumable.

Online playback continues to fetch relevant individual lines. Preparing or
starting an attempt never downloads a whole language pack. Without recordings,
captions continue to work. Custom replacement recordings and archived originals
retain precedence over the optional originals; existing pilot recordings retain
their mandatory Company delivery. The speech toggle and dialogue volume keep
their existing behavior.

## Ownership and bounds

- Both actor language packs together contain **48 files / 868,186 bytes**, under
  a fixed 48-file / 2 MiB actor-voice envelope. English has 24 files / 399,827
  bytes; Ukrainian has 24 files / 468,359 bytes.
- `createOfficialDownloads` owns downloading, bounded stream verification,
  per-file SHA-256 and length checks, storage estimation, atomic completed-file
  checkpoints and serialized writes. No scripts or custom AI are accepted.
- Download ownership is scoped to the immutable Company edition URL and language.
  Removing one pack uses the existing ownership-aware reclamation path. Other
  editions' references, pilot voices and IndexedDB replacement recordings are
  not deleted. Shared bytes can therefore remain after one owner removes them.
- Playback checks the shared verified cache before its ordinary pinned URL.
  Missing or corrupt optional bytes fall back to online originals and captions.
  Changes invalidate decoded speech through the existing library notification;
  downloads never schedule a reaction or replay expired speech.
- Existing decode limits remain: two concurrent loads, 24 buffers, 12 MiB total
  decoded audio, 6 MiB per decode, and at most 15 seconds per recording.

## Build and source provenance

The standalone actor adapter receives the exact canonical catalogue through the
Company runtime projection. Its emitted source names and hashes the canonical
metadata, and compilation rejects a metadata edit after loading the build module.
The runtime asset ledger includes each original's exact size/hash and existing
public source eligibility. The same resource list supplies the hosted edition
and complete ZIP; media bodies are excluded from the mandatory Company offline
cache. The default game and optional flight runtimes keep their own delivery
adapters, with no new dependency on Company download controls.

This delivery work does not qualify the generated voices' performance. EN/UK
pronunciation, expression and mix still need listening review. It also does not
claim human/device offline acceptance or completed public release qualification.

## Verification

Relevant regression source covers exact catalogue/asset projection, optional
versus mandatory cache membership, no automatic pack download, offline cache
reads, integrity failure, repair, cross-edition offload ownership, cancellation,
custom-recording precedence, pilot/caption fallback and Settings moved into the
shared Snake dialog, plus cross-tab status changes and Settings re-entry. Automated suites remain explicitly waived and unexecuted.

Targeted lint/format, generated flight-source projection, source eligibility and
production Company build/admission are the applicable independent checks. The
release owner records the final committed-source receipts separately.
