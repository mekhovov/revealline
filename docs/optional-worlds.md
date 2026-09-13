# Optional original worlds

**More worlds** is a native Main menu entry for four optional picture chapters: FPV Front, Ukraine Atlas, 1994 Forever and Spend Network. Each has three original reward pictures over the same three proven Pressure Lines layouts, with its own campaign identity and progress. They reuse existing music, enemies and rules. They are not twelve new geometries or newly recorded soundtracks.

The [chapter source and proof guide](../authoring/library/four-worlds-chapters/README.md) records the twelve original PNGs, creative/provenance qualifications and 48 legal route proofs across both turning modes and Standard/Gentle. More worlds adds installation and selection without changing those rules or score authority.

## Player journey

1. Open **Main menu → More worlds**. This reads a small same-origin catalog, not the four chapter bodies.
2. Choose one **Install** action. The game shows its download size, checks the complete bytes and images, and commits the prepared pack through the existing atomic pack store.
3. Installation preserves an unrelated paused flight. **Choose chapter** is a separate explicit action that switches to the new chapter's briefing.
4. **Back** stays accessible at the top while scrolling; the footer also offers Back, Cancel download, Refresh and Manage packs & backups. Native focus/navigation supports keyboard and standard controller input; buttons remain usable by touch and mouse.

A failed download, image decode or storage transaction retains existing content. Cancellation suppresses stale completions. Refresh stages its catalog and installed-content inspection before replacing the visible cards. An already-installed object must match the complete normalized content digest, including artwork. A valid same-ID pack containing different art is shown as a conflict; it cannot be silently replaced or selected as the reviewed original. Manage it explicitly in Packs first.

The installed-library budget remains **48 MiB / 12 packs**, with **24 MiB per pack**. The four originals together use 44,439,900 normalized bytes before the small library envelope. Other chapters share that space, so all four may not fit alongside current packs. Nothing is evicted automatically; export a complete backup before explicitly removing content. Installed packs include their own embedded pictures and can be used without downloading them again. A first installation still needs the corresponding available HTTP(S) distribution.

## Distribution and maintenance

`game/content/optional-worlds.json` is the bounded public catalog. Each entry pins its full formatted file length/SHA-256, normalized length/SHA-256, theme, map count and campaign identity. `scripts/optional-distribution.mjs` validates those files before publishing. Regenerate these catalog records deliberately whenever authored pack bytes change; do not weaken the checks to accommodate a stale catalog.

The versioned `optionalChapters` build-config opt-in adds the four complete JSON bodies at their exact source-relative paths to the full manifest and ZIP. They remain excluded from the automatic **64 MiB core offline cache**. The small catalog is included in that cache. Raw source PNGs, prompts and provenance folders are not automatically shipped. Active/archive pack indexes stay unchanged.

Historical builds without this config field do not read or add optional bodies. The existing Git snapshot build path remains intact. The new build tests compare complete ZIP bytes without the opt-in and validate full manifest/ZIP inclusion versus core-cache exclusion with it. Custom native protocols and store packaging need their own qualification; this workflow uses same-origin HTTP(S), not a new native file-download adapter.

From the isolated implementation checkout:

```sh
node --test game/test/optional-chapters.test.mjs game/test/optional-chapters-host.test.mjs scripts/test-optional-distribution.mjs
node scripts/game-cli.mjs build --out .cache/optional-worlds/site --version optional-worlds-preview
node scripts/game-cli.mjs serve --port 8915
```

Source preview: `http://127.0.0.1:8915/game/`. The preview build is a development artifact, not a release, tag or deployment.

## Evidence boundaries

The actual-host tests execute the real app, panel, hashing, pack validation and store, with modeled DOM/Phaser/Image/IndexedDB boundaries. They cover separate Install/Choose, exact paused-run preservation, keyboard/controller focus, corrupt downloads, storage refusal, cancellation and same-gameplay artwork conflicts. They do not certify physical controllers, touch hardware or browser image rendering.

The coordinating browser review separately exercised Ukraine installation, keyboard Choose/Start/Down, a 51.5% capture, then paused installation of Retro without changing 12,060 score / three lives / 2:34. Reload/Continue retained that flight. A settled 390×844 browser viewport showed no horizontal overflow and 332×54 actions before the compact sticky Back refinement. The final sticky-control layout, a stopped-server installed-world journey, physical devices and public release qualification remain separate checks; do not infer them from modeled tests or this source preview.
