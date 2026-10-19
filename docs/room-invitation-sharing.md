# F49 private-room invitation sharing

Status: developing. Draft for remote review and normal CI on exact captured main
`cdbda99ac881eb9cac62d536543d9078b92ac081`. This is the complete bounded
Copy/Share/QR implementation. The complete four-file component/room source
cohort now passes 108/108, including a correction for delayed-operation
keyboard focus verified in the real browser. The earlier 87/87 qualification
remains separate below. Full-source, package, OS sharing, QR scanning and device
acceptance remain pending; draft publication does not complete F49.

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
geometry and live English/Ukrainian node reuse. That historical run did not
qualify the later native room and accepted-snapshot cases.

The frozen nine-path predecessor manifest was
`182845e96750b71f3d00333e9db2d54137db8ad8b071fe77fbd3b0b3cf4fea49`.
During the subsequent disk hold, **27 additional component cases were authored
and published unrun** in draft PR1744. The original 21 cases remain byte-exact;
the expanded file registers 48 cases. Production files are unchanged from that
predecessor. The expansion changed only this receipt and
`game/test/room-invitation-actions.test.mjs`.

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

### First complete-cohort attempt: failed/incomplete

At published head `dcf62bb009c4e0fd7f8d5429b9131298c7e2dd2b`, manifest
`4325c41a1c955fe62b1058c104f836ccc89336e42566500c02b364612a02f802`, the
expanded component file passed **48/48**. The following complete client file
exited 1 with **0 passed, 0 assertion failures and 21 cancelled**. Its first case
awaited a binding fence that the fixture never reached; remaining cases were
cancelled by the parent test. Content and presentation files did not run because
the runner stopped on this failure. This is not a passing client or cohort run.

The new core-only fixture omitted the service-owned control protocol and
activation. Actual `poll()` correctly rejected it before recipe binding; the
fixture collected that protocol error and then awaited an unresolved fence.
The test-only correction adds those two modeled service fields to the
authoritative room **before its genuine snapshot and state identity are
created**. It also rejects the fence explicitly, with diagnostic error codes,
if polling completes before binding. No wire payload is forged after signing,
no runtime file changes, and no assertion or timeout is relaxed.

Both complete outputs were retained without filtering or truncation; stderr was
empty and no guard fired. Component stdout was 12,152 bytes, SHA256
`aeb29201f50e01cd26ad031116c99f7b18caeac76aa31b64f681835db5ede449`;
client stdout was 12,392 bytes, SHA256
`3738bbe0e81f2cef0a09fd074ce3d9d6e7cfa48bbdb1a160e786a8536178d37f`.

### Corrected complete cohort: 87/87 passed

The corrected source manifest
`3f199b97e4d3a96abce2553488c86ecbe96412e6d5907f2c711d6e9d3bf6f060`
passed all four complete files serially in four fresh Node 22.22.2 workers.
HEAD remained `dcf62bb009c4e0fd7f8d5429b9131298c7e2dd2b` with only the reviewed
13-line client-fixture correction modified. Head, the entire nine-path manifest
and that exact tracked status were identical before and after every file.

| Complete file                       | Passed | Wall seconds | Peak group RSS KiB | Full stdout bytes |
| ----------------------------------- | -----: | -----------: | -----------------: | ----------------: |
| `room-invitation-actions.test.mjs`  |  48/48 |        0.364 |            168,480 |            12,151 |
| `online-room-client.test.mjs`       |  21/21 |        0.391 |            177,584 |             5,180 |
| `online-room-content.test.mjs`      |    6/6 |        0.345 |            174,768 |             1,697 |
| `online-room-presentation.test.mjs` |  12/12 |        0.312 |            157,760 |             3,046 |

Every file exited 0, with zero skips, cancellations, stderr, truncation or guard
events. Guards were a 1,536 MiB heap, 2,048 MiB process-group RSS, 180 seconds
per file and a 2 GiB disk floor. This is a complete scoped cohort pass, not a
whole-project/full-source or package-build pass.

The full unfiltered corrected-run transcript, all four SHA-verified stdout and
stderr files, and per-file receipts are retained locally in the ignored
`.cache/improvements-evidence/2026-10-19/f49/` directory. The earlier failed-run
receipt and fingerprints remain separate from this passing run.

