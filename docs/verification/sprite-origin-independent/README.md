# Edited sprite placement — independent review

**Candidate reviewed; no runtime integration or public release.** Exact9-path
`c49429b2958378c9d07cd57be6d0f1d6a20a6e9b27db672c2bfc7144bc407705`
was independently applied after source-revision correction
`bc41e0b01219aec5e173f4e4e81cfb6c8b5d801727e673fbf8096880c9b12da3`
to frozen8cff sources in a new isolated directory. Every final postimage matches
its declared bytes and SHA256. No source-review blocker found in this scope.

## Behavior and regression

For an unchanged full frame, preparation retains the authored pivot, rotor anchors
and nine-slice while remeasuring output frame and occupied pixels. A partial crop
or changed frame returns to valid slot defaults with explicit review copy. Restoring
the original full crop restores the saved placement. A flip/move/rotation does not
promise automatic anchor transforms: the UI explicitly asks for placement review.

The editor captures the originating slot, asset revision and owned geometry.
The new derivative points to its new source record, which points to the edited
asset. Existing source/asset history remains intact. Delayed encoding cannot accept
a different editor owner or clear newer unsaved pixels.

All8 complete test files pass60/60 on Node20.19.5 and22.22.2, no skips. Each final
run used355 verified reads across171 unique source bindings. The same new host
regression against the previousbc41 host fails with authored nine-slice8 instead
of7; the final candidate host was restored afterward. This is the actual mounted
Studio handler test, with modeled image encoding as explicitly declared by it.

The initial test launcher materialized only changed files. Node22 silently ran
only16 cases; Node20 rejected a missing entry. Both initial outputs are retained
and are **not** qualification. Materializing every requested entry and requiring
the expected60-case count corrected the harness without changing product source.
A process exit0 alone is insufficient. `source-proof.json` binds all initial,
final and baseline reads; raw TAP bytes retain their original log hashes/names.
The scripts describe the local trial, not a standalone production test runner.

## Independent review of actual native transfer

The [owner browser receipt](../p04-sprite-origin-native/README.md) is retained with
all14 exact packet postimages. Root independently compared all297 observed source
bindings per origin to the frozen base or freshly applied candidate, rather than
assuming historical origin labels imply current bytes.

Both actual downloaded bundles match their declared sizes/hashes. Independently
parsed manifests and every payload preserve134 exact originals /4,010,515 bytes.
All1354 prior asset records match after the three declared namespace remaps,
including every provenance parent. `native-review.json` and `verify-native.py`
record that comparison. The successful UI actions are the owner's observed journey;
root did not perform a second native journey or independently repeat PNG decoding.
The full actor preview screenshot was visually inspected, but enlarged previews
do not prove actor readability in gameplay.

## Integration gates

Compose the source-revision prerequisite and sprite-origin changes together after
PR209; preserve existing source history and any other editor-acknowledgment work.
Do not replace the whole maintained skill with the old packet's much larger copy.
The two teaching-guide follow-ons depend on accepted runtime behavior; they remain
held. External-file/panel native qualification and numeric-coordinate entry are
separate follow-ups, as are final-source producer tests, public deployment and
physical device/controller checks. P04/P17 are not complete.
