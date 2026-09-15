# Independent P01 G0 loading review

Read-only review of the current working tree based on `a395462b101c348d28ee2643c24263ca72b2c751`. This review did not edit runtime code, rerun the full suite, build, commit, or accept P01. It includes source verification of the root owner's subsequent corrections. Focused-test counts below are the owner's reported results unless stated otherwise.

## Findings and corrections

1. **Fixed — offline Stop waiting loses focus when hidden.** `game/ui/offline-panel.mjs:37–51` now captures whether Stop owns focus before updating/hiding controls. Current completion does the same at lines90–96. Focus returns only with the Settings dialog open and the document visible/focused. This covers native focus loss when hiding a button and prevents background focus theft. Root reports 5/5 focused cases passing, including native-hiding fixture semantics; native browser retest belongs to root evidence.
2. **Fixed — Deploy loading text destroys its label and decorative arrow nodes.** `game/ui/game-shell.mjs:207–219` now changes only the existing `[data-field-kit-copy]` label node. Its sibling `aria-hidden` arrow and the label hook survive preparation and restoration. Root reports 8/8 lifecycle tests passing with child preservation. Current source also retains the home-visit fence before opening Missions after delayed completion.
3. **Fixed — a new attempt re-enables Export during an older pending replay download.** `game/app.mjs:3955` now respects the existing `replayDownload` lock. Closing the replay dialog clears only its observer; `downloadCurrentReplay` retains the pending operation until actual completion and reconciles current controls at lines5014–5018. `game/test/practice-retry.test.mjs:12` meaningfully executes the actual web export promise boundary, closes/restarts before settlement, checks the retained lock and hidden notice, then verifies late completion unlocks the new attempt without reopening or stale notice. Final 3-case result was still running when root requested this handoff.

No unresolved concrete G0 source defect was found after these corrections.

## Boundaries reviewed

- Boot first paint, stylesheet/module dependency failure, ready handshake, delayed startup and listener/disposal ownership.
- Shared operation presenter leases, stale completion, terminal/detached state, measured progress, live-region behavior and reduced motion.
- Title visit ownership and navigation during delayed deployment.
- Picture prewarm joining, failed retry, exact original preparation, saved-flight cancellation, visibility/focus/modal gates and explicit Resume.
- Candidate theme preparation and cosmetic feedback separation; existing warnings and required-art policies remain distinct.
- Soundtrack initialization and preparation feedback; original audio gesture ordering retained.
- Offline worker observation versus installation ownership and terminal reconciliation.
- Replay download observer lifetime and current-run control reconciliation.
- Static HTML hooks and explicit shared stylesheet packaging in the release catalog.

## Coverage and release boundaries

The source inventory retains all A01–A56 owners. I found no additional unowned implementation path in the reviewed G0 scope. Group coverage files contain initial pending notes followed by later corrections; the final consolidated inventory must use their latest evidence, without treating every initial pending label as an unresolved failure.

- G6 explicitly has **no real-browser installed-original Versus selection sample for A45/A46**. Its 10 actual reader/host tests cover authenticated originals, cancellation, shared boards and no Solo writes. The browser did exercise real delayed Couch startup, but that does not prove the required-original selection UI. Retain this as a browser evidence gap unless separately exercised; it is not a demonstrated runtime defect.
- Root's later G0 browser evidence supersedes the initial saved-flight-pending rows: actual decode completion held, cancellation preserved saved JSON, late completion fenced, Retry restored paused, and native keyboard cancellation restored Start focus. An earlier timeout attempt is not counted as cancellation success.
- G4/G5 browser coverage is bounded. Library held native read/cancel/retry passed; backup only reached real preparation before navigation. Still/story native inspection and frame capture passed as an unsaved draft; no complete story save/playback or backup restore is claimed. Native poster encode cancel/retry and the corrected sticky status passed desktop/portrait/landscape. See the separate review below.
- Full source tests, exact committed six gates, ordinary build, production reproduction/readiness, immutable freeze, deployed byte/identity/play checks and actual release-worker offline checks remain release qualification prerequisites. Ordinary source-page messages and worker fixtures do not replace those checks.
- Physical controllers/phones, every-menu keyboard/touch/controller traversal, full native zoom qualification and the later navigation/map/UX redesign remain separate evidence/phase work. The current browser samples must not be described as physical-device or exhaustive keyboard-only passes.

## Related evidence

- `.cache/cross-mode/p01/g4-g2-independent-loading-review.md`: prior bounded source review. Its Studio module-failure finding was subsequently fixed with the independent direct-tool loader; the original report deliberately records the earlier source.
- `.cache/cross-mode/p01/browser-g45/review.json`: bounded ordinary browser review, SHA256 `c2c2edf3ac34b3f28213ec75b7fa3fb863665b368194248a1a25abb4c0c2ecd9`; `evidence-manifest.json` pins 60 evidence files. Final owned tests passed31/31, with scoped lint/format passing. Native API boundaries restored; isolated browser and server closed.
- `.cache/cross-mode/p01/g5-coverage.md`: A35–A41, A04 and direct-route implementation/focused evidence, including 172/172 G5 cases before browser and separate integrated-entry23/23.
- G0, G1/G3/G6, G2/G4 and G7 coverage files contain each owner's more detailed test logs and later browser corrections. This review does not aggregate overlapping runs into a misleading total.
