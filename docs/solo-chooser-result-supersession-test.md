# Solo chooser supersession fixture

The result-supersession host test must follow the existing Solo selection contract:
choosing an exact mission prepares its rules and original picture in a paused,
zero-tick briefing. A fresh Start begins play. Retry and Next retain their separate
single-action continuation behavior.

The fixture now joins the real visible Missions and mission-card operations through
the existing test helpers, matches the complete Opening Journey identity, verifies
the accepted ready briefing, and observes one actual Start operation. Its temporary
Start observer is restored in `finally`. No production code, helper, timeout,
catalogue, asset, or gameplay state is changed.

All original assertions remain, including the completed run retained while Next's
decoder is held, stale image release after supersession, authoritative checkpoint,
accepted picture, running state, canvas focus, and absence of host errors. The
warm library is already prepared by Next before its decoder is held, so the test
does not invent a second cold-index fetch boundary.

Validation on parent `51b5d9d466b32deb6861a2419d264b720321c43d`:

- Original complete file: **0/1**, failing at the immediate-running predicate after
  card selection (`Asynchronous host action did not settle`, original line 86).
  The file is unchanged from captured main
  `a94f2a6c3dac43ebeead58036a7b890414dfff37`; the actual briefing contract and
  adjacent Solo-library Start test establish the cause.
- Corrected complete file: **1/1 pass**, zero skips or cancellations, exit 0,
  9,785.130 ms overall. The parent and reviewed test diff were unchanged before
  and after the run.
- The other nine complete F10 files passed **134/134** on the unchanged parent in
  separate fresh processes. Those results are separate evidence, not a rerun of
  the full cohort on this child.
- Runs used Node 22.22.2, one complete file per process, with compile caching
  unset and no lazy Git fetches. No polling deadline was increased.

For independent prerequisite admission, the same exact test patch was then
applied to captured main `e7465da3e4b1146b492f401fbb165a5e5a4a6202`. The original
test and 12 inspected helper/library/picture blobs are byte-identical to the F10
parent, as are the actual Missions, selection, preparation, Next, and Start
function bodies. All 12 original assertions remain verbatim; the correction has
25 assertions overall.

The complete file also passed **1/1** on the actual e746 checkout, zero skips or
cancellations, exit 0, 9,982.668 ms overall. The main source, exact transposed test
patch, and verification document were unchanged during that run. Only this test
and document are delivered by the independent prerequisite PR; the F10 parent
and its separately preserved tested child remain unchanged.

This is test reliability evidence at the modeled DOM/decoder boundary. Full
repository gates, current-main admission, native rendering, physical devices,
offline behavior, and hardware qualification are outside this correction.
