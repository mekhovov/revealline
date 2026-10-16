# Actor batch 13 — truthful optional-patrol Field details

Parent `2192818e7ec19c70cc76465ab09d608f0d6cf6d0`, draft PR761.
Compatible C4 source work continues while the sole publisher qualifies its fixed
release. C3/C4/C5/C6 remain prioritized; C2 remains last. No new release version,
production review declaration, simulation rule or artwork binding is introduced.

## Implemented

Paused Field details now consumes the existing validated combat projection. It
groups scouts and sentries, shows the nearest locked warning and recovering
sentries, and counts live shots independently. Recovery never means that an older
shot disappeared. Enemy freeze explicitly holds warnings and shots. Removed and
terminal populations have distinct guidance; invalid active data says unavailable.
Absent/disabled combat retains the previous full output. Running event reads do
not add another combat geometry validation. Historical urgency uses an exact
allowlist of emitted events, with unknown future events still unknown.

EN/UK copy is generated through the normal catalogue build. Existing host
ownership, input, Pause, scenario, replay and storage formats are unchanged.
Ordinary Details opening retains the existing pause save that refreshes only
`savedAt`; reading, scrolling and Back add no writes. Practice remains write-free.

## Tests, correction and review

- [Model/source/bridge/pressure cohort](model-final.tap): **49/49** on actual
  source. Real public-core traces cover both steering policies, warning/firing,
  recovery with a surviving shot, closure cancellation, contact/enclosure removal,
  multiple warning deadlines, compatible compiled levels and verified replays.
- [New and existing application-host files](host-final.tap): **15/15**. Actual
  ordinary catalogue admission and compiled no-awards practice retain exact
  checkpoint, replay, continuation and the real paused opener/reading/Back path.
- Exact-parent selected [missing-section RED](missing-section-red.tap): **1 fail,
  13 skipped** through a draft loader. Two actual warning clocks `[60, 90]` exist
  before the missing section assertion fails; this is not an import/setup error.
- Independent review found that all-removed terminal runs returned live-danger
  copy too early. Root reproduced [that RED](terminal-red.tap): **1 fail, 0 skipped**
  using Node22. The corrected tests cover real ram/capture wins at tick846 plus
  a separately running high-target removal. Final source review accepted the
  bounded change and independently matched all12 EN/UK source/compiled keys.

Freeze tests install a valid effect interval after real play; they prove held
clock/projectile semantics, not pickup acquisition. Earlier temporary remapped
diagnostics are not source/build gates and are not added to these counts.

## Native browser evidence

An existing Content Studio draft launched real Sentry detour practice through
keyboard Enter. Start, Escape, Mission info, Field details, reading, End, Escape
and Back worked; the new section was visible and focus returned to Field details
with the flight still paused at0:18. [Screenshot](native-field-details.png).

Actual outer CSS viewport **1102×1343**, iframe box **1035.89×720**, device-pixel
ratio2. A requested390×844 override did not change this existing tab, so no
portrait qualification is claimed. The override was reset; preview was closed
normally and the source draft retained. An attempted cross-frame DOM dimension
read was unsupported; the outer visible frame box supplied these measurements.
Locator click initially did not launch; deliberate native Enter did. These are
bounded native keyboard observations, not physical touch/controller or gameplay
fairness evidence. No browser state was injected to create a combat trace.

## Source/build and production admission

Repository lint, formatting, native formatting, i18n/content/presentation
validation and Motion Lab syntax pass. The ordinary build contains1804 files /
744,585,411 bytes; all manifest bytes and the three affected runtime modules
match. This adds8,851 runtime bytes over batch12. Inherited version0.141.7 and
null source metadata are development labels, not a release reservation. See
[build verification](development-build-verification.json). Raw logs are preserved in `raw-logs.zip`
with hashes; readable copies only trim trailing whitespace.

The [production-adoption audit](production-adoption-audit.md) corrects a misleading
interpretation of the existing guard: two failures stop at Team, while changed
dependencies reopen **67 selected slots** across motion/effects/Team/equipment/
audio. Root independently verified122 raw-file/blob pins and seven ordered group
fingerprints. This is a review map, not approval or producer execution. Reconcile
and recalculate on integrated source; append new exact reviewed successors while
preserving every predecessor. Existing approved imagery may support a smaller
renderer continuation before native candidate-body adoption.

Long suites are waived, not passed. Full Field Guide, cross-mode encounter
qualification, production successors, physical devices, comprehensive offline/
performance, final-source publication and public play remain open. The
[delivery register](../../plan-status-2026-09-29.md) separates these requirements.

Maintainer prompt: “Open paused Details for an enabled optional sentry. Prove the
warning and shot states against public core input, including recovery while a
shot survives, freeze, terminal removal and malformed active projection. Preserve
ordinary absent/off output and live-event costs. Compare exact save/replay bytes,
allow only the inherited opener timestamp refresh, and return to the opener
without Resume. Preserve raw failures and revalidate production closures on the
final integrated source; never confer approval by changing an old fingerprint.”
