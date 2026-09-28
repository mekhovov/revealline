# Actor batch 3 — playable comparison and rotor authoring

28 September 2026. This is a bounded implementation successor to
`9a86e8f50621473a7508c9e723f86bf48bcd38eb` in draft PR761. It is not a published
release or whole-programme acceptance. The [current plan](../../plan-status-2026-09-28.md)
distinguishes public v0.142.0, the publisher's separate queue, this source input
and the remaining C0–C7/UX qualification work.

## Implemented

- The playable benchmark can explicitly load native v3 Scout candidates at
  automatic, 32px or 64px treatment into its second real `BoardPainter`. The
  reference keeps the approved FPV lease. Exact original artwork, simulation,
  contact radius and appearance pins are unchanged.
- Candidate loading verifies bounded files, source fingerprints, PNG hashes,
  dimensions and retained v2 geometry. Separate source-only provenance never
  grants approved pin authority. Failed/cancelled/stale preparation keeps the
  previous accepted comparison paused; scene departure releases resources.
- Independent capture-pulse and extra-event-flash switches affect only those
  decorations. Local loss location/cause, recovery, active trail, contact and
  threat information remain. Hidden effects still age and expire. Defaults
  preserve the prior presentation.
- Asset Studio exposes native per-hub X/Y/radius/direction/phase controls through
  its existing geometry and slot validators. Invalid/stale edits preserve the
  accepted preview. Advanced JSON, original bytes, absent historical fields,
  immutable revisions and dedicated Studio storage remain intact.
- The Studio preview status now renders and re-localizes its callback label
  rather than displaying function source. This defect was also present in main
  `742e4b142db681e5a6c901b35bfb4d19f0b9c8c5`.
- Three exact optional Workshop inputs are included: the v3 manifest and Scout
  compact/detailed PNGs, **23,583 bytes** in total. Carrier/concept images are
  excluded. These are packaged unapproved study assets, not runtime bindings.

## Automated and source evidence

The final combined focused run passes **105/105 tests**, with zero failures,
skips, cancellations or todos. Reproduce with:

```sh
node --test \
  game/test/feedback-comparison.test.mjs \
  game/test/renderer-readability.test.mjs \
  game/test/presentation-renderer.test.mjs \
  game/test/playable-benchmark.test.mjs \
  game/test/asset-studio-rotor-controls.test.mjs \
  game/test/asset-studio-host-loading.test.mjs \
  game/test/asset-studio-rotors.test.mjs \
  game/test/asset-studio-loading.test.mjs \
  game/test/presentation-rotor-geometry.test.mjs
```

The actual build collector test verifies the complete candidate dependencies and
their source fingerprints. Each of Solo, Versus and Team retains an identical
core closure before/after adding the three candidate files; all three belong to
optional tooling. This is a collection/dependency check, **not a fresh ordinary
distribution build**.

Repository lint, format, native format, validation and Motion Lab syntax pass.
Authoring modules receive separate scoped lint/format checks because repository
lint does not include that directory. `validate` includes the EN/UK catalogue
check, content/schema validation and exact presentation metadata check. See the
logs and checksums in [evidence.json](evidence.json). The successful lint log
has one trailing blank line removed; its original byte count and checksum are
also recorded. No diagnostic lines were changed.

An additional read-only experiment compared new default rendering with exact
parent `9a86e8f` across 18 Canvas command/effect traces: three pressure phases,
three run states and reduced effects on/off. All matched. This experiment uses
finite image stand-ins and recorded Canvas operations; it is not raster proof.
The default behavior, essential cue and simulation checks are also covered by
the committed focused test file. Do not add overlapping counts from separate
review runs or earlier batches.

Independent read-only reviews found no concrete blockers in candidate
integrity/disposal, comparison ownership or the Studio geometry/history paths.
They do not replace publisher review of the reconciled source.

## Native browser evidence

The built-in browser used the local source server at port 8807. Final checks
used a fresh `127.0.0.1` origin: the already-open `localhost` Studio retained an
older preview module after reload. The fresh origin showed the corrected
**Saved preview: Ready / Draft preview: Ready**, and both updated to Ukrainian
without repainting. Cache/update behavior in the published game is not
qualified by this observation.

- **Real play:** First Return completed with v3-auto in the second view at tick
  **442**, **3.68 seconds**, **34.3% / 30%**, three lives and 8,160 points.
  Both painters revealed the same exact original. The result waited for Retry.
  An earlier same-source-logic run exercised keyboard Retry at tick 0 during the
  600 ms cue, then fresh steering and another win. No awards or saves were made.
- **Pursuit board:** A Return in Reserve started and paused at tick 29 with the
  v3 native-64 comparison, a visible TRAIL cue and retained field/actors. The
  second view's reduced/capture/flash options changed while the run stayed at
  tick 29. This is not a completed pursuit/interception playthrough.
- **Art observation:** the larger rotors and separate body are visible on the
  real board. The slimmer v3 centre is less visually prominent than the approved
  amber body at this scale; contrast and whole-board art review remain required
  before production adoption. The candidate is not declared approved here.
- **Studio failure/success:** changing hub 1 X to 0.05 produced the visible
  envelope error and retained X=0.25 in accepted JSON. X=0.30, counterclockwise
  and phase 90 applied successfully to the draft. EN/UK controls reflected the
  effective direction. The temporary edit was discarded through the UI;
  existing saved revisions were unchanged.
- **Layout:** final Studio form checks used actual CSS viewports **1280×800,
  390×844 and 844×390**. Rotor targets were at least 44px tall, with no page
  horizontal overflow at the narrow sizes. Keyboard Tab reached numeric fields.
  An earlier 390×801 observation is not the final portrait evidence.
- **Benchmark layout:** the complete primary board and its 52×48px D-pad fit at
  390×844 and 844×390. The optional second board remains a review layout and may
  scroll on small screens. The desktop two-board comparison was reviewed at
  1280×800. Temporary viewport overrides were reset afterward.

Screenshots:

- [Real-board Scout comparison](scout-board-comparison.png)
- [Final-source completed mission](benchmark-win.png)
- [Short-landscape primary play area](benchmark-landscape.png)
- [Desktop Studio controls](studio-rotors-desktop.png)
- [Ukrainian portrait Studio controls](studio-rotors-uk-phone.png)

## Release and evidence limits

No simulation identity, approved asset, production history, package version,
tag, main branch or public release was changed by this implementation batch.
The prior Team production guard's **one pass / one failure** remains unresolved;
its new recipe/fingerprint requires explicit reviewed production adoption. See
[batch 2](../actor-batch-2/README.md). Do not rewrite historical fingerprints or
interpret optional candidate packaging as adoption.

The ordinary full build must run on the final integrated candidate. The previous
batch's ordinary build does not cover this delta. A duplicate local full build
was avoided while the canonical publisher uses the limited shared disk; the
small real-collector test above checks this delta's package inclusion now.
Required integrated/source/provenance/build and public-byte/play gates still
block release.

Long suites remain waived by the committed temporary policy, not passed.
Physical touch/controller/Steam Deck checks, audio/haptics/listening, actual
frame-time/memory sampling, comprehensive offline recovery, all-mission balance,
six-player sessions and whole-roster art acceptance remain open. Browser pointer
interaction and modeled controller tests are separate evidence categories.
