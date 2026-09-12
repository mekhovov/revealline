# Round 10 — playable framework and iteration plan

The current task authorizes building the real game, retaining design studies, creating a local Git history, and testing independently playable releases. The implementation target is a complete, reviewable first campaign and a reusable authoring/runtime foundation. Enjoyment, commercial retention, physical-device performance and “perfect” presentation need human evidence; passing unit tests cannot establish them.

## The experience

**Leave safety, draw a vulnerable line, return to safety, reveal a picture, choose the next risk.** The main game remains territory capture. Abilities create opportunities around that decision. New models, uniforms, backgrounds or cultural/business themes cannot quietly change the rules.

The first release has a short authored campaign, three enemy behavior families, five useful class recipes, optional mastery medals, deterministic generated practice maps, a boss encounter, fast retry/next controls, and an editor using the same runtime. Content is deliberately modest enough to teach and test. A larger catalog can add variety through data after this loop works.

## Implementation structure

| Layer | Owns | Initial files |
|---|---|---|
| Pure simulation | Grid, trails, contacts, enemy seeds, fill, lives, class effects, goals, terminal results | `game/core/` |
| Presentation adapter | Phaser scene, fixed logical canvas, image reveal, body/attachment motion, effects and sound | `game/ui/`, `game/app.mjs` |
| Input adapter | Keyboard holds, touch controls, optional tap steering, standard gamepad mapping, focus/pause | `game/ui/input.mjs` |
| Playable content | Explicit levels, themes, semantic visual roles, campaign order and captions | `game/content/` |
| Game progress | Versioned completed-run records, one-time awards, mastery and cosmetic unlocks | `game/progress.mjs` |
| Playground | Config editing, board painting, seed generation, local image replacement, import/export, same-engine practice | `game/playground/` |
| Tools/releases | Validation, tests, static builds, checksummed ZIPs, isolated Git snapshots and serving | `scripts/game-cli.mjs` |
| AI authoring | Reference intake, visual-role adaptation, mechanic extension and regression workflows | `authoring/skills/` |

