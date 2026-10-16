# Actor batch 8 — C3–C6 priority implementation

28 September 2026. This checkpoint is a child of PR761 source
`efa33669249402ede3e1e651f1d4f3ad8f840c03`. It changes no published tag,
production collection, mission original, release version or current Journey.
The canonical publisher owns reconciliation and admission; main and this older
feature branch have different accepted production and localization history.

The user's latest priority is implemented in the plan: **C3/C4/C5/C6 in parallel,
C7/whole-content qualification afterward, C2 last**. Necessary per-feature
compatibility, source, geometry, provenance and focused checks still apply.
An occupied publisher does not block this independent source work.

## Implemented slices

| Phase | Source result                                                                                        | Still required                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| C3    | Seven native FPV class bodies,14 PNGs, exact retained rigs and actual-painter roster review          | Production adoption;20px contact-cue/art balance; wider enemy and Team states                     |
| C4    | Optional-combat authoring preserves registered v9 pressure recipes and unrelated missions            | Readable live optional-encounter preview and human counterplay/fairness; Team remains unsupported |
| C5    | Original workshop, Poltava courtyard and Synevyr-inspired source scenes with full prompts/provenance | Prepared board derivatives; cultural-detail correction/review; branding and cross-mode acceptance |
| C6    | Real Studio source-packet import, treatment editing, source preview and export/reimport              | Runtime policy adoption, other moving parts/state tooling and complete authoring qualification    |

### C3 native roster

`authoring/library/fpv-body-roster-candidates/` contains native32/64px bodies for
Scout, Bomber, Carrier, Interceptor, Fiber, Impact and Trapper. Scout retains v5
and Carrier retains v3 bytes; the other five classes add distinct equipment
silhouettes. All retain their v2 motor positions, handedness, phases, envelopes
and smaller hubs. Fourteen PNGs total **6,240 bytes**, with a **143,360-byte**
decoded RGBA lower bound. New bodies and review are source candidates only.

`c3-roster-focused.tap`: **56/56 passing** across the six complete roster/earlier
candidate/review files. Includes exact source/manifest/PNG/dimension checks,
stale decode closure, preserved original bytes and actual painter commands.
`c3-roster-final-source.json` records final source fingerprints.

Actual browser matrix: **672 changed rotor frames /1,344 held or reduced poses /
zero failures**, using native CPU-readback canvases. See
`c3-roster-final-raster.json` and `c3-roster-review.md` for conditions and exact
scope. Team detailed/light/reduced view was visually checked at1593×1179 CSS,
DPR2. Propellers remain attached. At20px, the contact ring still dominates some
equipment, so this is not production-art approval.

The first default accelerated-canvas run reported286 reduced Team byte
mismatches despite identical actor frames and complete draw-command streams.
`c3-roster-initial-raster-failure.json` preserves that result. Choosing the
readback-oriented context already used by the previous source study stabilized
the comparisons; no simulation, clock, painter or body bytes changed. The pass
establishes CPU-readback behavior. It does **not** resolve accelerated raster,
GPU or physical-display equivalence.

### C4 catalogue compatibility

`c4-original-failure.tap` preserves the reproduced downgrade failures. The old
preparation changed a v9 project to v8, changing an unrelated Standard pressure
mission's warning/commit/cooldown90/144/300 to120/180/306 ticks. The compiler also
rejected inherited v9 optional-combat roles. Capability-based registered
catalogue validation fixes both without altering any catalogue recipe.

`c4-focused.tap`: **35/35 passing**. Evidence covers all three difficulties in
Solo/Versus, untouched sibling identities, explicit off/on, old-catalogue and
Team rejection, real pressure/sentry inputs under both steering modes,
replay/session restoration, capture cancellation and Studio stale controls,
Undo and export. Fixtures use authored catalogue values, not ordinary
fresh-attempt tuning. No full-mission or human-fairness claim is made. The
existing enabled-combat live-preview guard remains; it was not removed merely
to make an authoring check pass.

### C5 original source cohort

`authoring/library/community-art-cohort-v1/` contains three unchanged generated
originals, their effective prompts, strict collection metadata and reference-only
sources. All outputs are **1774×887**, rather than the requested production
sizes. Total PNG payload **7,633,598 bytes**; decoded RGBA lower bound
**18,882,456 bytes**, excluding GPU/decoder overhead. No mission binding or
original ownership changes. Production derivatives remain to be prepared.

