# Living landing scene: local web candidate — 2026-09-29

The complete web build passed with the normal localization, content, snapshot and reference validation enabled. This is a local working-tree candidate for **0.142.1**, with `sourceRevision: null`; it is not release-admitted, signed or published. No version was changed. The earlier preview on port 8976 remains untouched.

```sh
node scripts/game-cli.mjs build --out /private/tmp/revealline-menu-motion-20260929
node scripts/game-cli.mjs serve --root /private/tmp/revealline-menu-motion-20260929 --host 127.0.0.1 --port 8978
```

Both commands used `/Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node`. Preview: [local game landing](http://127.0.0.1:8978/game/).

- Output: `/private/tmp/revealline-menu-motion-20260929`.
- Manifest: **1,860 files**, **750,453,406 bytes**.
- Manifest SHA-256: `c438157e53bd55334cbd9bb7def50984e0800bce3e8fb3d9e8b099f9fe2abbfd`.
- ZIP SHA-256: `e1411e0e75048cb37ba2be69abdead721636fed42eae6245a8c9ffc4243c53b9`.
- Every manifest file's byte count and SHA-256 passed an independent readback; the manifest total and distribution ZIP checksum also agree.
- Main and couch entry pages contain `data-build-version="v0.142.1"`. The landing, scene module and fullscreen module return HTTP 200 from the new server.

## Source agreement and concurrent changes

All **11 watched files** were unchanged from the pre-build snapshot through verification and match the package byte-for-byte: `controller-navigation.mjs`, `controller-router.mjs`, `fullscreen.mjs`, `game-shell.css`, `game-shell.mjs`, `menu-scene-catalog.mjs`, `menu-scenes.css`, `menu-scenes.mjs`, `native-menu-icons.mjs`, `native-menu.css` and `native-menus.mjs`, all under `game/ui/`. Exact before, after and packaged hashes are in the [machine-readable evidence](landing-motion-packaging-2026-09-29.json).

The wider workspace did change during this build. The captured source inventory stayed at 1,712 files, with three changed bodies:

- `game/app.mjs`
- `game/company-player.mjs`
- `game/ui/signal-reception.mjs`

All three packaged bodies match their post-build source. There were no added or removed source inputs and no localization output hash changes. This candidate therefore includes concurrent work; the entire source tree was not frozen. The evidence lists the separate source/package differences produced by the build's HTML metadata insertion and authored route-loader generation.

The complete build log is `/private/tmp/revealline-menu-motion-build-20260929.log`; the full source snapshots are `/private/tmp/revealline-menu-motion-source-before-20260929.json` and `/private/tmp/revealline-menu-motion-source-after-20260929.json`. Snapshot times were 23:32:22–23:43:39 UTC on September 28 (September 29 locally).

This follow-up produced one web candidate. It did not rebuild desktop, iOS or the 14 standalone editions, and the earlier native/static package evidence does not establish that those packages contain this new living-scene implementation. Approximately 1.34 GiB remained free after building; no unrelated outputs were removed.
