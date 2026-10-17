# Demo media preparation ownership

Active Demo playback previously left the shared media queue in the paused main game's phase. Optional effects/speech preparation and the worker-unavailable MP3 inspection fallback could therefore start during Demo. A completed main game could also write `paused` back into the queue on every callback. This is a reproduced scheduling defect; it does not establish the cause of the reported iPhone temperature.

Demo now supplies the shared preparation phase while it owns the screen, independently of mute and Game Sounds preferences. Watching and active practice defer optional background work and main-thread inspection. Visible preparation and explicit Pause admit that work. Hidden or unfocused practice remains suspended until deliberate Resume; background spectator transport retains its existing required-audio contract while bulk work stays deferred. Returning to Solo restores its current phase. Phase notifications are change-only.

The change extends the existing app/Demo boundary and shared queue. It introduces no new loader, audio owner, simulation clock, replay format, frame-rate cap or quality policy. Required fetch/decode/worker admission and non-cancelable decode reservations retain their existing semantics.

## Correctness evidence

The new tests use the actual app-owned `Soundscape.mediaPreparation` queue. On the preceding runtime, seven lifecycle cases fail because optional background tasks are admitted, and the added terminal-parent case observes a parked main-thread task running once when it must remain deferred. Those failures occur before later assertions; unreached checks are not counted as red proof.

The corrected runtime passes **49 distinct tests across six complete files**, with zero skipped/cancelled cases. Coverage includes both Game Sounds settings, muted playback, held loading, details, queued Resume races, required/demanded work, hidden/unfocused watching and practice, cancellation, public handoff and ordinary Solo Start. A legally earned parent win also exercises repeated terminal callbacks, focus restoration and actual modeled canvas loss/restoration without changing the parent checkpoint, reward or save. Explicit Demo Pause releases the parked task exactly once. Existing soundtrack admission and queue reservation tests pass.

Two existing Demo host fixtures were corrected while retaining their assertions: the idle test now supplies 60 seconds through callbacks within the existing inactive presentation limit; the Fresh test reads the native capture envelope through its existing accessor. These are source-proven stale fixture assumptions, not claimed original-main reproductions. Earlier failed and interrupted attempts remain retained. An initial invalid audio fixture left a test process without a complete footer; only its owned process was stopped, and that attempt receives no complete-file credit.

This evidence uses Node 22.22.2 and modeled browser/audio boundaries. It does not qualify native iPhone/PWA lifecycle, the separate Capacitor event adapter, sustained performance or heat. A new verified package and affected native Demo/media observations remain required.

## Source and evidence identity

- App SHA-256: `3d05e56c1cb3680fbeef0ed63d696b8e6e7590c0479f4babf47154e30b4ca3e6`.
- Demo host SHA-256: `c4795ccb53a031ac565b21c58e165207d57df751a87914f5fb6351a1b2502e69`.
- Consolidated receipt: `.cache/solo-followup/demo-media-admission-01/handoff-receipt.json`, SHA-256 `bc6212b49989fa7fb6d8cc6a6cfb504de435ea6d86a6ab6c273eeb4099329776`. It binds all complete TAP files, red failures, the interrupted attempt, final source hashes and scoped static checks.
- Scoped lint, formatting and diff checks pass. Production bytes stayed unchanged throughout the passing runs. Two new/extended test files were formatted afterward; parser-normalized AST equivalence and both byte identities are retained explicitly.

WebKit recommends minimizing background activity and needless work to improve responsiveness and power use. This correction follows that guidance, while actual thermal behavior still requires the reported devices. [WebKit power guidance](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/).
