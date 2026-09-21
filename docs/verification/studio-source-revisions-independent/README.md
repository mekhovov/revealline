# Independent review: Studio replacement revisions

**Reviewed candidate, not integrated or publicly accepted.** Exact base `8cffb36b`;
packet SHA-256 `bc41e0b01219aec5e173f4e4e81cfb6c8b5d801727e673fbf8096880c9b12da3`.

The root reviewer independently reran all six complete files on Node20.19.5 and
Node22.22.2: **45/45 pass per runtime**, no skipped cases. Each run loaded348 inputs,
169 unique bindings across six test processes. Every loaded byte was independently
checked against exact Git source or the hash-pinned candidate. See the full logs,
`independent-source-proof.json` and `loaded-sources.json`.

The same extended host test was rerun separately with only the production Studio
module restored to the exact old source. It failed with “New assets revision must
be the next revision.” The corrected module was restored afterward. Baseline
inputs were independently verified and retained in `baseline-sources.json`.

## Review conclusion

No correctness blocker found in the nine-line fix. Original-source revisions belong
to a different asset ID than prepared artwork. Metadata and reviews correctly
advance only the latter. Allocating max existing revision plus one for the exact
source ID preserves this invariant, including a first upload after review and
repeated sprite preparations. The existing validated2048-asset limit bounds the
search. No history renumbering, placeholder record, schema relaxation or migration
is introduced.

The host cases verify independent revision histories, refusal of a second pending
preparation, the exact source parent, Save/Reload, every previous immutable asset
record and every original/derivative byte through binary bundle transfer. Tests use
modeled DOM/storage and predetermined PNG encoding; transfer decode is explicitly
disabled. They do not establish image-decoder fidelity or actual picker/download
operation. The old defect is reproduced by the product handler, not by a duplicate
implementation in the test.

## Integration and remaining work

The patch remains held after PR209. Retain the queued Team/Studio source foundation;
do not replace whole files with this packet or apply its test file over a different
release branch. PR209 and the held Team source have substantial independent Studio
differences. Apply related hunks after accepted-base composition, preserving the
queued command-focus and recovery-copy corrections. Append skill guidance instead
of overwriting later instructions.

Re-run complete affected host/history tests and applicable production-source
reproduction on the final source. Complete a real browser upload → metadata/review
→ replacement → Save/Reload → actual downloaded bundle → fresh-origin import.
The browser activation limitation from this session is unresolved; it is neither
proof of a product input defect nor successful native verification. The release
owner must then complete version/PR/build/Pages and public checks. Whole P04 and
P17 remain incomplete.
