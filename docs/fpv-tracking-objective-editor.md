# Follow and Observe objective editor

Creators can configure moving-subject activities in Workshop without editing
JSON. The existing simulation, objective format, course IDs and recordings are
unchanged.

## Creator workflow

1. Open a challenge or import a GLB world in Workshop.
2. Select an actor and use **Follow & observe**. Hazards cannot be subjects.
3. Choose **Observe** for continuous observation or **Follow** for observation
   that also requires the subject to travel. Follow needs a moving actor and at
   least two distinct waypoints.
4. Set distances, relative speed, bank/tilt, nose angle and continuous time using
   metres, metres per second, degrees and seconds. Follow also sets required
   subject travel.
5. Add to Self-level, Acro or both. Each mode inserts the objective before its own
   final landing. Select an existing objective to edit, remove or reorder only
   that mode. Undo/redo, playtesting and project/pack export remain available.

Tracking requires airborne flight, geometric line of sight and the actual drone
nose within the configured cone. Camera tilt and FOV do not change the criterion.
Leaving any limit resets both the continuous timer and accumulated subject
travel. Follow completes only after both requirements are met; its duration can
exceed the minimum time.

Generic route editing previously assumed that equal indices represented the
same objective in both modes. It now propagates edits only while the complete
mode arrays match. Divergent routes clearly show **Self-level only**; independent
Acro objectives and source bindings are preserved. The dedicated tracking
inspector always names its selected mode explicitly.

## Verification

- Actual production-host browser: **63/63** checks using an original tiny GLB,
  native Workshop controls, isolated browser storage and a real WebGL preview.
- Different mode lengths/order, exact numeric conversion, invalid limits,
  stationary Follow rejection, generic-route isolation, actor movement/role and
  deletion, undo/redo, editable ZIP and compiled pack reopen, and reviewed/cancelled
  reimport all pass. EN/UK layouts pass at 390 × 844 and 844 × 390.
- The exact UI-authored export completes and independently replays in both modes:
  Self-level 627 ticks; Acro 548 ticks; zero contacts. Ordinary scripted flight
  commands qualify objective feasibility, not player usability.
- Integration with pending section replay #972 passes **53/53**, including
  uninterrupted full and section autoplay, pause during loading, disposal and
  supersession. This is separate integration evidence; the editor itself has no
  playback dependency and targets main independently.
- Syntax, lint, formatting and independent source review pass.

The fixture initializes an asymmetric non-tracking route through the existing
Advanced JSON input after GLB import. All tracking criteria and subsequent
edits use the native inspector. It does not claim the entire initial fixture was
built through visual controls.

Evidence: [browser receipt](fpv-tracking-editor-browser-verification.json),
[export/replay receipt](fpv-tracking-editor-functional-verification.json), and
[section regression](evidence/fpv-tracking-editor-section-regression.json).

Player-feedback sessions, physical controls and sustained device performance
remain pending and do not block implementation. Additional unit coverage stays
in H/R7. Frozen package and publication evidence are recorded separately below
when completed.

## Packaged candidate

Standalone candidate `aa05d0b93` targets main `742d25225`. All three optional
packages pass committed-input and ZIP verification with two identical builds.
World Studio uses **99 source files / 14,451,645 bytes**, under the unchanged
104-file / 16 MiB policy. The actual packaged Workshop repeats **63/63** browser
checks. See [package admission](fpv-tracking-editor-package-verification.json)
and [packaged browser receipt](fpv-tracking-editor-packaged-browser-verification.json).
These receipts establish functional development readiness, not public release
eligibility or completed human/device review.
