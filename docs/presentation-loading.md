# Presentation loading contract

P01 implementation contract, September 2026. Release acceptance belongs to the [cross-mode execution register](cross-mode-execution.md), with exact source, version, public bytes and browser evidence recorded separately.

## Feedback and ownership

Use `createOperationStatus(target, { isCurrent })` from `game/ui/operation-status.mjs` and the shared stylesheet. It creates a three-pixel activity signal, a polite live text label and an optional native progress control. Text and geometry require no downloaded image. Reduced Effects and the operating system's reduced-motion preference stop the animation while retaining the message.

`begin({ message, stage, progress, isCurrent })` returns a lease with `update`, `finish` and `clear`. Progress is either `null` or a real `{ completed, total, unit }` measurement. Unknown duration remains indeterminate. Terminal states are `ready`, `error`, `cancelled` and `detached`. A new lease, owner clear or disposal invalidates older DOM updates. Phase messages change the live text; numeric increments do not repeatedly announce the whole operation.

The presenter does not own tasks, storage, focus, cancellation or disabled controls. Each host keeps its existing operation identity and transaction boundary. A stale `finally` must not enable a newer operation's controls. Keep cancellation and navigation reachable. Do not make their containing dialog inert. Describe whether Cancel aborts an uncommitted candidate or merely stops waiting for shared/non-interruptible work. A detached save can reconcile its actual outcome through the same current lease; it cannot claim rollback.

Report an operation before its first delayed boundary. Keep the indicator beside its activating action or at the top of the current screen. A status below a long form does not acknowledge a visible action. Static direct-route feedback must exist before the main module runs. Main game boot also prepares styles after its independent initial loading card is present, and fails visibly if a required stylesheet cannot load.

## Existing integration boundaries

- Solo Deploy, saved-flight restoration, theme preparation and Retry retain their exact run/theme/generation guards. Foreground Start observes an existing picture prewarm promise. It must not restart download or decoding. Cosmetic craft/release decoration does not hold a playable run. Required-picture failure retains the original paused flight and explicit recovery actions.
- Content callbacks report download, verification, storage and readiness around existing authenticated-content coordinators. Presentation metadata stays outside campaign and simulation identities. A completed durable write remains authoritative even when its screen has closed.
- `prepareOffline` and `checkOffline` accept `signal` and `onStatus`. Aborting the signal detaches this observer, not the shared service-worker installation. The versioned progress protocol is bound to request, build and scope, while legacy clients retain terminal-only replies. Inactivity is distinguished from proven failure; Check progress rejoins existing work. A waiting update retains the close-tabs instruction. The ready marker still follows verified bytes.
- Studio, Library, backup and media editors use local operation owners. Save/import atomicity, revision checks, source bytes and separate draft storage remain unchanged. Native downloads describe a requested download, rather than claiming a file was saved.
- Music preparation appears in `snapshot().preparation` without altering `status`, `playing` or `desired`. Enable/play requests retain the original user gesture. Background cue decoding keeps the existing immediate fallback and never replays a late cue.
- Couch and Replay own their preparation and current-board identity. Embedded Playground readiness uses the child's actual boot/tool-ready marker, not the iframe load event. Controller Lab retains its authenticated session messages and neutral-input gate.

## Qualification for a changed entry point

Exercise real delayed success, cached success, failure and retry. Then cancel or navigate away, start a newer operation and let the old promise settle. Check current run/content/draft bytes, disabled controls, focus and status ownership. Non-interruptible saves and shared downloads need separate observed and durable outcomes. No artificial minimum delay is permitted.

Async fixtures should await the owned operation or use `game/test/helpers/wait-for.mjs` with the exact readiness predicate and a bounded elapsed-time allowance. A count of immediate callbacks does not bound Blob, WebCrypto, module loading or replay timer yields. Keep short drains only for known post-resolution microtasks; preserve runtime deadlines, cancellation and identity assertions. Retain scheduling failures and controlled reproductions alongside corrected runs.

Review 1280×800, 390×844 and 844×390, Large/Plain text, applicable 200% zoom and reduced motion. Use keyboard, touch and modeled controller checks without presenting them as physical-device evidence. Record initial visual failures as well as corrected retests. Source-only assertions cannot establish visibility or successful public play.

Later phases must add new entry points to the A01–A56 loading inventory and rerun affected lifecycle cases. They must also preserve the six source gates, ordinary build, offline/artifact budgets and immutable release workflow.

## References

Status text must expose an action's progress or outcome without moving focus; see [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) and the [ARIA25 technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA25). The shared label and separate native meter follow that distinction. The initial boot treatment addresses the stylesheet loading behavior described in [MDN's link reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link).
