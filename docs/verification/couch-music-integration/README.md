# Shared Couch music — current-source integration

Integration candidate based on `aadd855eb707c7d115bcbd29177eadb630a114d0`, with the five ordered reviewed music packets. This is not a public release or complete P02-B acceptance.

- Complete affected cohort: **593/593 tests across 38 files**, Node 20.19.5. Lint and formatting passed for the 23 packet paths. Unrelated pre-existing register table formatting is preserved.
- Native browser: real two-MP3 import, mixed playlist including duplicate entries, save/select, ordered song-end transition, explicit music Pause across game Start/Pause, nested keyboard focus, and shared-library adoption in Team.
- Master sound remained muted; successful transport is not a listening review. Physical inputs, offline playback, full backup roundtrip, final combined-source gates and public qualification remain open.

`originals.zip` preserves original patch packets, source input pins, initial missing-module setup failure, corrected full cohort log and native observations. Its manifest pins every member. The newer source adds imports absent from the older packet fixture; those were restored from exact Git objects. Read-only borrowed originals were verified unchanged before and after testing. The user's dirty checkout was not changed.

The browser checks use the final override manifest over the exact source base. Screenshots were inspected inline, with no saved-image artifact claim. The imported files are local test data and are not included in this source change or licensed for distribution by this verification.

Research: [MDN autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) supports direct playback gestures and truthful rejection handling; [W3C modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) supports contained navigation and logical focus restoration.
