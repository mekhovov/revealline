# Replay display controls after browser Back

Replay Theater uses the shared display preference owner for font, text size and reduced effects. Returning through browser history can restore form values independently of that owner. When its saved or session-only values have not changed, the owner correctly emits no preference update; the browser-restored controls still need repainting.

The Theater now uses the existing preference-restoration view adapter after subscribing to the owner. It repaints from the current snapshot during pageshow and once in the next task, covering late form restoration. It never adopts restored form values, writes a preference, moves focus, clears input or resumes a recording. Unsaved explicit intent and the system reduced-motion cap remain authoritative. Departure cancels pending view work; terminal exit disposes both the view and owner.

Verification must exercise unchanged saved preferences, unchanged denied-save session choices, stale controls both before and after pageshow, and terminal exit with a queued repaint. Preserve the recording checkpoint, paused state, raw recording input, focus, storage contents and warning. Modeled events prove this contract; actual browser history restoration and physical-device behavior remain separate evidence.
