# Optional SIM source admission repair — 3 October 2026

World Studio's original-input inventory at main `2dbbe0a0` totals 16,778,114
bytes, 898 bytes above the unchanged 16 MiB guard. The projected player fits;
the additional source inventory fails. This explains the optional-package CI
failures on the current Woodland and Meadow art branches.

The reaction-runtime generator now writes its generated projection with no
indentation. It retains formatted newlines, original names and canonical source
hashes. Canonical modules remain normally formatted and all 24 packed recordings
are byte-identical. No assets, content, locale checks, dependencies or guards are
removed or changed.

The generated module shrinks from 891,755 to 849,454 bytes. Parsed Acorn syntax
trees are deeply equal after removing source offsets and raw literal spelling;
the packed-recording literal is also exactly equal. This changes layout only.
The check mode reproduces the result byte for byte.

Frozen candidate `6dff17865b2e593a73bbbec1680f1d908ed2a765` passes all three
source-bound admissions, two byte-identical builds, committed-input verification
and ZIP-member verification. World Studio retains 101 runtime/103 source files;
its original inputs total 16,735,813 bytes, leaving 41,403 bytes. This is a bounded
repair, not enough headroom for unlimited future features. Each subsequent
increment must still pass admission.

Full validation, focused lint and generator formatting pass. Of 21 existing
checks, 20 pass. The native-dialogue warning-priority assertion at
`game/test/fpv-hunt-reactions.test.mjs:169` fails in unchanged canonical audio
code; the test does not import the generated projection. All its direct audio
imports and the test are byte-identical to the baseline. Retain this failure for
audio investigation; do not claim an all-green regression run.

The admitted distribution ZIP was extracted unchanged and launched in the actual
browser. Lift and land renders, arms, advances ticks and pauses to the menu.
This is a package smoke check, not new physical-radio, offline-failure or sustained
performance qualification. Additional unit coverage remains deferred to D6.

Evidence: [bounded receipt](evidence/fpv-source-budget-20261003.json).