| Passing file                        | Source SHA256                                                      | Full stdout SHA256                                                 |
| ----------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `room-invitation-actions.test.mjs`  | `7eb64a6a1963ac4e6907614bd8a3dc9bd5108ad596c8fe56bc683277b12fcb3c` | `8fc41c9b62954e2443a8abcccaf9cc27d2e1ac11ec15e763e254426f4538087a` |
| `online-room-client.test.mjs`       | `7894b9134a9b4bb12e5036e0f8366348127af8b7342d60fd5d644331d4a4602c` | `e169fb777035c907e019b1dab4e2c8cf5d86afb7ae81bd1ad4a0f1845306a6fe` |
| `online-room-content.test.mjs`      | `199d111e64765797ccf57fd704e80ac3e73c0d8f1bc9827174d2e8737d442f85` | `0cf2cf3234da397f42c87929ddc9b973e655ee5319b20177a1fab5065ddb8468` |
| `online-room-presentation.test.mjs` | `6d325e60d595adb61aa2de073e839252ad752afcab91c31520842530435d5c47` | `e3a1c591c3dc32bcc9321635a23780e76dcbf861865d430602441ea489d7302a` |

Host cases use actual extracted page functions, the real room lifecycle and
recipe validation, and the existing native play shell. They do not substitute a
new routing or acceptance implementation. No existing test is removed or waived.
Clipboard and Share APIs are modeled; these tests do not operate the actual
system clipboard or an operating-system Share sheet.

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

Independent source review accepted the boundary for draft publication. The
scoped desktop Copy/QR/retirement and delayed-component focus evidence below
does not complete desktop/compact layout or controller acceptance. A real
clipboard permission-denial workflow, operating-system Share and cancellation, real QR scans,
iPhone/PWA and Steam Deck acceptance, full-source validation and built package
qualification remain pending. No hardware is currently available. No offline
or physical-device claim follows from modeled APIs or local source tests.

The original draft was published during a capacity guard hold after disk
pressure stopped another cohort. Safe cleanup later restored enough capacity
for the explicitly granted, bounded serial cohort above. No additional heavy
gate is inferred. Remote CI may establish independent qualification through
normal checks; no CI bypass or source/package pass is inferred from publishing
or updating the draft.

F49 remains developing until those acceptance boundaries are met; source tests
alone do not make the whole Phase 5 feature complete.

## Delayed-operation focus correction: 108/108 and scoped browser green

Actual desktop browser review at published
`e3e9b552a389b260374872894458f788564510da` confirmed Copy's clipboard
contents exactly matched the accepted invitation. The prior empty clipboard
was restored. Show QR displayed the local SVG, without a scan claim. Warm
keyboard Hide/Show and a fresh document keyboard activation retained focus,
so the initial pointer-only BODY observation was not treated as a general
keyboard defect.

A separate ignored real-DOM page imported the exact committed component and
real QR encoder through its existing factory option, with a two-second Promise
delay and fictitious invitation pins. Native Tab/Enter activated Show QR without
further input. Disabling that focused native button moved focus to BODY while
pending and at settlement. The passive snapshots and root screenshot
`f49-deferred-qr-keyboard-focus-red.png` establish that narrow delayed-work bug.
The page is outside the game build inputs and is not product source.

The correction uses native disabled only while the invitation is unavailable.
Pending valid actions remain focusable with `aria-disabled=true` and existing
`aria-busy`; each existing handler still refuses duplicate or cross-action work
until the current request settles. The existing disabled appearance covers the
ARIA state. No completion calls focus or stores a new focus owner, so settlement
cannot reclaim focus after the player navigates elsewhere.

