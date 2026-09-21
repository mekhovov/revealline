# P08 Team relay-anchor art candidate

Nine related paths add original available/captured 24px radio icons, editable integer-pixel source, immutable prepared PNGs, provenance/requirements/prompts, a review page, reproduction tooling and maintainer guidance.

Parent: `.cache/p04-team-integrated-17bd1965-r1/candidate` (exact base 17bd1965 plus consolidated Team authoring chain). Patch SHA-256: **47cff0cd755310b8f92adc81bd280a644256e9438be875c16612e744e1929eb3**. Root workspace/index/version/commits and public bytes were not changed.

## Corrections and checks

- Independent PNG inspection verified chunks, CRCs, geometry, binary transparency, palette and pixel counts. Connector states differ in shape, not colour alone (eight pixels after colour normalization).
- Fixed provenance attribution: producer compares requested source bytes with the source captured when the drawing module was imported, so changed source cannot be credited to cached drawing code.
- Fixed manifest serialization to match repository formatting. Five producer/reproduction tests pass on both Node20.19.5 and Node22.22.2. Lint, formatting and isolated binary patch dry-run pass. Initial failures are retained in local evidence; no assertions were weakened.
- Original pair is 194 + 192 bytes; retained bytes cannot be overwritten by reproduction. Quality remains `produced`, not approved.

## Native Studio journey

Source-pinned local browser at port18829, desktop1280x720: actual file-picker uploads, provenance entry, validation/staging, real Relay Yard initial and captured-state previews, reduced effects, paired collection creation, Save, Export, Import, Undo and reload of the saved revision all succeeded. First Connection explicitly identifies anchors as inactive. No console warnings/errors.

Collection `fpv-relay-radios-v1@1`, document r42. Download `/Users/oleksandr.mekhovov/Downloads/revealline-fpv-r42 (1).rltheme`, 7,251,142 bytes, SHA-256 f8e7eab7c2c2eb490282b2c735d35da6a5207e92c3bd1c7481549ecbbaa00fa2. Both PNG originals and prepared derivatives retained; import/export round trip byte-identical. Full detail: `native-export-verification.json`. Bundle size includes inherited history, not just this 386-byte pair.

Two browser-automation file chooser attempts timed out; after inspecting the disclosure/input state, keyboard activation opened the picker successfully. Export activation while Save was busy did nothing; waiting for Save completion then Export succeeded. These are recorded observations, not hidden evidence of touch/device qualification.

Final review page inspected with shared Field Kit typography, native/enlarged icons and grayscale/light-ground specimens. No console warnings/errors. Final source pins: `native-pins-candidate.json`; Studio journey pins/logs preserved separately with `-studio` suffix.

## Outstanding acceptance

Imported multi-stronghold visual review, runtime default collection adoption, complete source/build/release gates, physical input/device checks and public deployment remain outstanding. This candidate supplies a bounded asset family, not P04/P08 completion. Release owner must compose related hunks with current source, synchronize the next version, qualify exact source and deploy through the existing release workflow.
