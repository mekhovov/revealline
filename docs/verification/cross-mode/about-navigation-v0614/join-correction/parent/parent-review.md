# About controller-join correction review

Reviewed the four changed source paths against 61cf9c14. The production fix engages the existing controller navigation on successful join before handling commands. The router still enforces neutral input and separate activation. Navigation engagement preserves meaningful prior focus. No shared router, simulation, storage, version or producer changed.

Tests cover initial BODY focus, a previously focused Summary, and held join/release followed by fresh Confirm. The parent reran the original root probe against the corrected runtime: focus is visible after join/release, with no clicks before fresh Confirm. This exercises the actual owner/router/navigation through modeled boundaries; it does not certify native controllers.

The follow-up retains version 0.61.4 because it corrects an unpublished candidate. Original 61cf9c evidence and failed attempts remain unchanged. The final commit still requires full release gates, build, freeze, browser and public verification.
