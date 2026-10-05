# Native preview navigation

An explicit `artReview` choice now survives native Solo, Versus, Team, Snake, FPV and creator-tool links within the same build. The shared parser admits only the three retained review revisions. Missing, unknown or duplicate source choices do not propagate. Explicit destination choices are preserved. Different origins, schemes, installed edition roots and provider routes do not inherit the choice.

The choice stays in navigation only: it does not persist a preference, import a content owner, replace a prepared attempt, or grant progression. Actual Capture mode departures still run their existing authority, save, cancellation and download checks before the preview choice is attached to the accepted destination. Team's idle native-link path and confirmed active-attempt path use the same rule.

Controller Lab returns now reopen **Settings → Controls** and focus its existing entry, where the shared native menu places the tool. Its return link says **Back to Settings**. Other fixed creator tools still reopen their actual Workshop entries. No attempt starts or advances during tool return.

## Browser observations

The normal review-page Snake link opened Cable Cutoff at its native briefing. Back to mission selection and title retained the review choice. Snake → Solo → Versus → Team retained `industrial-roster-v3`. This pass found and corrected an additional Team idle-link rewrite which had removed the choice after showing the correct URL.

The normal Solo Settings → Controls → Controller practice → return route reopened Controls with `shell-controller-lab` focused, both the owning Settings dialog and underlying title open, and the game still at zero time. [Observed menu](controller-return.png).

These are desktop-browser observations. They do not establish physical controller, phone or performance qualification.

## Verification

Focused root navigation/Snake/FPV/Studio checks passed 51/51 on Node 22.22.2. Tool and Asset Studio return checks passed 35/35, including all ten tool owners and unchanged paused/checkpoint/storage assertions. Host departure and additional compatibility receipts are recorded with the PR. The new navigation and owner regressions are included in the committed-source industrial matrix.

The restored broader checks exposed obsolete fixture assumptions: three total title-row children, a selected mode rendered as a span, unreleased boot-inert in an already-booted Couch shell, and disconnected pads without joined seats. Repairs model current native UI boundaries while retaining gameplay and stale-action assertions. Production navigation fixes and fixture repairs are reviewed separately in the diff.
