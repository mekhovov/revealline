# Steam Deck Chrome investigation — 15 October 2026

## Status

The user reports that Steam Deck controls still require touchscreen use. This
investigation does **not** establish a fix or a physical hardware pass. No runtime
input behavior or suppression window is changed in this batch.

The previously merged repair branch had no local changes. A fresh isolated branch
was created from current `origin/main` (`d6b0cae9df77688f75992279f8cdc181f4f84bcd`),
which is the repository default branch, rather than replaying already merged
commits. An interrupted checkout caused by disk exhaustion was recovered; large
unrelated assets are omitted from this worktree using sparse checkout.

The public `/game/build-info.json` and `/main-deployment.json` observed during this
investigation identify version `0.151.1`, source
`6ee28360b14e24e92b377eb48fbef42265ef657f`. The public Confirm lifecycle module and
the inspected main module both have SHA-256
`c4e7fc257ad7eae85e1130ef3d9a54c64d7de214b357829db834682191d894b6`.
This is a one-module comparison, not a complete public-byte audit.

## What the new checks establish

The prior Steam Deck host suites use `soloPage`'s Legacy default. Added explicit
public Journey entry tests (`search: ''`) cover three rapid pure Gamepad Sound
press/release cycles and a native pointerdown preceding gamepad visibility and
browser focus transfer. Both pass on the existing implementation. They do not
establish a new runtime defect.

These menu checks deliberately do not wait for picture downloads. They exercise
the real app/router/navigation/menu handlers with the host's modeled DOM and
Gamepad input, not real Chrome event defaults, rendered artwork or Steam Input.
The existing Legacy Steam Deck host/race tests also pass (19 cases). The combined
router, bindings, guard, lifecycle, navigation and Steam Deck host run passes
299 cases with no failures or skips. Changed JavaScript passes ESLint; changed
files pass Prettier and `git diff --check`. This is not the full repository suite.

No supported browser surface is currently exposed by Computer Use, and this host
has no accessible physical Steam Deck. Fullscreen/native Chrome and physical Deck
acceptance therefore remain unperformed. No new immutable artifact was built for
this test/documentation-only batch.

## Browser evidence and conditional setup repair

- [W3C Gamepad specification](https://www.w3.org/TR/gamepad/#dom-navigator-getgamepads):
  gamepad exposure follows a gamepad gesture; snapshots are separate from native
  keyboard and pointer events. An empty list before interaction is not evidence
  of permanent device failure.
- [Valve Steam Input activators](https://partner.steamgames.com/doc/features/steam_controller/activators):
  bindings may include different press/release activators. A layout must be
  inspected rather than inferred from a button label.
- [Chromium Steam Input mapping change](https://chromium.googlesource.com/chromium/src/+/c9bc4476626e413fac9fac8b08e4b2110ee344f2):
  Linux Steam Input's virtual gamepad is treated as Xbox 360 compatible. Do not
  claim Chrome inherently cannot expose Deck gamepads.
- [DOS_deck's Chrome/Edge setup](https://dosdeck.com/about/): its browser-game
  installation instructions grant `/run/udev` read access and select the Gamepad
  with Mouse Trackpad template.
- [Chrome Flatpak manifest](https://github.com/flathub/com.google.Chrome/blob/master/com.google.Chrome.yaml):
  the inspected manifest grants device access but does not explicitly grant
  `/run/udev`. This is not proof of the user's installed permissions.
- [Microsoft's Edge setup](https://support.microsoft.com/en-us/edge/xbox-cloud-gaming-in-microsoft-edge-with-steam-deck):
  separately documents the same udev access requirement for Edge on Deck.

If Chrome was installed through Discover/Flatpak and the trace remains without
any gamepad after pressing buttons, close Chrome and run in Deck Desktop Mode:

```sh
flatpak override --user --filesystem=/run/udev:ro com.google.Chrome
```

Then set the Chrome Steam shortcut's controller layout to **Gamepad with Mouse
Trackpad**, return to Game Mode and relaunch Chrome. For the comparison, A should
have one Regular Press binding to Gamepad A. Record custom bindings before
changing them. This command applies only to that Flatpak Chrome package; it is
not a web-app patch and was not executed on the user's Deck.

## Required next evidence

Use the existing stable URL:
<https://mekhovov.github.io/revealline/game/?controllerTrace=1>.
The same session-only trace can be enabled in Settings → Controls, including
fullscreen launches. Press A on Sound, then release; record the build and whether
`[0]` or another button appears, the selected controller, and the transaction
start/release/winner or cancellation reason.

- No pad after interaction: inspect browser device access and shortcut layout.
- Raw buttons but no selected controller: investigate mapping/assignment/neutral gate.
- Selected A but no commit: reproduce the recorded ownership/cancellation sequence.
- One commit but reversal: inspect the actual following native event/action.

Do not broaden echo timers or reinterpret arbitrary raw devices without that
observation. The remaining P0 is still the user's reported hardware failure.
Releases should group this test/evidence batch with normal queued work; it is not
a standalone diagnostic release or a resolved Steam Deck bug.
