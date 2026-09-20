# Decoded candidate pictures and per-attempt ownership

P01 implementation source, 20 September 2026. Main Journey adoption and release
qualification remain open; this is not a newly deployed feature.

Candidate artwork now requires both the existing exact byte/hash/header checks
and complete browser decoding with matching natural dimensions. The shared
decoder also bounds injected decoders, rejects cancellation promptly and releases
late images. Existing managed-media acquisition uses that same decoder; its
historical pin and store checks are unchanged.

The candidate attempt preparer does not become ready until its picture decodes.
`take()` transfers the prepared run, recorder and picture exactly once. Before
transfer, replacement/cancellation/disposal release the prepared pixels; after
transfer, the accepting host owns their release. Failed replacements do not
release an already-taken flight. No storage or awards are written.

`createCandidateFlightPictures` exposes the host's familiar readiness, current
image, ensure, cancel and dispose interface for one exact asset and authored
theme. Its candidate kind remains explicit: it cannot mint official managed-media
pins. It accepts an already-decoded original without another decode, or loads it
with a bounded deadline. A picture has one display owner. Borrowed, copied,
mismatched, released and late bindings cannot be substituted, double-owned or
used to dispose another active display's original. Frozen asset identity checks
are cached for per-frame reads. Host run/focus/save ownership must still be checked
before adoption; a ready picture alone is never permission to replace a run.

Verification:

- Final content/foundation/Horizon/picture/result cohort: 157/157 passed in
  12.2 seconds. All sixty preset/steering complete-route replay fixtures remain
  exact. Final lint, formatting, content validation and whitespace checks passed.
- Existing actual Solo/couch picture-host cohort: an initial 77/77 passed in
  117.3 seconds; the final-source rerun also passed 77/77 in 118.8 seconds.
- The actual result renderer displays the prepared original, keeps the engine's
  earned coverage unchanged, and refuses unrelated painter fallback after
  disposal. This is a modeled renderer assertion, not a pixel/native screenshot.
- Native ordinary Journey reload → Load saved flight restored the existing run
  paused at 0:21, 0%, three lives and zero score, with explicit Resume. A later
  DOM readiness query timed out; the same tab's accessibility state reconfirmed
  the paused restored run. No native candidate-decoder or readiness-attribute
  claim is inferred from that observation. The flight was not resumed or replaced.

Logs: `.cache/candidate-picture-final-cohort.log`,
`.cache/candidate-picture-final-{lint,format,validate}.log`, and
`.cache/candidate-picture-final-host-cohort.log`. Agent testing tabs remain available;
the user's ambient tab and original dirty checkout were not changed.

Preceding source9d5ec817 andecc108e4 received separate independent scoped review
with no blocking source findings (publication owner's
`.cache/journey-attempt-root-review-9d5ec-r1/review.json`). That receipt explicitly
does not cover these later decoded-media changes, reruns, physical devices or
phase completion. Fresh review and exact-source hosted gates remain due.