The Poltava composition contains paired shutters and ornamental beam ends that
need cultural review/correction against its regional reference. It is not an
exact Kuntseve-house reproduction. Community/museum imagery was not supplied to
the generator or copied into the candidates. Generated originality is not
community branding permission or historical accuracy.

`c5-source-packet.tap`: source/metadata/prompt hashes and every original byte
survive export/import. That test's decoder reads headers; native decoding is
separate browser evidence below.

### C6 actual Studio workflow

New `revealline-artwork-collection.v1` metadata and `.rlart` transport remain
separate from historical `.rltheme` and runtime presentation records. Pixel art
is the default. Photographs require explicit photographic-reveals treatment and
reveal roles. Incorporated references require a declared rights basis; importing
a declaration does not verify legal permission or approve production use.

Bounded reader checks metadata, original byte counts, hashes and static headers
before native decode, then verifies native dimensions. Failed/stale/cancelled
work retains accepted content; departing releases owned URLs. Full contract and
resource limits: [artwork collection packets](../../artwork-collection-packets.md).

Actual local browser interaction, through the final Studio UI:

1. Import the JSON and all three source PNGs; observe immediate verification,
   native decoded originals and source/provenance fields.
2. Export a real `.rlart`; automatic and fallback-link downloads both complete.
   Their identical **7,642,568 bytes** have SHA-256
   `8d2a403fd9e95b3362a061f2d9d983ee1235f81be4e3e6315c991edc84c0c63e`.
3. Reload and import the downloaded packet alone. All three sources decode and
   can be selected; source hashes and all bytes match. See
   `artwork-download-roundtrip.json`.
4. Switch EN→UK→EN. Panel text changes; authored declarations stay unchanged;
   reference links retain their exact URL and safe new-tab relationship.
5. Import a deliberately truncated packet. A visible failure retains the selected
   Synevyr source, its1774×887 decoded image and original metadata.
6. Select Synevyr, change treatment to photographic reveals and back. Revision
   advances1→2→3 while the selected artwork remains Synevyr. Sources remain
   pixel art; collection treatment does not convert their bytes or medium.
7. Inspect390×844 CSS layout: no horizontal overflow; import row64px high;
   each other panel input/select/action at least44px high. Restore viewport.

Browser review found and corrected language refresh deleting source links,
a retained preview callback overwriting newer operation status, and treatment
edits resetting the selected artwork. Mounted host regressions cover these.
The real browser confirms final link/selection behavior. Source panel screenshots
are `studio-artwork-source.png` and `studio-original-provenance.png`.

The browser automation's download-event observer timed out, while both actual
files completed in Downloads. This is recorded as a tooling limitation, not
ignored as success or reported as a product download failure. Byte verification
and reimport used those actual files.

## Final source and build checks

- C3 complete-file cohort: **56/56 pass**.
- C4 catalogue/combined-attack/Studio cohort: **35/35 pass**.
- C5/C6 final packet, mounted panel, actual Studio host loading and build module
  graph cohort: **17/17 pass** in `c6-studio-focused.tap`.
- Repository lint, format check, native format check, content/presentation
  validation and Motion Lab syntax pass. Scoped authoring/review formatting
  also passes. Logs are retained as the corresponding `.txt` files.
- Ordinary local build passes: **1,796 files /744,498,292 bytes**. Every manifest
  file's length/hash verifies; affected Studio modules and language bundle match
  the source bytes. See `development-build-verification.json`. This development
  output retains old branch version0.141.7 and `sourceRevision:null`; it is not a
  frozen release or exact integrated-source qualification.
- The first build refused the symlinked macOS `/tmp` parent before writing;
  rerunning with its canonical `/private/tmp` path passes. The first refusal is
  retained in `development-build-first-attempt.txt`.

Counts are bounded cohorts and overlap earlier evidence; do not add them to claim
unique whole-game coverage. Source-only body/scene candidates are deliberately
not new production runtime dependencies.

## Acceptance limits

This batch does not complete whole C3–C6 phases. Focused source/host/browser
checks are distinct from physical-controller, touch hardware, human fairness,
listening, whole-game offline and final public acceptance. Full long suites are
waived by the existing committed temporary policy, **not passed**. Required
integrated production provenance and exact-source publication gates remain with
the publisher. The earlier Team production-review guard failure is still an
explicit adoption requirement; no historical fingerprint is rewritten here.
