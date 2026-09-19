# Solo flight information ownership

The Solo host owns one `attachFlightInformation` instance for its existing `run-message` element. `readFlightInformation(element)` returns a read-only projection for the Details presenter and future compact HUD; it never changes the simulation, scoring, saves, media identity, input or focus. The Pause menu has an explicit Field details dialog. Existing live field cues and action controls remain intact; compact HUD replacement is not yet qualified. Versus/Team adoption and responsive visual acceptance remain separate work.

## Identity and observation

- Accepted fresh/prepared attempts and verified restores each receive a new presentation generation. Reusing a saved run ID never reuses that generation. Staged destination runs are not adopted early.
- Snapshot fields come from the engine and its existing Classic/encounter view projections. Historical warning/event urgency does not establish current field safety; unknown facts/events remain explicitly unknown.
- Each fixed-step `eventFeedback` call observes the original ordered events and the actual warning calls. `sound.event` remains first, followed by the existing action/theme/message work, then `painter.effectsFor`. A failed or superseded batch cannot publish partial data under a new owner.
- Caption admission occurs before the existing text/cue/deadline writes. An older event callback cannot overwrite a replacement attempt's caption even when it reenters a real run replacement.
- Terminal success/failure captions follow the batch and remain the final visible caption. Reading historical batches cannot rewind the current warning.

## Asynchronous completion

Capture `captureWarning(role, options)` before beginning run/result asynchronous work. Its returned function can write only while the same generation and warning sequence remain current. Existing cancellation, media identity, dialog, operation and request guards remain in place; the caption token supplements them.

Story, chapter, music, picture, restore and replay paths use captured authority. Picture failure receives its captured notifier from the caller; it must not mint a new token after a failed await. A deliberate locked-map fallback can capture new authority only immediately after its accepted replacement. Result operations may explicitly use `allowTerminal: true`: valid post-win story/export failures stay readable, while an earlier operation's token cannot replace a later terminal warning.

Persistent chapter-storage reconciliation and native lifecycle registration are global system notices (`host.storage` and `host.lifecycle`). Their existing feedback remains live across run replacement and can still replace a caption; they are deliberately **not** represented as fenced run-owned completions. A future HUD must preserve these notices rather than treating them as obsolete game events. Other unmapped synchronous notices retain `host.unknown` until explicitly classified.

`captionUntil` retains the existing simulation-time-plus-five metadata. The host does not currently use it to remove text, so this integration adds no expiration timer or real-time timeout.

## Lifecycle and evidence

`pagehide` suspends observation and invalidates captured sequence tokens. A persisted `pageshow` restores observation of the retained owner and remains paused; it is not a Resume command. Final departure disposes the bridge and removes the element's read-only registration.

`flight-information-host.test.mjs` mounts the real app through the ordinary Solo harness. It covers accepted setup, same-ID restore/replay identity, legal won/lost event batches, late preview failures, reentrant replacement, terminal captions and BFCache. `solo-result-continuation-host.test.mjs` checks that pending/cancelled/failed destination preparation retains the old information owner, while accepted Next changes it. The typed-source/bridge suites cover projection and token cases independently. DOM, Phaser, audio and storage boundaries remain modeled; these tests do not establish actual browser layout, physical controller/touch operation, audible quality or public release acceptance.


## Paused Field details

Choose **Pause → Field details → Read field details**. The host invokes its actual pause and input-clear paths; the dialog registers with the existing modal/navigation owner and finite reading surfaces. Read/Done, keyboard Back/Escape and controller Back use the ordinary reader ownership. Leaving the reader keeps its dialog open; leaving the dialog returns to its current, visible opener and **never resumes**. Explicit Resume continues the preserved direction/queued turn. Touch uses the same Read/Done/Back controls with at least 44px targets.

The paused snapshot keeps the exact current caption, required-objective progress, authored coverage target, Classic summary, typed actor/line/pressure/erosion facts, lane phase/clock information, full encounter instruction/release-cut progress, contact pickups and active effects. Manual actions come from the host's existing capabilities and supply/hangar conditions. Arcade never gains a universal equipment toolbar from this view. Current threats are recomputed from the source; historical notices do not revive ended threats or prove safety. Unknown projection issues/events remain explicit. This is English player copy; Ukrainian visual themes do not establish full localization.

Content is frozen for an open reading visit so late notices cannot replace text or steal its reading position. Close and reopen to refresh. Routine source updates never open Details, pause, move focus or change the arena. Accepted run replacement retires an old visit; suspension closes it without deferred focus return; final departure disposes it. Nested dialogs, newly accepted owners, backgrounding and queued close events cannot reclaim focus.

The host captures accepted warning observations and complete nonempty batches synchronously, before a later fixed step can replace `lastBatch`. The read-only projection exposes `recentNotices`, `recentBatches` and omission counts. Each queue holds at most 16 entries; their JSON text is bounded to 32,768 and 65,536 UTF-16 code units respectively. Oversized/older entries are omitted explicitly, while the current `lastWarning.fullText` remains intact. Adoption, including a same-ID restore, resets recent context. History is not a complete flight log or a scoring/replay authority. Caption expiry remains metadata, not a new timer.

`flight-information-details-host.test.mjs` mounts the actual Solo entry and tests both steering modes, the genuine reader/navigation lifecycle, modeled controller traversal, unchanged saved replay/checkpoint, current/stale asynchronous notices, bounded history, several engine steps before rendering, Classic and encounter facts, owner replacement and BFCache/disposal. Ordinary controls, the wide arena, collision and reward authority remain unchanged. These modeled tests do not certify actual font/scroll geometry, real touch/controller hardware, or responsive native presentation.

## Remaining compact-HUD integration

The R7 prototype is a study, not a production layout. Keep all three of its intentionally false integration/measurement gates false. Its hide-all CSS, message-only reducer, hardcoded two-scenario rows and fixed board aspect must not replace the live game. Next, define full simultaneous-threat/reaction cohorts, account for every authored action and unknown fallback, and measure the real board, counters, fonts, locale, 44px controls and focus outline. Allocate stable space before flight or on explicit viewport/font/input changes; ordinary warning/countdown changes must not resize the arena. Admit a compact replacement only when all current critical facts and controls remain represented, with the full Details path reachable by keyboard/controller/touch. Versus, Team, physical devices, production fingerprint/build and public release gates remain separate.


### Details reading order and short-screen allocation

Keep the native order **Read → text → Done → Back**. Done is directly after the text in the same unit. The existing shared navigation preserves reading only for this adjacent pair: Tab from text to Done and Shift+Tab back keep Read checked and Done enabled; Tab onward from Done reaches Back and ends reading. Do not change the shared navigation to compensate for a misordered surface. Zero required objectives omit only that Details row; missing objective data stays explicit, and live HUD cues remain intact.

The dialog uses a bounded flex column with unchanged font sizes, a reader that receives remaining height and a shared Done/Back footer. Outer scrolling remains a fallback instead of clipping content or shrinking text. Explicitly opening a new visit resets the dialog scroll to its heading; ordinary updates never reset an active reader. Actual 600×400, portrait/landscape and Large/Plain geometry still requires native inspection, independent of mounted navigation checks.

### Backup replacement retains the installed Details owner

The Details presenter is installed once for the page lifetime. Backup import and Undo reset their operation flags only; neither may clear the presenter reference. A fresh or restored run is reconciled through its accepted generation. Test successful import, Undo, failed import, persisted pagehide/pageshow, and final pagehide through the actual application; both page lifecycles must retain their existing pause and disposal contracts.
