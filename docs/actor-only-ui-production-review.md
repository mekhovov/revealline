# Actor-only UI production review

Status: bounded UI functional review recorded; Solo trail/effect review remains pending.

Field Kit revision 66 continues the exact 24-recipe UI review after the presentation host gained a restricted actor-only profile. The full profile remains the default and retains the reviewed UI loading, token and DOM ownership behavior. The actor profile has a fixed image-slot vocabulary, creates no CSS URLs and refuses page apply, audio and picture operations.

The generated result is:

- 335 slots and 140 compiled files.
- 4,009,342 retained asset bytes.
- 0 missing, 109 source, 0 produced and 226 reviewed slots.
- Runtime: 1,084,829 bytes, SHA-256 `5cc4c98f58e3c6624ff199a5d5bddce15edb21f45602c7ff6f09c3d354b1d769`.
- Studio: 4,626,890 bytes, SHA-256 `d21a2eabd1e30665169b2d3b684e5b3729fff11d700e294ad5bb6304317761f7`.

The actor appearance tests now load their approved revision 62 bytes from the immutable retained runtime instead of incorrectly requiring the current compiler output to stay frozen forever. Current lookup and retained lookup are independently staged and fail closed.

This review does not approve the ten independently changed trail/effect slots, complete navigation, forced colours, screen readers, physical devices, frozen/public builds or release readiness.
