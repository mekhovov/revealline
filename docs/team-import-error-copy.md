# Team import failure copy

The shared Team pack-import error handler preserves the reader's existing period,
question mark or exclamation mark, adding a period only when absent. A corrupt
artwork body now reads “Pack unchanged: Team artwork bytes do not match their hash.
Retry pack or choose another file.” Validation, recovery actions and accepted
source ownership are unchanged.

## Maintenance prompt

Import a corrupt required artwork body over a usable selected arena. Verify one
sentence boundary, the complete error and recovery instruction, visible Retry,
and the unchanged old selection and decoded picture. Retry the same corrupt file
and preserve that usable source. Separately make a JSON file read fail once with
and without terminal punctuation, then retry successfully without automatic Start.
Do not suppress errors, relax image checks or replace the selected pack to fix copy.

The focused complete host test covers these cases alongside existing artwork
ownership, cancellation and Next behavior. A test-local complete-frame recorder
checks the exact background before actors, once per frame, without advancing the
simulation; missing, wrong and duplicate background samples are rejected. Its
DOM, Canvas and image decoding are modeled; native browser decoding, whole-release
qualification and public or physical-device acceptance remain separate.
