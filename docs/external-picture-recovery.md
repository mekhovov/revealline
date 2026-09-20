# Retained-picture chapter recovery

Candidate core, host and player integration. Not yet an accepted public release.
The v0.68.2 public check found External Pressure Pictures refusing a retained
picture assignment. Existing media and the paused flight remained unchanged.

## Contract

An imported chapter retains exact authored original revisions. A player may already
have a different current assignment for the same map identity. The original default
and the current assignment are separate records: external authored-picture lookup
already pins originals independently, while earned and saved pins remain unchanged.

The default installer still refuses a conflicting assignment before journal writes.
Its structured `RetainedPictureAssignmentConflict` carries a bounded display list
and an opaque, single-use review. Explicitly passing that same object as
`pictureReview` authorizes keeping current assignments while installing originals.
It never authorizes replacing a picture, changing gameplay or resuming a flight.

The review binds the managed store, profile/pack channel, exact descriptor, media
generation and canonical before-state hash. Copies, foreign managers and changed
generations refuse without writes. It is consumed when checked; retry after a
failure needs a fresh review. Temporary installer disposal in the host does not
discard a still-valid review belonging to its same borrowed managed store.

Confirmed installs write `revealline-external-chapter-install.v2` with the sole
`preserve-retained` assignment policy. Its before/after hashes and generations
remain mandatory across both databases. Every required original revision, bytes,
owner and descriptor still must match. Recovery reproduces the exact journal
proposal; it never overwrites newer media. Ordinary installs keep writing v1,
and v1 recovery remains unchanged. Older clients must retain an unknown v2 journal
for recovery in the newer edition, never reinterpret or clear it.

## Verification so far

The original 16-test installer file passed before modification on Node20.19.5.
The expanded installer passed22/22 and the actual v4 host passed24/24. These include
original byte retention, stale/foreign review refusal, each confirmed publication
interruption, shared-manager lifetime and authored-original/current-assignment
separation. The final combined installer/host run, including two malformed-policy/version
cases, passed 48/48 on Node 22.22.2 (221,607.675 ms; no failures or skips). Sparse setup initially
lacked script imports and owned MP3/video fixtures; exact tracked inputs were
restored without altering production guards.

## Player integration and remaining release checks

1. Implemented: an inline, focusable conflict review in More worlds with Cancel and explicit
   “Install originals; keep my pictures.” Show which choices are retained.
2. Implemented: pass only its actual review through the source-upload or download callback into
   the app and host. Ordinary Play/Retry must never reuse it automatically.
3. Implemented: Cancel, dialog close, changed files and superseded work discard pending review.
   Changed media requires a new review; stale completion cannot move focus.
4. Implemented: a confirmed install does not auto-play. Keep the paused run and restore focus to
   the chapter's Play action when ready. Report completed installation truthfully
   even if later catalog refresh fails.
5. Implemented: skip fresh Field Kit assignment replacement on this path; retained choices remain
   deliberate. Do not falsely report that custom pictures became the chapter's
   authored originals or that their prior saved/earned pins changed.
6. Remaining: verify keyboard/controller/touch navigation, current flight preservation, actual
   browser originals and cancellation, then final-source gates and immutable release.

The two stores still use their existing journal/CAS protocol rather than implying
a single transaction spans databases. [MDN transaction lifecycle guidance](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction)
informs the boundary: do not keep an IndexedDB transaction open across a player
dialog or unrelated asynchronous work. The review precedes the later checked commit.


The focused player-panel cohort passes 14/14 on Node 22.22.2. It exercises upload,
download/install and download/play entry points, explicit confirmation without
launch, Cancel/close/file-change/Refresh invalidation, late refusals, late readiness
and truthful committed-install feedback. The actual Solo host's focused retained-
picture test passes, retaining the exact paused checkpoint and complete prior
assignment/presentation arrays. The complete affected app/panel regression passed 35/35 on Node 22.22.2
(176,684.402291 ms; no failures/skips). Final player-readable map labels then passed
the overlapping complete 14-test panel file. [Original logs and scope](verification/external-picture-recovery/qualification-scope.json)
remain distinct from full-source and browser/controller/touch acceptance.

The first panel run hit missing sparse helper imports; the first app run lacked the
tracked motion preset JSON. Exact originals were restored. One new assertion used
a Choose ID for the existing shared Download/Play action; its selector was corrected
without changing behavior assertions. Retain these setup/assertion failures apart
from product results.

The inline review uses a visible Cancel action, restores focus to its opener on
cancellation and to Play/Choose after success, and does not steal focus after newer
navigation. These decisions follow the [W3C dialog focus guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
