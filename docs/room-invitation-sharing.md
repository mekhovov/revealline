# F49 private-room invitation sharing

Status: developing. Draft for remote review and normal CI on exact captured main
`cdbda99ac881eb9cac62d536543d9078b92ac081`. This is the complete bounded
Copy/Share/QR implementation; native room qualification and actual browser and
device acceptance remain pending. Draft publication does not establish those
qualifications or complete F49.

## Player benefit and boundary

Private rooms currently expose a read-only invitation field. This change adds
Copy invitation, Share invitation, and an optional local QR image beside that
same accepted invitation. Players without a usable clipboard API can select the
field and use their device's Copy action. Unsupported or cancelled sharing
leaves the invitation available.

The existing host still owns room creation, invitation validity and expiry,
snapshot acceptance, seat credentials, Ready, play, pause, reconnection and
results. Invalid or expired incoming invitations keep the existing validation
and recovery notices. This change adds no room service, persistence, analytics,
network requests, permission prompt on entry, QR service or dependency.

Only a full accepted snapshot may publish an invitation. The existing immutable
content pin and public invitation key are retained; the service endpoint, seat
token, registry data and arbitrary query parameters are not invitation data.
The new view receives the canonical URL, not credentials. Its validator rejects
credentials, non-HTTP(S) URLs, unknown or duplicated invitation parameters, and
missing content pins. The invite link is intentionally shareable: this feature
does not change the room's existing authorization or security model.

## Behavior and ownership

- Clipboard success is announced only after `writeText()` resolves. Rejection
  offers an explicit selection action without moving focus after the user has
  moved elsewhere. When the API is absent or the context is insecure, the
  original click can select the field directly. No legacy clipboard command is
  attempted.
- Native Share is called synchronously from the button's handler, before its
  first await, on the original receiver. A supported `canShare()` check is
  synchronous. Success means the share request completed, not that a recipient
  received or joined the room. `AbortError` produces a neutral cancellation
  message; other failures offer Copy or QR, without an automatic clipboard
  write or second share sheet.
- QR generation uses the already shipped Nayuki vendor locally, with medium
  error correction and a four-module quiet zone. The image is numeric SVG
  geometry with no external images, metadata or executable payload. A link
  remains available beside it. Generation and SVG structure checks do not prove
  a real device can scan the displayed image.
- A pending operating-system operation retains its single owner until it
  settles. Room replacement, leaving, unavailability, hidden-document events,
  pagehide and committed menu changes retire its presentation generation.
  Going away and returning before completion cannot display an old success or
  QR, or open a second share sheet. Ordinary polls with the identical accepted
  URL preserve the current prepared image.
- The existing native play shell owns menu visibility. The room UI forwards an
  optional notification from that committed owner; it adds no second surface
  store, route, observer or input listener. Existing controller navigation sees
  the native buttons in its current dialog. Focus does not start or resume play.
- English and Ukrainian labels use the existing localized binding API, retain
  node identity and update the existing polite status region.

## Source and future integration

The bounded nine paths are:

| Path                                          | Purpose                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `game/online/room-invitation-actions.mjs`     | Localized actions, truthful outcomes, request owners and retirement                 |
| `game/online/room-invitation-qr.mjs`          | Canonical invitation admission and local QR geometry                                |
| `game/online/rooms.mjs`                       | Existing acceptance, leave/unavailability and page lifecycle owners                 |
| `game/online/room-ui.mjs`                     | Optional forwarding of the existing committed surface notification                  |
| `game/online/rooms.css`                       | Wrapping action row, bounded QR width and wrapping status copy                      |
| `game/test/room-invitation-actions.test.mjs`  | Complete component/security/local-QR cases                                          |
| `game/test/online-room-client.test.mjs`       | Actual page acceptance and ownership functions with real recipe/snapshot validation |
| `game/test/online-room-presentation.test.mjs` | Actual native shell composition and preserved audio cases                           |
| `docs/room-invitation-sharing.md`             | This qualification receipt                                                          |

The independently published Rooms support adapter PR1734 adds its own
`supportSummary?.invalidate()` notification at the same shell hook. Future
integration must retain both callbacks, not replace either host's file or
private state. The root compatibility slice changes only the existing text-size
option labels by value in `room-ui.mjs`; this implementation preserves those
future additions as a separate union. Neither draft is inherited into this
independent captured-main branch.

The existing complete `online-room-content.test.mjs` is unchanged and remains
part of the planned qualification cohort. No catalog, localization bundle,
package closure, transport protocol or save schema changes are needed.

