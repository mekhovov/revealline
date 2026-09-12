# Round 10 — Telegram references, XPOSED feel and the renderer boundary

Reviewed 12 September 2026. This round accessed the public Telegram preview and current primary engine documentation, then synthesized the already inspected Reloaded footage. It did **not** inspect new Telegram member artwork, watch new Reloaded footage, audition audio, run the commercial game, or measure retention. The proposed timings and acceptance targets below belong to our game.

## Telegram pack: verified access and actual limits

The requested [Vector @monitoringwar emoji pack](https://t.me/addemoji/vector_monitorwar) resolves publicly. Its HTML identifies the title and `tg://addemoji?set=vector_monitorwar` action. The page contains no member images, emoji IDs, count or item thumbnails. Its social image is Telegram's generic logo, which is **not** pack artwork. A search for the exact short name did not provide a verifiable alternate item inventory; this is a bounded search, not a claim that none exists.

The actual response is preserved without modification in [preview.html](evidence/round-10/telegram-vector-monitorwar/preview.html), with its SHA-256 and parsed metadata in [manifest.json](evidence/round-10/telegram-vector-monitorwar/manifest.json). The inventory reports **zero imported originals**, an **unknown** member count and `inventoryComplete: false`. It does not claim the pack is empty. Treat the HTML as source evidence; do not inject its scripts into the game or authoring UI.

No genuine emoji image was available to inspect from this page, so no claims about this pack's silhouettes, palette, animation style, individual vehicles or ownership are made. No account was opened, no credentials were sought, and no unofficial downloader or authentication bypass was used. The user has authorized reference access/import; this is distinct from establishing redistribution rights. The importer records `rights.status: unknown`, `usage: reference-only` and `shippingEligible: false`. These are authoring records, not a technical publishing enforcement system or a legal ruling.

### Working import paths

[scripts/telegram-reference.py](../../scripts/telegram-reference.py) uses Python's standard library and offers three explicit modes. Output must be a new or empty directory, preserving previous imports.

```sh
# Public metadata only. This does not download candidate images.
python3 scripts/telegram-reference.py preview \
  --pack https://t.me/addemoji/vector_monitorwar \
  --out references/vector-preview-01

# Import files supplied/exported by the user; originals remain byte-identical.
python3 scripts/telegram-reference.py local \
  --pack vector_monitorwar --out references/vector-originals-01 \
  /absolute/path/to/selected.png /absolute/path/to/animation.tgs

# Official API metadata, with a hidden terminal token prompt.
python3 scripts/telegram-reference.py api \
  --pack vector_monitorwar --out references/vector-api-01 --token-prompt

# Explicitly request original files as well. No token is placed in this command.
python3 scripts/telegram-reference.py api \
  --pack vector_monitorwar --out references/vector-api-originals-01 \
  --token-prompt --download --max-items 200
```

The API route uses Telegram's read-only `getStickerSet` and `getFile` methods. A bot token is required. No token was supplied this round, so the live API import is **unverified**; the implementation was exercised with offline responses. Metadata includes format flags and stable file/emoji identities when returned. Download links contain credentials, so the importer neither persists nor logs those links. An explicitly named environment variable can replace the hidden prompt with `--token-env MY_CHOSEN_TOKEN`; the script does not discover credential files or inspect unrelated token variables. [Official Bot API](https://core.telegram.org/bots/api#getstickerset), [file retrieval](https://core.telegram.org/bots/api#getfile)

Static PNG/WEBP, animated TGS and video WEBM originals are supported. The importer performs limited format/metadata checks, hashes bytes and stores content-addressed originals. It does not rasterize, recolor, resample, decode video, create atlases or execute animation content. TGS JSON inspection is bounded; its original compressed bytes are retained. PNG checks cover the header, WEBP/WEBM checks identify containers, and these checks do not certify full decoding or visual quality. Telegram documents these distinct media formats; vector animation and video must not be silently treated as static sprites. [Telegram media formats](https://core.telegram.org/stickers)

Local pack membership is `user-asserted`; API membership is `official-api`. Identical original bytes share storage while retaining separate source records. The API's `--max-items` bound is explicit: a truncated inventory is marked incomplete, and failed original imports appear in `errors`. The CLI returns nonzero for partial/fatal failure. All imports stay separate from the production media library and runtime; a reviewed derivative needs its own identity and bindings.

For a manual path, open the pack normally in Telegram, identify the desired emoji, and use any Save/Export functionality that the installed client actually exposes, or ask the creator for original files. Do not promise a universal “export this whole emoji pack” command: none was verified here. Feed supplied originals into `local`. A screenshot can help visual discussion, but must be recorded as a screenshot rather than an original transparent asset.

In this host, Homebrew Python 3.14's trust-store verification rejected the HTTPS certificate chain; `/usr/bin/python3` succeeded with TLS verification enabled. That interpreter was used for the actual preview. The script never disables TLS checks. On other hosts use a correctly configured Python trust store rather than an insecure flag.

## Preserve the Reloaded loop, improve its legibility and repeat rhythm

The strongest reference is the interaction cycle: inspect a desirable picture, choose a route, commit an exposed cut, reconnect, see a meaningful region become yours, recover from a readable mistake, and decide whether to improve a medal or unlock another image. This is a design interpretation of observable play, **not measured evidence of addiction or retention**. The [official Reloaded listing](https://store.playstation.com/en-sa/concept/10002881) emphasizes picture exposure, simple controls and progressive pack unlocks. The following recommendations use our [Round 06 mechanics audit](round-06-reloaded-observations.md) and [Round 07 motion/UI audit](round-07-reloaded-ui-motion.md), where the unaltered evidence frames are linked.

| Verified reference | What to preserve or change in our game | Testable acceptance proposal |
|---|---|---|
| Pack 6 [0:11](https://www.youtube.com/watch?v=-qG4k6dkd-c&t=11s): bright player head leads the live cut; older line cools. Completed contours are quieter. | Bright navigational center, unfinished path and settled contour are separate visual roles. Compact emoji-inspired bodies and detailed drones can share the same center. | At normal desktop and portrait size, reviewers identify player, live cut and legal frontier within two seconds. Hiding decoration leaves identical geometry. |
| Pack 6 [0:20–0:24](https://www.youtube.com/watch?v=-qG4k6dkd-c&t=20s): a long closure yields only a narrow 1/70 corridor; [0:37–0:39](https://www.youtube.com/watch?v=-qG4k6dkd-c&t=37s) fills a larger pocket. | Teach closure first, then how relevant enemy occupancy preserves regions. Do not promise every long line a huge reward. | Two authored boards deliberately demonstrate corridor-only and pocket-fill outcomes. The chosen fill policy is documented and tested; it is not labelled an exact reconstruction of Reloaded's unknown full algorithm. |
| Parker [4:56–5:03](https://www.youtube.com/watch?v=SKKvpZ2DvUY&t=296s): the speed pickup remains after its area is revealed and triggers on player contact. | Distinguish revealing a pickup from collecting it. Use an unmistakable pickup cue and effect-state readout. | Enclosure leaves the pickup available; first contact grants one effect; repeated overlap cannot grant duplicates. |
| Foreseen [2:28.1–2:29.4](https://www.youtube.com/watch?v=HEM9_sQGRJQ&t=148s): failed cut disappears, a life is lost, earned geometry remains and the player reappears about 1.2 seconds later. | Keep failure local and comprehensible. Differentiate collision location from respawn position. | Test 0.6/0.9/1.2-second recovery candidates; confirm existing territory persists under this selected ruleset, inputs do not leak across recovery, and reduced effects preserve the failure explanation. |
| Foreseen [3:00–3:30](https://www.youtube.com/watch?v=HEM9_sQGRJQ&t=180s): play continues after TIME reaches zero. | Treat a medal clock and a mission deadline as different authored goals. | Medal expiry does not kill the run. A true time-limit challenge names that condition before play and uses its own ruleset identity. |
| Pack 6 [2:33–2:45.5](https://www.youtube.com/watch?v=-qG4k6dkd-c&t=153s): quota, artwork, stars, bonuses, final actions arrive in sequence. | Preserve the order but shorten waiting for repeat attempts. | Prototype capture emphasis 0.25–0.5s, first-clear art moment 1.5–2.5s, medal spacing 0.2–0.35s and tally 0.6–1.0s. First deliberate confirm completes the sequence; a later fresh confirm chooses an action. No accidental next-level launch. |
| Pack 6 [0:00–0:05](https://www.youtube.com/watch?v=-qG4k6dkd-c&t=0s): gallery → full-picture preview → same selection. | Make collected art worth revisiting. Use a touch toggle in addition to any hold shortcut. | Preview and return preserve selected level and scroll position; unlocked picture inspection is available without replaying the level. |

Reloaded's sampled result sequence took roughly twelve seconds to show final actions; this does **not** prove it was unskippable. The footage does not measure button latency, buffered input duration, invulnerability, gamepad dead zones, touch ergonomics or audio. No timing above should be attributed to its source code.

The developer's [Celeste & Forgiveness](https://www.mattmakesgames.com/articles/celeste_and_forgiveness/index.html) describes explicit buffering and intent-preserving adjustments. The relevant lesson is to define assistance precisely. Our already requested **immediate** and **grid-center buffered** modes should both remain selectable and versioned. Do not silently add platformer-style corner correction or change capture geometry to emulate Celeste. Compare equivalent commands within the same selected policy; visual banking never postpones a legal move.

For repeat motivation, offer new authored shapes and readable combinations before increasing raw speed: open pocket, comb corridors, offset islands, hollow rectangles, narrow gates, mixed-terrain pockets, then an exposed-ground or contour threat. Use optional clean-run and speed medals plus cosmetic/image collections. Avoid requiring losses, repeated trivial clears, paid randomness or streak pressure to access the core variety. Whether players actually want another run must be tested with a small playtest, asking what they intended, why they failed, and what they want to try next; analytics alone cannot establish those answers.

## Renderer recommendation: Phaser for the game, Canvas for the existing authoring lab

The current official stable release is **Phaser 4.2.1, released 9 July 2026**. Both the [official download page](https://phaser.io/download/release/v4.2.1) and [release record](https://github.com/phaserjs/phaser/releases/tag/v4.2.1) agree. This changes earlier assumptions that Phaser 4 is only a release candidate. The release specifically fixes stencil clearing/inversion, ESM references and parent-container resizing; these are relevant to reveal masks and a frontend application host.

**Recommendation:** pin `phaser` to `4.2.1` for the playable vertical slice's renderer/input/audio/scene adapter. Keep the existing lightweight Canvas lab useful for immediate art and control experiments. The first Phaser scene may also use its Canvas renderer to reuse existing drawing code; adopting the framework does not require adopting WebGL effects immediately. This is a maintenance decision for this project, not a claim that Phaser is universally faster or that the current Canvas renderer cannot implement Xonix.

| Layer | Responsibility |
|---|---|
| Pure game kernel | Fixed-step positions, cut topology, collision order, fill, terrain lifecycle, enemy rules, seeded randomness and terminal results. No sprites, DOM, renderer clocks or shader state. |
| Phaser adapter | Scene lifecycle, texture/atlas loading, display objects, audio, input normalization and mapping kernel events to presentation. Phaser's [scene model](https://docs.phaser.io/phaser/concepts/scenes) supports separate menu, game and HUD responsibilities. |
| Responsive shell | Reflow controls/HUD while retaining the authored logical board. Use an aspect-preserving fit; [Scale Manager FIT](https://docs.phaser.io/phaser/concepts/scale-manager) is distinct from resizing the logical game area. |
| Authoring tools | Existing JSON catalogs, source manifests, media originals and Canvas preview remain independent. Changing artwork does not rebuild rule identities or rewrite levels. |

Phaser 4 rebuilt WebGL rendering and changed filters/masks; do not blindly paste a Phaser 3 mask or pipeline example. Implement the first reveal renderer against the pinned version's actual APIs, then compare output with the kernel's boolean ownership mask. A simple CPU mask/texture bridge is a reasonable first step; elaborate lighting and post-processing can follow measured need. Keep the source background immutable and build a separate display mask. [Phaser 4 release changes](https://github.com/phaserjs/phaser/releases/tag/v4.0.0), [render texture concepts](https://docs.phaser.io/phaser/concepts/gameobjects/render-texture)

Packaging remains a distinct task. Phaser's [official Capacitor tutorial](https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor) demonstrates the mobile wrapper route and identifies native tooling requirements. Browser compatibility does not automatically establish iPhone App Store, Steam, signing, controller certification or low-end performance. Validate browser play first, then real iPhone/Safari and controller use, and only then package. Godot remains viable for a team wanting a native editor and its scripting workflow; it is not the first choice for this frontend-oriented codebase merely because an AI generator targets it.

Before broad engine migration, the adapter must pass: identical kernel state/results for the same seed and commands across 30/60/120 presentation FPS; exact reveal-mask agreement; keyboard/touch/controller cancellation on pause/focus loss; portrait/landscape fit without hidden cells; separate art and rules; and successful replay after results without stale listeners or duplicate awards. These are acceptance criteria, **not completed device tests**.

## Deliverables and verification

- [Reference importer](../../scripts/telegram-reference.py), with [16 offline tests](../../scripts/test_telegram_reference.py). Tests passed using `/usr/bin/python3 -m unittest discover -s scripts -p 'test_telegram_reference.py' -v`. Independent forward checks also exercised partial imports; malformed API objects and local write failures now produce per-item errors while preserving earlier successful provenance.
- [Actual public preview inventory](evidence/round-10/telegram-vector-monitorwar/manifest.json), produced over verified HTTPS. No Telegram original art imported this round.
- [Xonix Reference Importer skill](../../authoring/skills/xonix-reference-importer/SKILL.md), including manual/API guidance and prompts for silhouette analysis, original art directions and independent visual bindings.

The bundled skill-creator validator passed using the existing `/tmp/xonix-skill-check-20260912/bin/python` environment. Local Markdown links and Python compilation were also checked. The importer has no third-party Python dependency.

The importer adds no runtime bindings, makes no external posts, changes no collection rewards and performs no image editing or conversion. Live Bot API behavior and actual emoji visual analysis remain pending supplied access/files; the public preview and local/offline import paths are concrete and reviewable now.
