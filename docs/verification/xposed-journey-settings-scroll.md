# Solo Settings scroll and responsive focus repair

Publication review supplied a CSS-only correction after Large/Plain text on
public v0.67 at 390 × 844 put Close above the viewport. This P01 integration
does not alter either frozen v0.67 or the qualifying v0.68 source.

The exact local preimage of `game/ui/settings.css` matched SHA-256
`ca56c34bd71a605d89606646d83a0eb42958a359189db3590bd9ca6d07961b1a`.
The reviewed patch matched
`c45614aee4a2713b8857a354dd55d7fbffc754f3676717b8abb0d874d3b3f875`;
the integrated CSS matches candidate
`ce96c1b6388044ae33a98926a5e857f02118df2f303e2d97b3d8fc78e6f20764`.
Original review receipt remains in the publication owner's
`.cache/p03-settings-scroll-5598-r1/ready.json`. Its practical guidance is retained
in `settings-panel-scrolling-guidance.md`, not installed into unrelated global skills.

Only Solo's open Settings dialog becomes a column with a separately scrolling
active panel. Navigation, Close and categories remain outside that scroller.
Short screens compact decorative headings, not the 44-pixel action targets.

Fresh native integration checks with Large/Plain:

- 390 × 844: Close top 10/bottom 54; panel top 331.49/bottom 824; no horizontal overflow.
- 844 × 390: Close top 10/bottom 54; panel top 152/bottom 378 (226 pixels high).
  Keyboard Tab after Cancel reaches Restore defaults at top 241.69/bottom 288.69;
  panel scroll 1023.5, dialog scroll 0, no horizontal overflow.
- Cancel and Escape restore the exact title Settings opener. No mapping was
  applied; temporary text choices were returned to Theme font/Standard and
  viewport overrides were reset. Screenshots were inspected inline.

The remaining responsive-opener case is also repaired: the modal coordinator
checks actual visibility and permits a host-supplied fallback only when its
original opener is unavailable. Solo Settings chooses Game menu only when no
other dialog remains. Explicit replacement focus, remaining top layers,
background pages, hidden/disabled/detached targets and reentrant navigation win.
No other modal gains an arbitrary default fallback.

Native desktop toolbar Settings → resize to 390 × 844 → Escape confirmed that
the original opener has zero client rectangles and that focus lands on the
visible Game menu. The ready board remains at 0:00, 0%, three lives, zero score;
closing Settings does not launch play. Unit and actual-host regressions cover
the same focus policy and unchanged simulation checkpoint.

These are targeted source checks, not published corrections, browser zoom or
physical touch/controller acceptance. Team/Versus Settings still need their own
layout qualification. The original pre-integration reviewed CSS cohort passed
57/57. The expanded final regression passed 64/64 (40.7 seconds), followed by
lint, formatting, content validation and whitespace checks. An earlier host test
waited only for the native close event rather than the coordinator's subsequent
focus microtask; its fixture was corrected to wait for the actual focus outcome
before the complete green rerun. Logs are retained under
`.cache/journey-settings-focus-final-tests.log` and
`.cache/journey-settings-focus-{lint,format,validate}.log`.
