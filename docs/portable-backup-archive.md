# Portable backup archive

In **Saves & loads**, **Prepare portable archive** gathers the existing validated
game-data, picture, story and music exports and their original coverage report.
When this game screen owns a Journey profile, the archive also uses that owner's
asynchronous export, including saved evidence through its current admission path.
The existing separate-file preparation and import controls remain available.
In authored Journey editions, the archive explicitly omits incompatible Legacy
game-data JSON and the unfinished authored flight. It still exports the supported
shared originals and current Journey progress. Use the separate attempt export
for an unfinished flight. The Legacy save/export guards remain enforced.

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
- Whether Legacy game-data JSON is included or excluded for an authored Journey
  owner. The latter also excludes the unfinished authored flight; no substitute
  Legacy profile or empty saved flight is manufactured.

Member counts come from the actual exports. No fixed five-file count means that
the entire game is covered. A Journey export conflict, cancellation or changed
owner prevents publication; only the existing Journey exporter can return its
explicitly marked available-evidence recovery result.

In **Saves & loads → Inspect an archive and extract files**, choose a portable
ZIP and explicitly inspect it. The read-only inspector checks its bounded ZIP
structure, safe filenames, CRC32 checksums and each component's recorded SHA-256.
It lists actual exclusions and offers native downloads of the original files in
restore order. A different version/profile channel receives an advisory; that
advisory cannot establish component compatibility or identify a trusted source.
Download the needed files before closing the screen. Each download is a request,
not proof of a saved file. Nothing is imported or restored by inspection.

You can also extract it using the device's archive tool. Read the manifest and
coverage report, then use the existing reviews for pictures, stories, music and
compatible Legacy game-data JSON. For included
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

The inspector accepts this game's flat, uncompressed v1 ZIP profile, including
early v1 game archives without the later explicit `gameData` field. It rejects
compression, encryption, ZIP64/extensions, symlink attributes, unsafe or duplicate
names (including case collisions), inconsistent records, unlisted files,
oversized metadata and checksum/hash mismatches before exposing any downloads.
It reads headers and CRC chunks with bounded slices and never allocates a second
whole ZIP buffer. WebCrypto SHA-256 reads one component at a time; its largest
allocation remains bounded by the archive's existing overall limit. Physical
low-memory-device qualification is still required. Recompressed ZIPs can be
extracted with the device's archive tool and reviewed through the component owners.

Inspection borrows the Library's operation slot, cancellation and feedback.
Closing the view, changing the chosen file or backgrounding a pending inspection
prevents late results and retains the busy slot until the current read settles.
Completed read-only downloads survive a Files-app round trip and are released on
close/unload or a new preparation. The original file and game stores are untouched.

Focused tests cover unchanged component hashes, explicit exclusions, borrowed
Journey async export, partial evidence, cancellation and ownership fencing,
bounded ZIP reads, CRC32, and native-link lifecycle. The system `unzip` reader
also verifies and extracts a fixture, with every extracted component hash checked.
Actual game-host tests cover both the ordinary authored Home and Legacy Journey:
preparing an archive does not change saved game data or resume play. The authored
case preserves the existing Legacy export rejection and checks actual archive
members and exclusions. Those are source/fixture results, not physical-device
qualification.

Additional tests cover malicious ZIP structure, checksum and manifest mismatch,
exact extracted bytes, early-v1 compatibility, authored/partial Journey scope,
native download retry, English/Ukrainian changes, cancellation, stale reads and
the actual ordinary Home export → inspect → download flow. Inspection does not
prove that a component's separate restore will succeed; those existing reviewers
still validate their own format, owner, originals, generations and replacement policy.

Pending device checks: build an exact committed revision; save an archive from
Safari and a Home Screen installation; find and extract it in Files; compare its
members and use the existing review flows in an isolated destination. Exercise
large media within device capacity, cancellation, background/foreground, denied
downloads, narrow layout, large text and Ukrainian. Confirm restrictions and
partial-evidence warnings remain visible. Do not overwrite the user's primary
profile for a qualification test.
