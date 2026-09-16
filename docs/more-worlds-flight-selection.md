# More worlds: keeping the current flight

More worlds separates installing content from choosing a mission. Installing or
checking a chapter does not replace the current run. Choosing the already selected campaign
keeps the exact run, its queued turn and its paused state; it does not restart the
chapter's first mission. In a pack containing multiple campaigns, Choose targets
the first authored campaign; Missions provides the other campaign choices.

Choosing a different chapter uses the same checked replacement decision as
Missions and Library. Stay keeps the flight and returns to the originating Choose
button. Replace prepares the selected chapter without starting it. The dialog
reports a verified saved flight only after replay verification and storage
readback succeed. A failed save warns about losing the attempt; it never silently
authorizes replacement. A changed saved slot still requires a fresh explicit
Replace decision.

All three adapters participate: ordinary installed chapters, catalog chapters
with verified artwork, and descriptor-backed original-picture chapters. The last
adapter still checks and reconciles the installed content catalog before asking
to replace the flight. This may update content references and invalidate an
attempt-file operation, but it does not replace the active run or recorder.

The chapter panel owns the pending choice beyond the initial verification task.
Its Choose button can temporarily be disabled while preparation runs. Successful
adoption closes the panel once and focuses the new briefing; a pending decision
does neither. Closing the parent, changing its selection, backgrounding the page
or starting newer work retires the previous choice. A late callback cannot close
a newer panel or select a chapter.

Stay also works before saved-flight verification finishes. The closing decision
releases its own parent operation immediately, making the originating Choose
available before returning focus. This explicit handoff does not wait for an
already queued storage callback. The cancelled callback cannot save, select,
move focus or release a newer operation. Focus returns only while the current
foreground decision still owns it; newer focus and retired visits remain intact.

The pinned browsing label says **Chapter in view**. Installing or inspecting a
card does not make that chapter the active flight.

This follows the focus-return and contained-navigation principles in the
[W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
The operation ownership and saved-flight checks are RevealLine's implementation
choices, rather than requirements prescribed by that guidance.

This correction belongs to the unaccepted v0.59.0 navigation candidate. Its
targeted regression evidence and complete affected-file results are recorded
separately from full source qualification, public deployment and physical-input
acceptance. P03 remains in progress until its full gate is satisfied.
