# Controller reconnect during an unfinished cut

Both Immediate and Grid + buffer now have actual mounted-host regressions covering
controller loss, held A plus Down on reconnection, neutral input, and fresh A Resume.
The cut and complete paused checkpoint remain exact, stored suspended bytes remain
unchanged, neutral does not resume, and a fresh Confirm resumes the same verified
run. A later pause produces a replay that verifies. No simulation state is injected
and no Resume handler is called directly.

All 14 cases in `touchscreen-controller-host.test.mjs` pass independently on
Node20.19.5 and22.22.2, with zero skips. Loaded tracked module bytes are verified
against the frozen8cff base and exact changed test. Existing cold start, menu-only
navigation, all three touch styles, shared preferences and modality handoff cases
remain in the complete file.

The initial new probe exposed a test-fixture mistake: its release helper cleared
`pressed` while leaving a newly modeled analog `value: 1` held. Release now clears
both. A second assertion inspected state after a real simulated frame had advanced;
the final test inspects the zero-time Resume boundary, then verifies later gameplay
through replay. These are test corrections, not discovered runtime defects or a
reason to weaken the neutral-input requirement. Development logs remain in the
worktree cache; no failed development run is counted as a pass.

This is modeled controller input through the actual host, not Bluetooth/USB or
physical Steam Deck certification. No production runtime changes, version bump,
public release, native device or full-source acceptance are claimed. Integrate this
regression with the pending source work and rerun final release gates.
