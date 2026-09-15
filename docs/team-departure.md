# Team departure confirmation

This P03-I candidate guards explicit loss of an unfinished Relay Rescue attempt.
Change setup, Retry same arena and both header links ask for a separate discard
choice while the attempt is running or paused, including a stopped arena error.
Stay is the default. Team progress is held only in this page and is not saved.
Completed or lost attempts and the initial setup keep their direct actions.

The confirmation uses fixed action kinds and own routes. It accepts no supplied
URL, referrer or arbitrary callback. Back to Solo keeps the existing bounded
return context; the receiving Solo page still validates and consumes its own
bookmark. Team does not consume that bookmark or turn it into a saved Team run.
The brand link remains a fixed Solo destination. Modified clicks that open
another tab retain native behavior.

Opening the prompt pauses and releases input through the existing Team core and
host. This intentionally stops directions, held Support and an active rescue;
new directions are required after a separate Resume. Stay preserves the paused
arena, time, territory, reserves and objectives. A visible Retry/Change setup
opener regains focus; header departure cancellation returns to the paused panel's
safe primary. A stopped arena error returns to visible Retry and does not promise
that Resume is available.

Confirmed setup clears the attempt and exposes setup without starting. Confirmed
Retry uses the captured attempt's actual level, seed, difficulty and cooperation
configuration, independently of mutable setup controls. A fresh core is validated
before replacing the old reference. The authored starting level is captured
separately because the core adds live threat state to its level enemies. A
rendering failure cancels any pending decision without repainting, releases
controls and shows a stopped attempt with Retry available and Resume hidden. A
failure before replacement retains the old attempt; a failure painting an
explicitly approved fresh attempt stops that new attempt. A pending request cannot queue a second
choice; lifecycle suspension or a changed owner cancels destructive intent.
Returning to the page does not retry, leave or Resume automatically.

The short native alert dialog owns its focus and inert background. Shared menu
navigation uses the dialog root and Stay default. Its local Escape propagation
exception permits the native cancel event without changing global flight Escape.
Back/Menu choose Stay, and held/repeated input cannot confirm a new prompt. Help,
reading and control-editor Back behavior remains separate outside the prompt.
The Team-only CSS uses the existing Field Kit tokens, content-bounded viewport
scrolling and 50px action targets; it does not import the Solo full-screen layout.

Pack reading remains a setup operation. Existing cancellation and request guards
reject late file adoption after Start or departure. No profile, progress,
IndexedDB assignment, replay, co-op level or ruleset format changes are included.
Existing preference persistence is independent of this attempt-loss decision.

The four complete affected test files pass on Node 20.19.5 and 22.22.2: 61 Team
host cases plus 91 shared navigation, couch-input and co-op input-policy cases,
152 per runtime. The host uses the real core and painter-command stream behind
modeled DOM/Canvas boundaries. It checks both-player paused continuity, fresh
Retry equality, fixed routes, stale decisions, native-event propagation and
injected rendering faults. The [source and native record](verification/cross-mode/p03-i/README.md)
retains the failed recipe/fault attempts and corrected test timing separately.

Root's desktop native check at 1393 × 1348 observed a Relay Yard attempt paused
at 0:08, Stay/Escape preservation, Tab wrapping and 50px actions; explicit Retry
reset to 0:00. Confirmed Change setup did not start another attempt. Header
pointer requests with keyboard confirmation reached the actual Solo title and
Versus lobby. Paused header links still lie outside the keyboard navigation
root: an attempted header Enter returned focus to Resume. In-panel mode actions
with keyboard/controller parity remain later P03 work; widening the current root
is not part of this patch.

The native record contains 21 observations and two original JPEGs, and explicitly
corrects two intended-action labels that did not describe what happened. It does
not establish native fault recovery, held-controller behavior, imported-pack or
nonzero-territory preservation, portrait/short-landscape layout, zoom, physical
touch/controllers, browser chrome navigation, tab closure, reload durability or
offline/public acceptance. This does not complete P03, add a version or publish a
release.
