# Actor batch 5 — Scout body proportions at gameplay scale

Checkpoint after `d8d4f732000c91ed7b1c4089853fe0d897522398`, inside draft
[PR761](https://github.com/mekhovov/revealline/pull/761). This is reviewed candidate
source and local browser evidence, not production admission or public release.

## Change and reason

The larger propeller envelope correctly reduces the body scale when the complete
actor keeps the same on-screen size. V4 also had a narrow battery. At the audited
612px board, its roughly 3.58px battery envelope compares with 8.94px in the
approved reference. No extra v4 renderer scale or tint defect was found. The
foreground contact ring further covers central equipment; its position and
visibility are part of the gameplay contract.

The new immutable **reference-v5** Scout broadens only central equipment. Camera,
antenna, arms, motors, pivot, global occupied bounds and all rotor geometry are
retained. Native 32/64px recipes use binary transparency and the existing palette.
There are no baked propellers, detached corners or copied reference-image pixels.
All 22 previous cohort PNG hashes and previous construction/manifests remain exact.
The two new PNGs are **295 + 573 = 868 bytes**. Manifest plus PNGs are **13,252 bytes**;
both decoded images have a **20,480-byte RGBA lower bound**. Decoder/GPU/shared
resource costs are excluded, not zero.

The three optional build entries do not enter Solo, Versus or Team core closure.
The strict loader admits only the named manifest, expected source fingerprints,
exact two slots, byte lengths, digests, dimensions, status and retained geometry.
Failed or stale replacement leaves the prior accepted run/artwork available and
releases rejected decodes. V3 and V4 remain available. No production registration,
retained pin, earned original, simulation rule or gameplay timing is changed.

## Verification

- **137/137 focused tests**, zero skipped/cancelled, in [focused.tap](focused.tap).
  The cohort covers feedback/renderers, benchmark operation ownership and retained
  Retry, measurements, exact v2–v5 reproduction, geometry and rotor motion.
- The overlapping benchmark cohort contains **40 tests** and **80 modeled draw
  combinations** (ten appearances × two sizes × standard/reduced × paused/running).
  These are not 80 browser runs or a physical-device matrix.
- Repository lint, validation, Motion Lab syntax, formatting/native formatting and
  scoped authoring checks passed. Logs are fingerprinted in [evidence.json](evidence.json).
  The final source comment/provenance refresh was followed by producer reproduction,
  the full 137-test focused cohort and scoped checks.
- Independent read-only review verified old bytes, strict loading, packaging and
  unchanged timing. It found stale documentation describing seven choices; that
  now describes all ten. No new candidate defect remained.
- Actual in-app browser frame comparison returned **384 changed frames / 768 held
  poses, no failures**: both painter paths, 20/24/32px, four headings, dark/light
  backgrounds and 4/30/60/120fps sampling. These are sampled raster checks, not a
  hardware performance claim. The Solo diagnostic isolates body and rotors; its
  final contact overlay is reviewed in the playable page. Team includes its cue.
- First Return with v5-detailed completed at **tick 414 / 3.45s**, **34.3% / 30%**,
  three lives and **8,160 points** through real on-screen controls. Deliberate Retry
  retained the appearance and original, showed the 600ms cue at tick zero and
  entered a new attempt. It was then explicitly paused at tick710 / 5.92s.
- Default screenshot viewport was 1280×720. A later paused comparison was captured
  at **1280×800 CSS pixels**. Single-reference-view layout was also visually checked
  at **390×844 and 844×390**, default zoom; board and controls fit together. The
  optional two-view authoring layout can scroll on small screens. These observations
  do not qualify the whole product, actual touch or physical controllers.

Source command:

```sh
node scripts/produce-rotor-body-optical.mjs --check
node --test game/test/feedback-comparison.test.mjs \
  game/test/renderer-readability.test.mjs game/test/presentation-renderer.test.mjs \
  game/test/playable-benchmark.test.mjs game/test/playable-benchmark-focus-host.test.mjs \
  game/test/playable-benchmark-performance.test.mjs \
  game/test/rotor-body-optical-candidate.test.mjs \
  game/test/rotor-body-contrast-candidate.test.mjs \
  game/test/rotor-body-detail-candidate.test.mjs \
  game/test/rotor-proportion-candidate.test.mjs game/test/rotor-presentation.test.mjs
```

## Visual and release boundaries

The broader central face is more prominent in the native comparison, but the
foreground contact ring still obscures detail on a full board. **V5 remains a
candidate.** Drawing that ring behind opaque equipment could hide it completely;
that proposed shortcut was rejected. A future cue treatment needs raster evidence
at edges, overlaps, all headings and both bright/dark backgrounds.

The inherited production guard is still **one pass / one failure**, preserved in
[inherited-team-production-review.tap](inherited-team-production-review.tap).
The exact [adoption checklist](production-adoption.md) separates 37 Team, seven
motion, ten effects/trails and five equipment consumer reviews. The canonical
publisher must reconcile current main and append exact successor reviews, keeping
historical approvals/assets intact. Existing-sprite rotor correction can be
admitted independently of optional new body production.

Observed public selector: **v0.142.0**. Main `7138e7b` includes merged PR768 for
v0.142.1, which is a separate publisher checkpoint. This batch creates no version,
merge, tag or Pages deployment. Full automated suites remain waived, not passed.
Integrated ordinary build, production/provenance checks, public bytes/play,
whole-game performance/offline, listening, hardware and six-player pilot remain open.

## Screenshots

- [Native Solo comparison](optical-solo.jpg), [Team](optical-team.jpg),
  [Team reduced effects](optical-team-reduced.jpg).
- [Actual win](v5-first-return-win.jpg), [retained Retry](v5-retained-retry-paused.jpg),
  [1280×800 comparison](v5-desktop-1280x800.jpg).
- [Portrait primary view](primary-portrait-390x844.jpg),
  [short-landscape primary view](primary-landscape-844x390.jpg).
