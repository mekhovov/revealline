# Still Media soundtrack recovery repair evidence

This directory retains the original defect evidence, implementation checks, final
copy successor and independent functional review. Raw receipts, scripts and logs
are copied byte-for-byte; original path strings inside receipts are unchanged.
[manifest.json](manifest.json) maps those paths to retained files and records their
byte counts and SHA-256 hashes. The prior defect files are preserved.

- [defect-review.json](defect-review.json) and [reproduction.log](reproduction.log)
  record three successful demonstrations of the old defects. These intentionally
  assert bad outputs and are **not** passing product qualification.
- [owner-fix.json](owner-fix.json) records the actual host, exporter/importer and
  modeled IndexedDB recovery checks: **77/77 passed**, with no failures,
  cancellations, skips or todos. The initial host-only run is also retained.
- [owner-copy-successor.json](owner-copy-successor.json) records the final help
  sentence and a **26/26** host-file rerun. Runtime and test bytes did not change.
  This overlaps the 77-test cohort and must not be added as distinct coverage.
- [independent-review.json](independent-review.json) records the separate review
  by `audio_architecture`, with [three incremental actual-host probes](independent-probes.log)
  passing. The implementation and retention were authored by
  `soundtrack_references`; the review identifies the parent's separate guide work.
- The five `parent-*.log` files retain validation, lint, formatting, native-source
  formatting and production checks. Native-source formatting is **not** a native
  device or media test. The production output retains its own publication caveat.

The original owner cohort pins the intermediate HTML at
`8abf01c19f29939fdaae40f80df082ab0da3f3b3e5e13d7cdf79e085f3885fc8`
(6,117 bytes). The copy successor and final independent review pin the final HTML
at `81ac165c85780504b9ed1aa070c9e411783958b24ed455ff57fafe4889231cb5`
(6,178 bytes). The final sentence is: “Use Music library & playlists to download
missing recordings before retrying.” The earlier receipt has not been rewritten.

[pin-verification.json](pin-verification.json) checks every embedded file pin in
the five original receipts/mappings: **41 occurrences, 30 unique path/hash pairs**.
Current originals were hashed directly. The two pre-repair source pins were
verified against exact Git objects at
`3a20ee14f4ff9bca61d4547e1cee64aad294058f`; the intermediate HTML was verified in
memory by reversing only the documented one-sentence successor and matching its
exact original length/hash. No reconstructed source file was installed or retained.
Every copied payload was read back and matched to its original bytes.

The repair passes the code-owned trusted catalogue into recovery planning and
export, keeps permitted installed originals, reports restricted references and
omitted online entries, refuses missing required originals, and preserves
cancellation/download ownership. Ledger revision 54 and all five production recipe
fingerprints remained unchanged according to the retained independent review.
These are source-pinned working-tree checks, not an immutable full-release gate.

No new tests were run for this retention step. This evidence does not grant music
rights or record audible listening, recording/composition approval, Ukrainian
cultural review, Content ID clearance, native-device/browser/media-codec approval,
public release approval or frozen-artifact/offline qualification. No source,
staging, commit, push, process or publication action was performed by this step.
