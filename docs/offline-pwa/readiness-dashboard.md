# Offline readiness dashboard

The **Install & offline** screen starts with **Ready before you go offline**. Its
summary uses the downloader's existing file verification, worker and app launcher
reports. **Recheck offline files** runs the existing **Verify game files** action;
it does not download content, update an edition or choose a different app version.

## What the results mean

- Essential game files and the chosen games/chapters are checked separately.
  Complete chapters cannot conceal missing startup files.
- App icon files and the edition selected by that icon are separate results. A
  verified edition can still require app selection or a reviewed progress transfer.
- A recovered bookmark does not require the app launcher to open its own route.
- Optional simulator counts cover the bundled packages offered on this screen.
  They do not claim to inspect separately installed simulator editions. Optional
  recorded music is also reported separately from the files required for play.
- Storage retention granted by the browser does not guarantee that data cannot be
  cleared. The dashboard continues to recommend a portable backup.
- Results apply to the current browser or installed app. Safari and an iPhone
  Home Screen app have separate storage; prepare and check inside the app that
  will be used offline.

The dashboard clears its verified observation when this screen is hidden, closed,
revisited from the back/forward cache, or another window changes the installed
edition. Changing a package selection checks that selection again. An operation in
progress and a superseded or failed check cannot restore an old success message.
These observations do not predict subsequent browser eviction or whole-origin loss.

## Verification and remaining device qualification

`game/test/offline-readiness.test.mjs` checks the summary's distinction between
unknown, required and optional files, installation context, storage retention,
locales and superseded checks. `game/test/offline-readiness-host.test.mjs` executes
the downloads host with controlled storage/worker boundaries to check actual
selection, recheck, hide, panel reopen and cross-window state handling.

These tests do not qualify physical devices. Before claiming iPhone/iPad support
for this view, record the OS/browser and exact built revision and check:

1. Safari and a newly installed Home Screen app show their own context and checks.
2. Check a chosen game, close it, enable airplane mode and reopen from its icon.
   Confirm that play works, then return to this screen and recheck offline.
3. Change selected chapters, test a missing bundled simulator and leave recorded
   music unprepared; required and optional results remain distinct.
4. Background during a check, return and verify that the old result is retired.
   Close/reopen the embedded panel and exercise browser back/forward as well.
5. Read English and Ukrainian at narrow portrait width, large text and safe-area
   insets; navigate by touch, keyboard and supported controller.
6. Test storage retention unavailable/denied/granted. Follow the existing backup
   procedure and verify the saved file in Files; a retention result is not a backup.

Rolling builds retain their existing worker update behavior. This summary adds no
transactional rolling-update guarantee, immutable edition migration, downloader,
background download promise or automatic recovery after the whole origin is lost.
