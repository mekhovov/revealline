# Team arena selection

Team opens on **First Connection** for a new player. A returning player’s compatible built-in arena choice appears in the same lobby, with the selected preview and objective. Start remains deliberate. This P03 feature is integrated into the Couch/Team candidate on v0.61.24. Its recorded native selection check passed, while exact-source release gates and broader public/native qualification remain pending; it is not a phase acceptance record. See [the candidate checkpoint](couch-team-delivery.md).

## Selection ownership

The classic `game/couch/team-entry.js` runs after the already visible loading status and navigation, before the Arena selector is parsed. It records native input/change intent and claims from primary pointer activation, assistive click and native select editing/opening keys while the main module loads. Mere focus, Tab, Escape and unrelated shortcuts do not claim selection. The host consumes that evidence once. A deliberate early choice takes priority over the saved hint, including confirming First Connection when it equals the original markup value and the browser emits no change event. Opening then cancelling preserves the visible selection for this visit without writing storage. Invalid early choices fall back to First Connection. If the tracker is unavailable, the host conservatively preserves a valid native selection.

With no early choice, the host uses a validated stored arena or First Connection. Loading, preview preparation and initial restoration never write a default. Boot retains the existing native option nodes and leaves an already-correct selected value untouched. Later built-in selector changes remember the choice immediately, including when picture loading needs recovery. No selection change starts play. After a successful explicit initial Start, a built-in arena differing from the current bookmark is remembered; a failed Start or imported arena does not write.

The active page owns its selection. Settings, Retry, browser cache restoration and another tab’s bookmark change cannot replace the current setup, prepared picture or accepted attempt. Returning from an imported pack restores the last built-in arena chosen during this visit. Imported packs and their selections remain in memory.

## Independent storage

`revealline.team-arena.v1` contains only:

```json
{
  "version": "revealline-team-arena.v1",
  "packId": "relay-rescue-starter",
  "packRevision": 2,
  "levelId": "first-connection"
}
```

Restoration requires the exact current built-in pack ID/revision and an allowed arena. A structurally understood older pack identity is ignored for restoration and may be replaced by an explicit current choice. Unknown formats, extra fields, malformed or oversized data remain untouched; a local choice still works. Read denial falls back safely. Failed or disabled writes leave the chosen arena playable and announce that it applies to this visit.

Only this key is written. It contains no checkpoint, difficulty, teamwork policy, artwork pin, imported bytes or Solo profile state. This feature does not implement persistent Team saves or claim that the existing coordinated backup contains the bookmark.

## Qualification

Regressions cover fresh/default entry, returning selection, early input, exact preview/real core, no automatic Start, stale artwork completion, failed storage, protected records, import/Return and Settings/BFCache ownership. Preference tests also exercise reentrant disposal and newer choices across storage boundaries. Historical Yard mechanics and recovery tests explicitly select Yard; their original asset/state assertions remain.

The small classic script is executed by VM and actual-host fixtures and needs explicit `node --check` and formatting checks in addition to the six release gates, whose normal game globs cover ES modules. Browser acceptance must separately hold its response and the main module, verify visible loading/navigation, then use real keyboard, touch and controller selections. Reload, browser Back, phone rotation, Large text, stored-error live status and both arenas’ exact loaded artwork remain native release checks.

Native select keys include F4 as documented by [Microsoft](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows) and implemented by [Chromium](https://chromium.googlesource.com/chromium/src/+/9dd7d49061ff6271c74f4dba9d90e11ae2a3dafc/third_party/blink/renderer/core/html/forms/select_type.cc). Alt/Ctrl/Meta-modified F4 remains outside this tracker. This source check does not establish native Windows qualification.