## Verification so far

The initial complete component/real-local-QR file passed **21/21**, exit 0, with
zero skips, cancellation or guard events. It ran in a fresh Node 22.22.2 worker
with a 512 MiB heap, 768 MiB process-group RSS limit, 60-second wall limit and
2 GiB disk floor. Observed wall time was 0.378 seconds, peak group RSS
174,256 KiB, full stdout 5,030 bytes and stderr 0 bytes. All three source/test
files were unchanged before and after.

| Passing file                                 | SHA256 at that run                                                 |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `game/online/room-invitation-actions.mjs`    | `af162237dbae647aaf323444de22f7d248e811eb6132560078f80a4223b55b4c` |
| `game/online/room-invitation-qr.mjs`         | `807ef6a6cc0b240fb7f75eef1cdabc9d353788cb857a1f544ebbd0cd45dc3cde` |
| `game/test/room-invitation-actions.test.mjs` | `7d5c752da64c06c0d7a2dda901ccee3b05839d3c452e4cd656e45ab83b51cb1f` |

That run covers direct receiver/gesture timing, success settlement, manual and
denied clipboard paths, explicit retry, cancelled/unsupported/failed sharing,
single-owner away/back, replacement/hidden/leave/dispose retirement, real QR
geometry and live English/Ukrainian node reuse. It does not qualify the newly
authored native room and accepted-snapshot cases, which have not run yet.

The frozen nine-path predecessor manifest was
`182845e96750b71f3d00333e9db2d54137db8ad8b071fe77fbd3b0b3cf4fea49`.
During the subsequent disk hold, **27 additional component cases were authored
and remain unrun**. The original 21 cases are retained; the successor file's
expected registration total is 48, not an executed pass count. Production files
are unchanged from that predecessor. The successor changes only this receipt
and `game/test/room-invitation-actions.test.mjs`.

The additions cover two unchanged-poll cases that count status and QR-caption
text writes and preserve their owned text nodes; twenty deferred Share/Clipboard
outcomes across hidden/return, persisted pagehide/return, nonpersisted pagehide
and disposal; and five current-request outcomes across live locale refresh.
They assert no stale feedback, QR, extra operation, manual-selection state or
focus movement, including locale refresh of retained detached controls. The
pagehide composition executes the existing pagehide/pageshow callbacks from
`rooms.mjs` with the actual component and substitutes only unrelated room
services. It does not pretend the component owns those window events. Modeled
DOM text-write counts do not establish real assistive-technology behavior.

Planned complete source cohort, after independent review and a serialized native
test slot: the new component file plus all of `online-room-client.test.mjs`,
`online-room-content.test.mjs`, and `online-room-presentation.test.mjs`. New host
cases use actual extracted page functions, the real room lifecycle and recipe
validation, and the existing native play shell. They do not substitute a new
routing or acceptance implementation. No existing test is removed or waived.

## Primary guidance

- [W3C Web Share](https://www.w3.org/TR/web-share/): transient user activation,
  synchronous capability checks, cancellation and the limits of successful
  share-request resolution inform the direct-gesture and truthful-copy design.
- [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)
  and [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API):
  secure-context restrictions, permission failures and asynchronous completion
  inform the success and manual-copy paths.
- [Nayuki QR generator](https://www.nayuki.io/page/qr-code-generator-library) and
  [QR API documentation](https://www.nayuki.io/res/qr-code-generator-library/javadoc/io/nayuki/qrcodegen/QrCode.html):
  the existing dependency provides local encoding; the implementation retains
  a four-module quiet zone. No replacement library or external image service
  is introduced.

## Remaining gates

Independent source review accepted the boundary for draft publication; the
complete native cohort is pending. Actual
desktop and compact browser layout/focus/controller checks, a real clipboard
permission workflow, operating-system Share and cancellation, real QR scans,
iPhone/PWA and Steam Deck acceptance, full-source validation and built package
qualification remain pending. No hardware is currently available. No offline
or physical-device claim follows from modeled APIs or local source tests.

The local native/heavy test slot remains on a capacity guard hold after disk
pressure stopped another cohort. No local expanded component, client, content,
presentation or native run is claimed for this draft. Remote CI may establish
independent qualification through normal checks; no CI bypass or source/package
pass is inferred from publishing it.

F49 remains developing until those acceptance boundaries are met; source tests
alone do not make the whole Phase 5 feature complete.
