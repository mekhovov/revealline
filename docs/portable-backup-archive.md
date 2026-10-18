# Portable backup archive

In **Saves & loads**, **Prepare portable archive** gathers the existing validated
game-data, picture, story and music exports and their original coverage report.
When this game screen owns a Journey profile, the archive also uses that owner's
asynchronous export, including saved evidence through its current admission path.
The existing separate-file preparation and import controls remain available.

**Download portable archive** is a native link to a prepared ZIP. It reports a
download request, not a successful disk write. Check the resulting file in the
browser destination or Files app. A prepared archive remains available across a
background/foreground round trip; closing the Library, leaving the page without
back/forward retention, preparing again or detecting changed ownership releases it.
Preparation in progress still cancels on backgrounding. No archive action writes
to, closes or replaces the game, original-media or Journey stores.

## Scope and restoration

The ZIP contains `archive-manifest.json`, bilingual `README.txt`, and the actual
component filenames listed in the manifest. It preserves the original component
bytes and their SHA-256 values. It does not rename, transcode or rewrite uploaded
media. Stored ZIP entries use CRC32 and no compression or encryption. The writer
follows the [PKWARE ZIP specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT).

This is an archive of the current game profile and saved shared media, with the
current Journey owner when present. It is not a whole-browser or device backup.
The manifest explicitly records:

- The existing coverage exclusions and missing or detached originals.
- Reference-only restricted music; its absent audio bytes are never supplied.
- Whether Journey is included, unavailable in this screen, or exported with only
  available evidence. The latter uses a `-journey-recovery.json` filename and
  visibly warns that unread performance comparisons or replays may be missing.
- Other game profiles, browser/device settings, download caches and separately
  stored simulator records, which are excluded.

Member counts come from the actual exports. No fixed five-file count means that
the entire game is covered. A Journey export conflict, cancellation or changed
owner prevents publication; only the existing Journey exporter can return its
explicitly marked available-evidence recovery result.

The game does not directly import the ZIP in this slice. Extract it using the
device's archive tool, read the manifest and coverage report, then use the
existing reviews for pictures, stories, music and game-data JSON. For included
Journey JSON, use **Keep your Journey → Inspect Journey backup** in the same
edition. Each restore is separate; there is no new atomic transaction or hidden
replacement of current progress. Keep a backup of the destination before restoring.

[Apple documents ZIP extraction in Files](https://support.apple.com/en-us/102532):
open the ZIP to create a folder, then open that folder. This documented capability
does not replace testing this game's archive on a physical iPhone/iPad.

## Bounds and verification

The component serializers keep their existing limits. The archive adds the
existing 16 MiB Journey import bound and 128 KiB packaging allowance to the
existing backup-set budget. The ZIP writer admits the total size and a maximum
of 16 flat filenames before reading any body. CRC calculation reads at most
64 KiB at a time; the ZIP retains original Blob parts instead of allocating a
second whole-archive byte array. These are safety ceilings, not recommended
backup sizes for low-memory phones.

Focused tests cover unchanged component hashes, explicit exclusions, borrowed
Journey async export, partial evidence, cancellation and ownership fencing,
bounded ZIP reads, CRC32, and native-link lifecycle. The system `unzip` reader
also verifies and extracts a fixture, with every extracted component hash checked.
An actual game-host test checks that preparing an archive does not change saved
game data or resume play. Those are source/fixture results, not physical-device
qualification.

Pending device checks: build an exact committed revision; save an archive from
Safari and a Home Screen installation; find and extract it in Files; compare its
members and use the existing review flows in an isolated destination. Exercise
large media within device capacity, cancellation, background/foreground, denied
downloads, narrow layout, large text and Ukrainian. Confirm restrictions and
partial-evidence warnings remain visible. Do not overwrite the user's primary
profile for a qualification test.
