# Foundation chapter: runnable authoring example

This one-map teaching chapter uses a 72×36 board, a starting island, one field enemy and capture-stop steering. It reuses the checked-in Night Shift procedural theme, class recipes and music descriptors. It is a Tactical example, not an accepted production campaign or difficulty benchmark.

From a complete source checkout, using Node 20 or 22:

```sh
node authoring/examples/create-foundation-pack.mjs /tmp/foundation-example.json
node authoring/examples/verify-foundation-pack.mjs /tmp/foundation-example.json
```

The generator refuses to overwrite an existing output. Choose another path after editing a pack. It validates `xonix-pack.v6 / xonix-core.v6 / xonix-level.v5`, prepares and installs the candidate in memory, exports/imports the library and checks exact serialized round-trip equality. It never writes to your player profile. No image decoder is replaced with a test stub: this example contains no embedded images.

The verifier uses normal fixed-tick direction inputs. From the island, travel left to the border, return right to the island’s centre and then travel down. Both Immediate and Grid + buffer must win with three lives. This proves reachability; it does not prove challenge, enjoyment, mobile performance or native keyboard timing. The first capture stops the craft in the player UI; tap a fresh direction to continue.

## Install, play and recover

1. Serve the game over HTTP using the repository’s usual development workflow.
2. Open **Settings → Game data → Installed chapters → Install a pack file** and choose the generated JSON.
3. Choose **Play Island connections**. Library and Settings close, **First bridge** appears, and **Start mission** receives focus. Start explicitly; selecting the chapter must not begin flight. The exact-source transfer trial below verifies this local navigation; public acceptance is tracked separately.
4. Tap Left. Releasing the key continues the cut; reaching the border closes it and stops the craft. Continue with fresh direction taps.
5. Open Installed chapters and choose **Export installed packs**. Retain the actual downloaded file, not only a success notification. Its suggested name is `revealline-expansion-packs.json`; your browser may add a number. This is a `xonix-pack-library.v1` collection containing the prepared pack, so it is not expected to have the same formatting or byte count as the source pack JSON.
6. On a fresh local origin/profile, import that downloaded library through the same file picker. Verify Island connections 1.0.0 appears and First bridge opens with a 20% target, three lives and an explicit Start action. Check that Collection remains empty before playing: installed content must not fabricate the source player’s earned picture. Reload, then start the imported mission and make a capture to verify persistence and playability.

This transfers pack content. Player achievements and unfinished flights have separate exports; a restored pack does not fabricate either. Keep originals for any later embedded artwork and use the real decoder. Uploaded MP3s and presentation bundles use their own binary backups.

## Safe variations

- Move or resize `foundations`, then update spawn to a valid claimed cell and reverify both turning modes.
- Add validated walls or classic terrain and author a new legal route; the starter’s route is not proof for edited geometry.
- Tune enemy routes and pressure, then playtest fairness before increasing speed.
- Change theme recipes or artwork without claiming that a reskin is a new proven map.
- Give derivative packs/campaigns/maps distinct IDs and intentional revisions. Preserve prior exports and historical replay versions.

Example prompts: “Create a second starting island with two viable connections, retaining capture-stop”; “Author a slow-field detour with a visible escape route”; “Reskin this teaching map for Ukrainian embroidery while preserving collision geometry.” Registered data fields can compose existing behaviors; a prompt or JSON label cannot add a new simulation primitive.

[Retained verification](../../docs/verification/foundation-authoring-v076/README.md) identifies the tested source and explicitly separates source routes, browser capture, transfer and unverified release/device gates.

## Native win follow-up

The isolated navigation follow-up imported this exact generated JSON through the
file chooser, completed First bridge with ordinary direction taps, opened its picture
from Collection and retained the earned picture after reload: 32.2% captured, 7,590
points, three lives and GOLD. This actual route differs from the fixed-tick CLI route;
both are legal wins. The native pass used Immediate turning and procedural artwork.
See [scoped evidence](../../docs/verification/library-launch-navigation/result.json)
for exact source and pack hashes, navigation steps and remaining limits. It does not
qualify production difficulty, custom media, physical controllers or public deployment.

## Complete content-transfer trial

The [fresh authoring and two-origin trial](../../docs/verification/p17-foundation-transfer/README.md) ran the unmodified example against source `8cffb36b29a38013eb9213845efd675c4864c9d8`. Node 20 and 22 generated the same 5,270-byte pack. Both turning policies completed the fixed-tick route with three lives.

The actual browser installed that file and completed First bridge with direction taps: 49.9% captured, 11,750 points, three lives and GOLD. Export produced a real 3,605-byte installed-library file. Its bytes matched the expected prepared-library export exactly on both runtimes. Importing that same file on a fresh local origin restored the chapter without importing the earned picture; after reload, ordinary Start and Left made another legal capture. The original origin retained its own result and picture.

This verifies the small procedural teaching workflow. New community artwork, Studio presentation bundles, original audio, Team maps, controller hardware and a complete release build have their own acceptance gates. Keep those assets and exports distinct when extending this example.

Maintenance prompt: “Generate the unchanged foundation chapter in a fresh authoring directory, retain exact source and output hashes, install it through the real file picker, and complete a legal route. Export installed packs, locate the actual saved file and compare its prepared-library bytes. Import that exact file on a separate fresh origin, verify no player awards appear, reload and make a legal capture. Retain the source player’s original result. Distinguish CLI routes, browser actions, actual downloaded bytes and untested media/device requirements.”
