# Field Guide late-success review

Status: reproduced unresolved interaction, separate from the queued failure-focus fix.

The failure-focus packet restores Play after a refused lesson while respecting newer attention. Its successful completion path still calls `frame.focus()` and launches practice after the player switches away. The generation guard checks disposal, dialog openness and generation only; page lifecycle does not invalidate it.

Three focused probes held the real impact lesson request, then (1) focused Read, (2) hid and showed the document, or (3) emitted pagehide/pageshow. Resolving the valid original lesson subsequently entered practice, replaced the temporary handoff and focused its iframe in all three cases on Node20.19.5 and Node22.22.2. Both actual candidate source and source-packet hashes are recorded in `observations.json`; raw diagnostic output is retained.

The Node20 diagnostic intentionally selected three scenarios (33 unrelated cases skipped). Node22 reports only the three selected cases. These expected failures demonstrate the gap; neither is a whole-cohort pass. An initial Node22 diagnostic comparing cyclic DOM objects consumed roughly3GiB of memory while formatting its assertion failure and was terminated; the retained rerun compares scalar focus identity and completes promptly. The independent full-source run was untouched.

Recommended follow-up: retire a pending practice launch on background/page lifecycle changes, preserve its parent state and temporary handoff, and require deliberate activation to enter practice again. Define the newer-Read outcome explicitly and retain its focus. Verify successful as well as failed delayed completion, including Close/reopen and a newer launch. Keep explicit Resume and successful foreground entry unchanged. This review does not change production code or claim browser/hardware acceptance.

The finding was sent to the existing UX owner; avoid duplicating their pending correction. Its eventual source commit needs its own focused and native checks before adoption.
