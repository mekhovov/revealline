# Personal-best ghost access in Settings

The existing personal-best button belongs to the flight-preferences container,
which the shared Settings action moves into its native dialog. Opening Settings
also explicitly hid that button; closing Settings revealed it only after moving
the container back under the closed legacy flight dialog.

The focused correction removes those two visibility assignments. Settings now
exposes the same native button beside the existing flight preferences. Its ID,
handler, EN/UK labels, availability/disabled state, aria-pressed state and
described-by references are unchanged. Loading/cancellation, exact personal-best
selection, physics, scoring and deliberate arming are unchanged.

Source impact: world-app.mjs is 63 bytes smaller; no source-file count or limit
changes. On the previously admitted combined Library/menu/focus baseline this
projects 615 bytes remaining, or 236 bytes after the separate 379-byte warm-frame
candidate. These are projections until an exact combined admission is produced.

## Qualification still required

Use an actual verified native practice record to check visible Settings access,
pointer and keyboard Show/Hide, preserved personal-best identity/pose, paused
state and deliberate resume. Check unavailable/no-record and replay states,
EN/UK, narrow Settings, repeated open/close, and unchanged ordinary controls.
Retain the existing FPV overlap rule: the coincident ghost body is hidden in FPV
and visible from Chase. This access fix does not change that rendering rule.

No browser or release acceptance is claimed by this draft checkpoint. The
implementation is isolated from the ready Library and evidence PRs.
