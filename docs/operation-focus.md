# Completed-operation focus

Chapter selection and Library installation temporarily disable their initiating buttons. Keep the actual focused control before disabling it, then return focus after completion or error only while that operation still owns the user's attention.

`captureOperationFocus` is a disposable UI lease. It never runs an action or opens a dialog. It requires the original connected, enabled and visible control in the same foreground dialog, and empty or still-owned focus. Another control, input outside the owned controls, a dialog transition, true window blur, hidden document or pagehide retires it. Consume the lease before calling focus so reentrant handlers retain authority.

A capturing window blur listener also receives non-bubbling descendant blur. Require `event.target === window` for loss of page focus; disabling the owned button must not invalidate its own lease. Test the actual event target and capture path, using one Window identity.

The chapter adapter requires an observed busy cycle and the same mirrored card; external native selection or destruction cancels it. Library keeps its existing task/check/commit/abort authority. Automatic completion and explicit Cancel have separate intent. Tabbing elsewhere retires the automatic lease. Activating the actual focused Cancel button captures a fresh lease before abort, with `restoreTo` constrained to the original connected opener in the same dialog. Cleanup can still retire it through newer focus or backgrounding. A detached durable operation abandons focus restoration without claiming rollback. The connected builtin Install button survives refresh. Removed/recreated row actions, including Remove from device, have no same-control target and no new fallback here.

[Retained evidence](verification/cross-mode/p03-operation-focus/README.md) records the first native failure, the corrected event boundary, full affected-file tests and the limited native journeys. This does not change saves, gameplay, content identity or the strict profile format.

Reviewed 2026-09-15: the [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) describes returning focus to the invoker on close, with a logical alternative if it is gone. [Xbox accessibility guideline 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) calls for predictable UI focus. Returning from an explicit operation Cancel is RevealLine’s application of predictable focus; neither source prescribes this lease implementation.
