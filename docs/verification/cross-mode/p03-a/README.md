# P03-A — Workshop parents and Team destinations

Candidate source `09861a9c445728b0ee007d536309faee44d6279c`; this is preparation, not an accepted phase or public release. The [evidence index](evidence.json) retains source-bound tests and browser observations.

The source closes two navigation gaps. Library and Help opened from Workshop retain that parent and restore their actual opener on Back. Explicit challenge selection or saved-flight load closes the retained parents and focuses the selected flight; failure and passive Back keep their original behavior. Team receives a fixed Solo or Versus return destination; unknown or duplicate query values use the fixed Versus fallback.

All 92 focused tests pass on Node 20 and Node 22. Native keyboard checks additionally verify the Title/Workshop Library and Help loops, unchanged paused HUD values through those loops, explicit Resume, and both Team return destinations. Native input used only keyboard actions after each documented entry; opening the Versus test origin itself used navigation.

## Remaining acceptance

Team currently restores the correct host, rather than the exact previous menu. On cross-document return, the observed focused element was the web area; deterministic initial focus and origin restoration need the next navigation slice. Native saved-load/challenge handoffs, physical controller/touch, responsive layouts, all other player screens, final integrated source gates, and public deployment are still open.

The source preview overlays the candidate files and reads absent assets from the exact candidate Git tree. It does not stand in for a production build. Raw accessibility responses can contain diffs; the evidence index records normalization and original hashes. Historical automated receipts retain their original native-pending limitations; this later report adds only its named browser checks.
