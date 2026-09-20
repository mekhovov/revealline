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
3. Choose **Play Island connections**. If Settings remains open, press Back/Escape to reach **First bridge**, then **Start mission**.
4. Tap Left. Releasing the key continues the cut; reaching the border closes it and stops the craft. Continue with fresh direction taps.
5. Open Installed chapters and choose **Export installed packs**. Retain the actual downloaded file, not only a success notification.
6. On a fresh local origin/profile, import that downloaded library through the same file picker. Verify Island connections 1.0.0 appears and First bridge opens with a 20% target and three lives.

This transfers pack content. Player achievements and unfinished flights have separate exports; a restored pack does not fabricate either. Keep originals for any later embedded artwork and use the real decoder. Uploaded MP3s and presentation bundles use their own binary backups.

## Safe variations

- Move or resize `foundations`, then update spawn to a valid claimed cell and reverify both turning modes.
- Add validated walls or classic terrain and author a new legal route; the starter’s route is not proof for edited geometry.
- Tune enemy routes and pressure, then playtest fairness before increasing speed.
- Change theme recipes or artwork without claiming that a reskin is a new proven map.
- Give derivative packs/campaigns/maps distinct IDs and intentional revisions. Preserve prior exports and historical replay versions.

Example prompts: “Create a second starting island with two viable connections, retaining capture-stop”; “Author a slow-field detour with a visible escape route”; “Reskin this teaching map for Ukrainian embroidery while preserving collision geometry.” Registered data fields can compose existing behaviors; a prompt or JSON label cannot add a new simulation primitive.

[Retained verification](../../docs/verification/foundation-authoring-v076/README.md) identifies the tested source and explicitly separates source routes, browser capture, transfer and unverified release/device gates.
