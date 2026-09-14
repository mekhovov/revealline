# Remember the selected chapter

Choosing a chapter or map now remembers that menu choice on this device. Reloading, reopening the game or returning from Couch prepares that chapter at the title screen. It does not start flying. **Continue flight** remains a separate, explicit action that restores the actual suspended flight, even when it belongs to another chapter.

The local bookmark stores the exact authored campaign identity, map ID and theme ID. It resolves only against already installed, validated content and the current difficulty preference. Missing or replaced chapters fall back to the ordinary startup selection. Locked or removed maps use the selected chapter's normal accessible continuation; a bookmark cannot unlock a map or install a pack.

## Runtime contract

`game/selection-bookmark.mjs` owns the bounded `revealline-selection.v1` sidecar at `${libraryKey}.last-selection.v1`. This is local menu convenience, not a new player-library or saved-session version. It is deliberately excluded from portable progress/media backups. Existing scores, earned pictures, first-earned story identity and replay authority remain unchanged.

Only a writable, adopted, recovered player profile can remember a deliberate selection. Training, practice, read-only tabs, backup transactions and recovery holds cannot write it. A corrupt or unavailable bookmark is ignored without repairing or deleting its stored bytes. Repeated identical selections do not write again. Removed content is never downloaded automatically at startup.

The host remembers successful chapter/map choices, next-map choices, accepted theme changes and a fresh attempt's selection. Restoring a saved flight does not overwrite the menu bookmark. Startup retains the selected chapter's actual class recipes and themes, and selects an available class if the stored preference does not exist there. Current authored music still resolves through the existing presentation path.

## Verification

Run the focused checks with either supported Node runtime:

```sh
node --test game/test/selection-bookmark.test.mjs game/test/selection-bookmark-host.test.mjs game/test/boot-host.test.mjs game/test/difficulty-host.test.mjs
```

The host test creates and saves a real twelve-tick cut in one chapter, installs/selects another through the real menu handler, reloads with the same pack storage, and explicitly restores the original verified checkpoint. Browser image decoding is modeled only at the test boundary; this is not visual or device certification. Existing menu Pause may refresh `savedAt`; the complete flight and replay remain equal. Reload itself preserves the exact raw saved slot.

Native browser checks separately cover Pressure Lines and Frontier Lines selection/reload, then a paused Copper Switchyard flight, a new Orchard Crossing selection, reload and explicit restoration of Copper Switchyard at 0% / 0 points / three lives / 2:59. The local evidence is in `.cache/round47/selected-chapter-native/`; release qualification must bind the final committed source and repeat the relevant packaged journey.

## Authoring examples

- “Add a new chapter while preserving last-selection startup. Verify its exact installed identity, locked-map fallback and ordinary explicit saved-flight continuation. Do not use the bookmark to grant progress.”
- “Replace a theme or remove a pack, then reload. Keep saved/earned media identities intact and recover the menu choice without automatically installing anything.”
- “Return from a two-player match to the selected solo chapter, then load a different suspended flight. Test menu selection and flight restoration independently.”

The selected chapter remains accessible through **All missions**. The featured Pressure Lines entry remains an explicit shortcut to that chapter; it does not silently change a bookmarked selection merely by showing the title screen.
