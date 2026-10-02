# Garage demonstrations

The eight original Garage challenges now have an installed example in both
self-level and Acro. The catalogue exposes Watch example through the existing
exact-identity lookup; no course, challenge, physics, scoring or collision
definition changes. The additional advanced school lesson in this world retains
its existing mode restrictions and example.

This completes **120 original demonstrations**, with the **58 school examples**
kept separate: 154 v2 recordings plus the 24 unchanged Academy v1 recordings.
The catalogue remains 148 challenges across 14 worlds. The 60 Adventure
authoring proofs remain an archive; this increment does not install them.

The runtime update appends losslessly packed command rows to the existing
registry. All 138 previous decoded records and decoder bytes are preserved.
The sixteen additions contain 35,741 recorded 50 Hz commands, complete with zero
contacts, and finish with 85–100 health. Some combat damage is intentional; these
examples do not claim perfect scores. Final landing speed is about 1.14 m/s,
within the unchanged objective requirements. A few final outgoing projectiles
remain in flight at target defeat.

## Reproduction and functional qualification

The portable generator, bounded additive pack builder, provenance and compact
source archive live in `authoring/fpv-worlds/demonstrations/`. Output paths must
be new; the tools do not overwrite the installed registry. The pack builder
checks source/artifact hashes, current course identities and independent replay,
rejects duplicate course/mode keys and preserves existing packed rows verbatim.

For rechecking this already-installed batch, obtain the pre-append registry from
trusted commit `2fcb3a2ce003e5d0340a9df8cad78e59b9202a5a` and pass it as
`--registry` to the pack builder and `--baseline` to `garage-verification.mjs`.
Using the current registry correctly rejects these additions as duplicates.

Evidence:

- `fpv-garage-authoring-verification.json`: 15/15 artifact, preservation,
  duplicate, bounds, non-overwrite and malformed-data checks.
- `fpv-garage-functional-verification.json`: all 154 v2 recordings replay to
  their exact final identity; all 1,331 supported checkpoint positions either
  restore their recorded state (768) or explicitly fall back (563).
- `fpv-garage-legacy-verification.json`: all 24 original v1 recordings complete.
- `fpv-garage-browser-verification.json`: 281/281 checks and 18 complete runs.
- `fpv-garage-packaged-browser-verification.json`: 279/279 checks and 18 complete
  runs, including all sixteen Garage examples plus retained original/school
  representatives, actual WebGL in FPV/chase, pause and playback speed, held-input
  isolation, EN/UK results and unchanged saved records/interruption/bookmark.
  The source run had two additional deliberate preparation-resume checks.
- The prepared player was also inspected with native real-time playback for
  Upper deck survey, including its final result and the same paused approach in
  FPV/chase. These spot-checks are separate from the accelerated fixture.
- `fpv-garage-package-verification.json`: all three admissions, committed-input
  and ZIP checks, and two byte-identical builds at frozen candidate
  `5d9411ba831800bc7f6ae763f46d9d4ea69fa8f7`. Public availability remains a
  separate gate; consult the latest delivery checkpoint.

Browser qualification uses unchanged production renderer, input adapters and
recordings, with controlled frame timestamps to complete all fixed-step commands
quickly. It does not measure real-time frame rate. Exact final identity is checked
in the iframe's own realm and against a normalized parent snapshot; foreign-object
key ordering cannot produce a false mismatch. The fixture pauses/resumes explicitly
after slow preparation and never resumes unexpected in-flight stalls automatically.

Additional unit coverage remains in R7. Recorded completion is not physical
controller qualification, hardware performance, beginner comprehension or art
acceptance. Those plan items remain open.
