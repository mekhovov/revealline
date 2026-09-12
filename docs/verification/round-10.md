# Playable framework verification — 12 September 2026

The deliverable is a playable, configurable browser foundation with local source history and independent release builds. It is ready for human playtesting. Production artwork, physical-device certification and sustained replay appeal are not established by these checks.

## Play and compare

The existing development server runs on port 8767. A fresh `npm run dev` uses 8768.

| Version | What it preserves | Git revision | Local play |
|---|---|---|---|
| `v0.0.9-motion-lab` | Earlier research, authoring examples, character rigs and motion/ability studies | `c58557c` | Existing motion lab; source tag, not a packaged capture game |
| `v0.1.0` | First actual campaign, capture kernel, four worlds, five classes, responsive editor and progression | `c5e4c5a` | [Play](http://127.0.0.1:8767/releases/v0.1.0/site/game/) |
| `v0.1.1` | Unobstructed picture inspection, larger mobile controls, complete-pack paste and copyable replay verification | `76687c2` | [Play](http://127.0.0.1:8767/releases/v0.1.1/site/game/) |
| `v0.1.2` | Additional tall-window control space and a 1065×912 preview fixture | `5f539f6` | [Play](http://127.0.0.1:8767/releases/v0.1.2/site/game/) |

[Version index](http://127.0.0.1:8767/releases/) · [Live source game](http://127.0.0.1:8767/game/) · [Live playground](http://127.0.0.1:8767/game/playground/)

[Latest reveal screenshot](round-10/reveal-v0.1.2.png) · [Business-theme screenshot](round-10/spend-network-v0.1.2.png) · [Heritage screenshot](round-10/ukraine-atlas-v0.1.2.png) · [Retro screenshot](round-10/retro-v0.1.2.png)

Each release contains a static site, ZIP, per-file manifest, source archive and release metadata. Existing labels are immutable; later source edits do not rewrite an archived version. Campaign save keys distinguish development/release channel, version, campaign and campaign revision. Separate ports provide stronger origin isolation, including the shared practice handoff key. No remote repository or public deployment was created.

## Automated checks

- **225 JavaScript tests passed**, zero failures/skips: 70 preserved motion-lab tests plus 155 current game/tool tests. Current coverage includes 38 kernel, 17 content, 14 import/decode-adoption, 10 progress, 14 full-state replay, 24 input, 18 campaign-route and 20 CLI tests.
- **16 Python importer tests passed** using `/usr/bin/python3`, including original-byte preservation, incomplete inventory, bounded formats, partial failures and explicit token handling.
- **11 AI skills passed** the bundled skill validator and metadata checks. The shared prompt catalogs contain 124 templates; the reference-import guide adds 10 separate prose examples. Earlier draft-format templates remain labelled as such.
- `npm run validate` passed: 44 runtime source files, 8 levels, 4 themes and 5 classes. Three intentional links point to source-only lab/research/version pages; release builds hide those links. No unresolved executable imports or runtime resources were reported.
- `npm run format:check` passed. JavaScript is formatted, ordinary ESM; no transpiler is needed to serve the game.

Commands:

```sh
npm run validate
npm test
npm run format:check
/usr/bin/python3 -m unittest discover -s scripts -p 'test_telegram_reference.py' -v
node scripts/verify-campaign.mjs
```

### Campaign completion proof

All 8 authored maps complete under both immediate and grid-center steering: **16/16 full normal runs**. Accepted routes use the Interceptor class, ordinary movement/Boost/action inputs, normal enemies/rules and the public simulation API. They do not assign lives, cells or enemy positions. Routes retain 3 lives, finish in 5.1–16.37 seconds and reach 73.5–94.1% coverage. This establishes that routes exist; it does not establish human difficulty or balanced classes.

The bounded search examined 2,096 candidate cuts, about 1.18 million simulated ticks, in roughly 4.3 seconds on this machine. Replaying accepted inputs is much cheaper than discovering them. These are local test/search measurements, not rendering FPS or low-end device benchmarks. [Recorded routes](../../game/replays/campaign-routes.json) · [Verifier](../../scripts/verify-campaign.mjs).

## Browser checks actually performed

The desktop in-app browser loaded the source and all three frozen game releases over HTTP, including deeply nested release paths. Successful first cuts in both steering modes revealed 52.2%, retained all 3 lives, scored 8,160 and unlocked mission 2 with the first cosmetic rewards. The final release was also cleared through its normal visible controls. Source and frozen-release save namespaces began separately.

The live browser exercise covered:

- Light-carrier pickup at its supply pad: 0/1→1/1; one action consumed the charge and showed cooldown. Movement plus touch Boost used the normal simulation.
- Pause/resume and exported input release state; a completed run and an unfinished paused cut both reproduced exactly in Playground with `match:true` and no diagnostic differences. These actual UI exports are preserved as [completed replay](round-10/browser-completion.replay.json) and [paused-cut replay](round-10/browser-paused-cut.replay.json).
- An imported custom class, a custom theme, omitted optional level arrays and a fully decoded 1×1 PNG fixture. The fixture was a decode test, not new game artwork. The custom configuration reached a new full-preview tab through the explicit same-origin opener handoff and remained practice-only.
- Unknown character IDs displayed a neutral rig and warning. An uploaded body retained its selected rig's attachment anchors and a visible alignment warning. Returning to campaign restored a registered class.
- Malformed image import rejection without changing the current pack, followed by Undo restoring the entire prior pack. Complete-pack paste was exercised; native file-picker interaction and large production-image imports were not automated. An oversized automation paste failed in the browser tool; no successful large-image UI import is claimed.
- Seed generation, map/configuration editing, theme/class/steering selection and the shared-engine iframe preview.
- Completed-picture inspection and return to the same result, with no new completion event or extra award. This is a current-result viewer, not yet a persistent image gallery.
- Switching all four themes kept the completed run at 52.2% and 8,160 points; business labels changed to Insight, Exception, Complexity hub and Sync point. These are cosmetic/vocabulary changes.
- A fresh release has no missing-art warning and hides source-only navigation. No official Coupa imagery, third-party game artwork or Telegram emoji original was added to the shipped game.

### Responsive layout measurements

These are same-browser CSS iframe measurements. They do **not** emulate Safari, iPhone hardware, touch sensing, gamepad hardware or device performance.

| Fixture | Arena | Smallest gameplay control | Whole arena/actions visible | Horizontal overflow |
|---|---|---|---|---|
|390×844 portrait |358×268.5 |44×44 |Yes |None |
|844×390 landscape |353.3×265 |44×44 |Yes |None |
|1024×768 tablet |517.3×388 |44×44 |Yes |None |
|1280×720 desktop |520×390 |34×28 |Yes |None |
|320×640 compact |300×225 |44×44 |Yes |None |
|1065×912 window |682.7×512 |44×44 |Yes |None |

The last fixture caught a small control overflow outside the original five sizes; v0.1.2 reserves more space for it. [Raw measurements](round-10/viewports.json).

## Build and history verification

All three archived ZIPs pass CRC checks. Every one of 46 shipped files matches its recorded length/hash and the corresponding ZIP entry; each ZIP has 47 entries including its manifest. Distribution content is about 7.25 MB. A second v0.1.1 build reproduced the frozen ZIP byte for byte. [Release hashes and results](round-10/distributions.json).

The first snapshot attempt exposed a macOS `/var` versus `/private/var` entrypoint mismatch. Commit 58fdcc9 fixes canonical temporary paths and direct CLI invocation. A regression creates an actual temporary Git repository, builds a historical CLI through a symlinked temporary directory, verifies hashes and nested HTTP access, and checks unchanged tags/source plus immutable labels. The v0.1.0 tag was preserved; the corrected snapshot orchestrator built its original game source.

Custom build output deliberately rejects symlink-traversing parents. On this Mac, `/private/tmp/...` is the canonical alternative to `/tmp/...` for an explicit temporary output. Normal `dist/` and release commands require no path workaround. Source files and logical changes are committed; generated `releases/` remain ignored local artifacts and can be reconstructed from tags.

## XPOSED influence and next evidence gates

The implementation adopts the observed exposed-cut/reconnect/reveal rhythm, distinct live and settled contours, enemy-preserved regions, retained territory after failure, optional medals and cosmetic rewards. It adds selectable turning policies, class recipes, a boss lane with warning/recovery, versioned replay and an authoring playground. The reference audit distinguishes sampled observations from design choices and does not claim to reconstruct the original game's exact algorithm. [Reference analysis](../research/round-10-reference-and-import.md).

Telegram's public preview identified **Vector @monitoringwar** but exposed no verifiable member images. The intake CLI and skill support supplied originals and an explicit official-API path; the live API was not tested without a token. The recorded inventory is incomplete, with zero imported originals and unknown member count. [Evidence and import workflow](../research/round-10-reference-and-import.md).

Remaining gates are concrete:

1. Human playtests: safe-ground comprehension, causes of failure, preferred default steering, class usefulness, readable boss warnings, frustration and voluntary replay. No claim of measured retention or perfection.
2. Actual iPhone/Safari, physical touch/controller, focus/audio, low-end frame pacing and memory checks. Full remapping and larger desktop targets for touch-capable wide screens are additional accessibility work.
3. New curated image packs, distinct level artwork, richer actor/enemy animation, audio themes and a persistent picture gallery. Current procedural backdrops and original sprites are prototype assets; not every menu/effect/audio role is data-bound.
4. Further military/cultural/business archetypes and old experimental abilities need explicit live-trail semantics and tests. Catalog references are not automatically registered mechanics. New behavior primitives still require code; existing recipes and content can be changed without editing the kernel.
5. Native iOS/macOS/Steam wrappers, offline/service-worker behavior, signing, storefront submissions, persistence migration and external distribution. This delivery packages a static website, not a native or store-certified app.

See the [implementation plan](../round-10-implementation-plan.md), [development guide](../development.md), [asset/configuration guide](../assets-and-configuration.md), [deployment guide](../deployment.md) and [AI authoring kit](../../authoring/README.md).