The component fixture adds an opt-in, local disabled-property boundary that
blurs only its focused native button. Before changing production, all 21 new
deferred focus cases failed their retained-focus assertion against the exact
published action source (0 pass / 21 assertion failures; no cancellations or
skips). These cases cover QR and Clipboard success/failure, Share success,
failure and cancellation, each with retained focus, moved focus, and retired
then reopened presentation. This models the independently observed real DOM
behavior; it changes no shared DOM helper. Existing locale-refresh assertions
now check the intended ARIA lock while keeping the native button focusable.
The original 87/87 result remains historical, not a qualification for the
correction. The first corrected complete four-file run at source manifest
`096e04d3334b3f001c7df7a9c5f4c26fdc169837f15203f68e41a1695e63c017`
passed 106/108: component 69/69, client 21/21, content 6/6, presentation 10/12.
The two presentation failures were the shared-body assertion expecting native
`disabled=true` while pending after Settings/Back. That assertion was updated
to native `false` plus `aria-disabled=true`, retaining the subsequent actual
click, one-request counter, Ready/Pause counters and stale feedback/image
assertions. Settlement must clear the ARIA lock. No assertion about duplicate
work or game ownership was removed; no runtime change followed that run.
There were no guards, stderr, truncation, skipped/cancelled cases or source
drift. The successor complete cohort passed **108/108** at frozen source and
tracked-status manifest
`87ec6f0b0444905f584125a6c44327b476fd895d8aa5d4ccbe869209bf7344da`.
HEAD remained `e3e9b552a389b260374872894458f788564510da` with exactly the five
reviewed correction paths modified, identical before and after every file.
The whole nine-path content manifest was
`ced2761f37e47521af3312c354a5d5e53518f7c3f8afceeb70004ed69e8a21b6`.
This final receipt is a documentation-only successor; all eight nondoc PR files
remain exactly the passing source.

| Complete file                       | Passed | Wall seconds | Peak group RSS KiB | Full stdout bytes |
| ----------------------------------- | -----: | -----------: | -----------------: | ----------------: |
| `room-invitation-actions.test.mjs`  |  69/69 |        0.331 |            149,168 |            16,707 |
| `online-room-client.test.mjs`       |  21/21 |        0.335 |            146,128 |             5,179 |
| `online-room-content.test.mjs`      |    6/6 |        0.289 |            163,344 |             1,697 |
| `online-room-presentation.test.mjs` |  12/12 |        0.282 |            157,184 |             3,040 |

All four fresh Node 22.22.2 workers exited 0, with zero skips, cancellations,
stderr, truncation, guards or source drift. The same 1,536 MiB heap, 2,048 MiB
process-group RSS, 180-second and 2 GiB floor guards applied. Full unfiltered
per-file stdout/stderr and `focus-corrected-cohort.json` remain in the ignored
F49 evidence directory; the failed 106/108 run remains separately retained.
Stdout SHA256, in table order:

- `165a28fdfec82b70cb21e9d3e30aa9727fcc3d3a854be512335cd53a2f472af4`
- `4c9121df3bc64f940c22227fb9f15f56b5333bc5532a8138bf99effc15661a1d`
- `3595e4354009fab960cfb08e89d09f0f224ee8474e2d7f6f9afc56be5380fb54`
- `6ccace7e3ac98f1b85c6e984052c4905b2d6c1fc075d789effbc3763e282841e`

Root then opened a separately versioned ignored probe whose direct component
module response matched action source SHA256
`ebb1835b98ce16b34446b675c78635e256b8fc5c656623925be1941c1332ccb9`.
The unchanged original RED page and screenshot remain separate. Native Tab and
Enter activated Show QR; no further focus action or click occurred. Focus stayed
on `invite-qr` at 50, 500 and 1,500 ms and after the full two-second operation
settled. Native disabled remained false; `aria-disabled` was true while pending
and false after completion; expanded became true. The screenshot
`f49-deferred-qr-keyboard-focus-green.png` records this scope. The original
ordinary-reload probe had reused the older module instance and is not treated
as a result for the corrected source. No product cache policy changed.

This is real browser acceptance of the delayed component focus boundary, not
full Ukrainian host, OS Share/cancellation, QR scanning or device acceptance.
The real-game English observations below retain their predecessor source
scope. No whole-project/build pass follows from the 108-case cohort.

Actual predecessor Back/Home/Settings/mission navigation retired the prepared
QR. One Home Continue action legitimately armed the only seat; that room was
immediately left. No second seat or gameplay was exercised. An actual Share
request remained pending while native Escape returned to Home and then the
mission menu; this is not proof of operating-system cancellation. OS controls
were unavailable to the browser tool. Public Leave cleaned the room. No
messages were sent; actual OS sharing/cancellation, QR scanning, physical
devices, latest-main integration, and full source/package gates remain pending.
