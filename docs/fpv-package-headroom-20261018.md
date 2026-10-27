# Bundled Academy package headroom

Qualified source: `7f38f550e5f67278aea5fa8d1f3aad1b059caa0c`, 18 October 2026.
Status: implemented, independently reviewed and locally accepted; not published.

The default distribution builder now applies its existing lexical indentation
projection to `optional-practice/civilian-fpv/sim-presentation.mjs`. The readable
source file is unchanged. Only spaces and tabs outside lexical ranges are
compacted in the bundled distribution copy. There is no new runtime decoder,
dependency, asset removal or budget increase.

Preservation checks compare the exact syntax tree, tokens, comments, newlines and
embedded asset payloads. Decoded assets retain their declared byte lengths and
SHA-256 hashes. A second projection is a no-op. Physics, controller, catalog,
recording, demonstrations and vendor inputs remain byte-exact. Offline pins are
generated from the final projected bytes. Source formatting and diagnostic
columns are not an identity guarantee; the projection does not preserve a
function's original source indentation.

## Measured result

[Committed-source measurement](fpv-package-headroom-qualification-20261018.json):

| Boundary                      | Result                                    |
| ----------------------------- | ----------------------------------------- |
| Bundled Academy               | 13,054,400 / 13,107,200 bytes             |
| Remaining bundled budget      | 52,800 bytes, previously 261              |
| Exact reduction               | 52,539 bytes                              |
| Bundled files                 | 138, unchanged                            |
| Original Academy input margin | 24,478 bytes, unchanged                   |
| Selected source file slots    | Academy 151/151; World 211/211, unchanged |
| Focused preservation checks   | 9/9 pass                                  |
| Package checks                | 19/19 pass; zero failures or skips        |

Standalone World and simulator-only native measurements remain unchanged. The
source file limits are still full. This creates byte headroom, not permission to
add unbounded dependencies or evidence of native-device operation.

## Rendered packaged acceptance

The actual 138-file emitted bundled Academy was served on an isolated local
origin at `127.0.0.1:8872` from 22:13–22:16 CEST. This was the projected package,
not a source-preview fallback. All emitted files were checked against the
measurement's final hashes and byte counts before serving.

- Password unlock, shared typography, themed controls, the fifteen-aircraft
  picker, Meteor75 geometry description, native Actual controls and camera
  framing preview rendered successfully.
- A Meteor75 draft entered practice with motors off and waited for Arm. A short
  keyboard throttle test lifted it, then reached the course's 10 m ceiling.
  Deliberate pause/resume worked and the attempt stopped at 9.82 seconds. This
  overshoot is retained as a limited package smoke observation; it is not hover
  tuning, a completed lesson, a measured throttle-preservation assertion or a
  sustained-flight qualification.
- The durable 5.00-second checkpoint restored while remaining paused. The split
  panel explicitly discarded unavailable earlier history. The existing recovery
  result translated English → Ukrainian → English without repeating recovery or
  advancing flight.
- Browser diagnostics reported no captured errors or warnings. Audio remained
  off; audible playback was not tested. No offline-network or native-device
  claim follows from this browser check.
- English and the original `My drone` / `Legacy feel` draft were restored, with
  zero changes. No setup was saved and no archive was deleted. The temporary tab
  and local server were closed; the user's public tab remained open.

Local screenshots are retained in the task's visualization directory as
`packaged-academy-camera.png` and `packaged-academy-recovery-uk.png`.
