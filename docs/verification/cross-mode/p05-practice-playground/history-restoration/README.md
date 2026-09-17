# History-restored Practice selector — bounded correction

Native Practice → home → Display → browser Back first exposed the correct Plain/Standard/reduced host body with a stale Large selector. The [original failed observation](native-before/history-selector-failure.json) and its exact served [binding](native-before/binding.json) remain unchanged. Browser form restoration did not represent an explicit preference change.

The [successor patch](model/history-restoration.patch) (`eb0cd33f2bf2b85d15695ba5f870943ebf580793f135c962feca3befe2becbe1`) reconciles from the current preference owner immediately on pageshow and once in a cancellable next task. Only an explicit selector change writes preferences. Unsaved owner intent, warning text and newer user choice keep precedence. The repair does not focus, replace or operate the child.

## Corrected native scope

The [actual corrected observation](native-after/history-repair-observation.json) is `PASS_SCOPED_ACTUAL_HISTORY_REPAIR` at its separately pinned [served binding](native-after/binding.json). Practice → actual home/Display Plain/Standard/reduced → Back shows agreeing body and selector. Explicit Large changes them without replacing that current child session. A second actual home/Display/Back journey agrees on Theme/Large/full. The observed viewport is 390×844 with scrollWidth 390.

The returns created new child sessions: neither the failed nor corrected record proves BFCache admission or navigation-time child preservation. The explicit on-page size change did preserve its then-current child session. No physical input, full device matrix, zoom, final committed-source/build or public acceptance is claimed. The later [integrated observation](native-after/integrated-layout-import-observation.json) records actual settings restoration/readback and viewport reset. The separate [before](native-before/cleanup.json) and [after](native-after/cleanup.json) cleanup originals record both server terminations and owned-tab closure.

## Later integrated browser supplement

The [later original](native-after/integrated-layout-import-observation.json) records Practice and Playground Theme/Large document widths fitting 390×844 and 844×390. In Playground, Scout → Fiber draft → Undo restores Scout while the running child remains revision 1. An actual file-chooser import of the earlier exported pack validates and decodes; only explicit Play changes the child to revision 2, followed by actual Start/Pause. The earlier [export/import observation](native-before/export-import-observation.json) retains the 862,703-byte export SHA and exact original image hash, including the timed-out CUA download-event observation and actual downloaded-file recovery. It is bound to the earlier integrated runtime; the later import/Play observation has its own corrected binding. The exported image-containing JSON is not duplicated here.

These results are scoped progress. Width equality does not establish all focus/target clipping, a complete font/size/device matrix or 200% zoom. No naturally nonempty offscreen live action set was observed, no physical hardware was qualified, and these journeys do not close all R1 or final source/public gates.

## Focused regression originals

The [final handoff](model/handoff.json) pins the original 2,229-byte owner and corrected 3,097-byte owner plus the new 177-line regression file. Tests use real display/preference owners with explicitly modeled browser restoration, task and frame boundaries.

- Final [Node 20](model/runs/three-file-node20/receipt.json) and [Node 22](model/runs/three-file-node22/receipt.json): all three complete restoration, display-preferences and Practice/Playground display files pass **61/61 per runtime**, zero failures/skips/cancellations/todos.
- [Unchanged-parent discriminator](model/runs/parent-final-node20/receipt.json): 1/7 passing. Four behavioral restoration checks and two task/lifecycle assertions fail; this is not a claim of six separate player defects.
- Earlier preformat and formatted two-file runs remain intact, with raw stdout/stderr and commands. They are superseded in coverage by the final three-file cohort, not rewritten.

The original model README/handoff predates the actual browser retest; its `PENDING_ROOT_RETEST` field is historical. The later native observation above supplies only the scoped browser result. Likewise the initial failed native record stays failed.

[Selected originals](selected-originals.json) records exact source paths, byte lengths and SHA-256. The selection includes small bindings, original patch/runtime/test bodies and all focused run logs; heavy fixtures, exported image-containing JSON, media, live request logs and browser screenshot exports are omitted. Original cache/relative links remain historical, not portable fixture promises. This packet supplements the existing candidate evidence; it does not close P05 or relabel older limited rows.
