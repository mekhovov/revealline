# Direct Team difficulty recovery

Recovered from closed PR #756, commit
`8891f8927a5fe277cc6fc890d4ef4e4341619aa9`, onto main
`1ea63c0f273473d144ad7147060821895d1d9027`.

After a terminal Team failure, Retry remains the focused primary action.
**Change difficulty** returns to the same arena and opens Settings → Gameplay,
with **Arena & team options** expanded and the difficulty selector focused when enabled and visible. It does
not change difficulty or begin another attempt. An unavailable selector uses
the existing primary-action fallback.

Pause and victory retain **Change setup**. Running and paused attempts keep
their discard confirmation, saved-checkpoint handling and explicit Resume
behavior. The handoff retains foreground, generation and focus ownership:
newer user input or lifecycle changes prevent stale focus reclamation.

The original PR's historical test results are not current-source proof. The
recovered terminal-loss regression covers the real host and keyboard traversal;
physical controller, touch and public-browser acceptance remain separate.
Production records, compiled assets, saves and recipe fingerprints are unchanged.