Phaser **4.2.1** is pinned, locally vendored with its MIT notice and reproducible npm lockfile. Its official release page identifies 9 July 2026. This prototype uses its Canvas presentation path, avoiding per-frame canvas-to-WebGL texture uploads while reusing reviewed Canvas attachment rigs. It is a provisional implementation choice to test, not a claim that Canvas always beats WebGL. The simulation imports no Phaser/browser state. [Official releases](https://phaser.io/download/phaser4), [CanvasTexture](https://docs.phaser.io/api-documentation/class/textures-canvastexture).

Source files use ordinary JavaScript ES modules with explicit contracts/JSDoc and Node tests. This is a refinement of the earlier TypeScript proposal: the prototype and its historical snapshots run through a static server without a transpilation step. TypeScript declarations or a later checked build can be added without relocating gameplay into the renderer.

## Runtime rules to prove

- A fixed 48 × 36 board with one-cell safe outer border; permanent walls are excluded from the coverage denominator. Device shape never changes topology.
- Immediate cardinal steering and grid-center buffered steering remain separate selectable run identities. Release stops; cosmetic banking does not steer.
- Entering unclaimed ground begins a live cut. Returning to old safe ground closes it. Self-contact and enemy contact with a live trail are dangerous. Walls block and do not close a cut.
- Contacts resolve before closure/fill and rewards. Four-neighbor components with no live field-enemy anchor are claimed; border patrols do not preserve interior regions. Enemies on both sides can leave a trail-only capture.
- Death cancels the current trail, retains old territory, consumes one life and provides explicit recovery/grace. Completion emits once; no reward comes from an animation callback.
- Classes initially provide scan/trajectory information, supply-dependent stun fields, a heavier two-charge carrier, a timed protective shield and a slowing trap. Existing experimental dash/projectile variants remain in the motion lab until their live-trail semantics are separately proved.
- A boss uses a visible warning, a bounded active lane and recovery. No invisible instantaneous attack or unannounced reinterpretation of safe ground.

Exact numerical defaults and supported fields belong to the actual validated level/class contracts. A reference catalog entry never registers an enemy automatically. A new primitive requires implementation, validation and tests; images and prompts cannot execute rules.

## Content and automation

The new executable level format is `xonix-level.v1`, distinct from the earlier draft content-pack format. The old authoring examples remain preserved design inputs. They will not be relabelled playable without an explicit compiler/migration.

Semantic roles include player body/attachments, field enemy, boundary patrol, boss, objective/support marker, supply, wall, reveal background and effects. Each supports an authored default and replaceable artwork where implemented. Main-character ability, cosmetic ownership and physical model remain separate. Ukrainian FPV, Ukrainian culture, 1994 arcade and fictional spend-management presentations share a ruleset. Brand/model names are not evidence of official endorsement or military allegiance.

The editor materializes generated levels, validates them with the runtime validator and runs them in practice mode. It supports inspectable JSON alongside a focused paint interface. Exported content contains data and allowed image sources, never downloaded executable code. Invalid imports must show an actionable error while preserving the last valid configuration.

Telegram intake preserves actual supplied/downloaded originals and records URL, hash, media kind, access evidence and rights status. The public emoji-pack URL currently needs further inventory checking; a generic Telegram logo is not a pack image. Unknown reuse permission keeps third-party art in reference intake, outside shipped assets. An AI workflow can create independently reviewed original pixel-art variants; source and derivative remain separate.

## Replay and progression

Short sessions should offer three decisions: continue to a new picture, retry for mastery, or solve a familiar board with a different class. Campaign completion advances on first clears; mastery rewards clean play and optional speed. Cosmetics do not increase power. Practice, autoplay demonstrations and imported maps cannot grant campaign rewards.

Result identity includes content revision, seed, turn policy and class. Duplicate delivery of the same terminal result cannot grant progress twice. Existing motion-lab fixture saves are not migrated into real progress. Corrupt/incompatible saves need visible recovery and preservation, with no silent overwrite.

Future extensions: collectible image packs, class mastery routes, authored boss phases, bounded enemy behavior combinations, accessibility assists, alternate fill rules and richer map generators. Add them after their challenge can be taught and their compatibility/replay identity defined. No streak loss, paid random rewards or artificial waiting is needed for replay appeal.

## Iterations and acceptance

| Milestone | Deliverable | Evidence before tagging |
|---|---|---|
| Baseline `v0.0.9-motion-lab` | Existing studies, research, asset sources and authoring tools | Local Git baseline preserved |
| Core milestone | Pure kernel and first complete cut → fill → win/loss loop | Known fill sets, self/trail contact, tie ordering, deterministic replay and terminal idempotence |
| Playable `v0.1.0` | Campaign, four themes, animated craft, classes, support markers, boss, real progress and sound | Manual browser clear/failure/retry, keyboard and visible controls, theme invariance, all content validates |
| Playground iteration | Editing, image/pack import/export, seeded practice and replay tools | Round-trip and invalid-input checks; generated level runs through the same kernel |
| Release refinement | Responsive layouts, failure fixes, docs/skills, static ZIP and archived versions | Five viewport checks, complete test suite, archive runs independently, source hashes and clean logical commits |
| Human/device review | Testers try the campaign on actual target devices | Observe readability, input/focus/audio, sustained frame pacing, frustration and voluntary replay |

Major logical changes receive commits; stable playable states receive tags and non-overwriting snapshot builds. Snapshots use different version/save identities and carry source revision information. The release index must identify playable studies versus actual game releases. No remote Git repository, public upload or storefront submission is implied by local history.

## Play-feel comparison

The verified XPOSED Reloaded references motivate a clear active line, visible coverage feedback, legible threats, immediate readable failure/recovery, and rewarding large picture reveals. We should match those observable qualities, not invent exact original physics or reuse its art. Existing frame evidence lives in the Round 05–07 research. The new source review adds current references and testable recommendations.

Playtest checklist: can a newcomer explain safe ground and danger after one attempt; do they notice why a cut only claimed its trail; is a successful large closure satisfying; can they recover without confusion; do they voluntarily choose another board/class? Record behavior and feedback, then change one variable per iteration. No retention or addiction claim is made from developer automation.

## Delivery paths and remaining gates

Browser static hosting is the first concrete distribution. iPhone browser and home-screen launch need Safari checks; native iOS uses a separately tested Capacitor/Xcode project if selected. Steam/macOS/Windows/Linux need an explicitly chosen desktop wrapper, signing/store work and physical controller tests. A generated ZIP is not an App Store or Steam build. Official API support does not prove a particular controller works; poll standard gamepads and handle disconnect/focus state explicitly. [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

Detailed implementation results, commands and remaining issues will be recorded in the development, deployment, versioning and verification guides as the build lands. Latest news or research updates require a separate requested monitoring schedule; this task performs current research without silently creating recurring automation.
