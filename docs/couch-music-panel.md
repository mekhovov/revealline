# Shared music panel: adoption and session integration

P02-B's adapter preserves the Solo default and is now composed into Team and Versus by [the shared music host](couch-music-host.md). This guide describes panel ownership; the host guide records the current integration and its remaining qualification limits.

## Supported host hooks

`attachSoundtrackPanel` now accepts:

- `adoptLibrary(snapshot)`: replaces the default `player.setLibrary(snapshot.library)` step. Pass a validated store-read or completed prepared-commit snapshot, including every asset. The panel awaits the hook, then calls the existing `onLibrary(library, snapshot)` notification. The default still installs metadata and sends the notification as before. A post-adoption notification alone is not a safe stale-adoption guard.
- `musicSession`: routes the panel's explicit Play and Pause buttons through the supplied session's `play/pause`. Other player functions remain on the same existing player. Temporary audition pauses/restoration deliberately bypass this explicit-choice hook; they must not be mistaken for the user's persistent session choice to stop music.
- Returned `element` and `isOpen()`: expose the exact dialog and current lifetime to the host's keyboard/controller/modal owner. These handles do not implement focus routing or gameplay pause themselves.

For Couch, `owner.adoptVerifiedSnapshot(snapshot)` is the synchronous admission boundary. It accepts only output from the existing validated managed store or prepared-library commit, not raw uploaded data. It installs owned bytes before player metadata, fences older boot reads, rejects an older snapshot, and refuses admission while its own save is pending or after close. It does not write storage or invoke Play. Host code must keep store operations on the same story-enabled v4 manager and must still perform all existing import/bundle validation.

A host can use a raw `createSoundtrackStore({managedStore})` facade for panel transactions while passing `adoptLibrary: snapshot => owner.adoptVerifiedSnapshot(snapshot)`. Boot uses the same owner's guarded `load`, never a competing unguarded metadata setter. The panel's optional hook is awaited so a wrapper's rejection is observed, but preparation/I/O belongs before owner admission. Async host work must retain lifecycle cancellation; no callback is permission to mutate a destroyed host.

## Read versus committed write

Reload adopts the read snapshot before replacing the local saved/draft view. Rejected admission preserves the existing unsaved draft and reports recovery; it cannot replace current playback with stale metadata.

A successful transaction is durable even if adoption subsequently fails or cancellation arrived after commit. The panel records the saved generation and clean draft, reports **Library is saved, but the game refresh failed**, and offers Reload. It does not retry storage, mislabel the library unsaved, or continue Save & use's playlist selection after refused admission. `onLibrary` is not called when admission failed. A disposed panel does not invoke admission or notifications for a later commit completion. A host refusing playback adoption must recover by loading the existing committed library, not by resaving the old draft.

Save & use preserves paused listening. It chooses the saved queue without pretending an async storage operation retained browser Play permission. The separate Play button uses the existing same-activation-task path. The host must not wrap explicit Play in awaited unrelated work.

## Composed Couch host contract

Both hosts use one persistent player, its shared v4 library owner and session policy, with the panel hooks, exact accepted context, published-music fallback and silent preparation. Settings → Audio exposes their controls. The top library dialog owns input; closing it restores the Audio category's Music library opener, and closing Settings restores its own original opener. Gameplay Resume remains explicit. Preserve the actual verified Solo keyboard journey as a comparison, not as Couch evidence.

Route **all** host explicit Play/Pause controls through the same session. Keep audition intent temporary. A host must prevent underlying controls from acting through an open top modal, retire auditions on lifecycle suspension, pump the one persistent player in menus/results and dispose borrowed owners in order. These host behaviors and actual native/physical-device/listening/offline/public journeys remain release gates.

## Evidence boundary

Tests execute the actual panel handlers, existing import/store transaction code and new admission/session policies with finite DOM/IndexedDB/media adapters. The composition test uses the real existing player, shared owner and session; coded-silence bytes verify transport/ownership, not sound quality. Existing whole panel tests preserve default Solo behavior, keyboard treatment, cancellation, backups and auditions. No browser or public release is claimed here.

## Modal visit and return ownership

Repeated `open()` while the dialog is already open preserves the first opener and does not invoke `onOpen` again. Repeated `close()` after closure returns false without repeating focus, audition restoration or `onClose`. A normal open/close visit still calls the existing `onClose` callback once; the prior code already called it correctly.

Pass `canRestoreFocus(opener)` to check the current host Settings visit/run/generation before the panel restores its opener. Hidden pages and hidden/inert or disabled openers do not receive panel-driven focus. The host's own `onClose` callback must respect the same ownership rules; this guard does not constrain arbitrary callback code.

`close({restoreFocus: false, restoreMusic: false})` supports terminal or abandoned-visit cleanup without replaying an audition's prior music or moving focus. It is **not** a substitute for ordinary hidden/foreground suspension: retain the existing audition remembered-intent path there so foreground return can restore eligible listening. Busy operations still refuse Close and expose cancellation instead of losing a draft.
