# Play and author RevealLine

Run `npm run dev` from the repository root and open [solo play](http://127.0.0.1:8768/game/). The page uses local Phaser 4.2.1 and a browser-independent [simulation core](core/README.md). The v0.8.0 working source includes 25 maps: 12 base campaign maps and 13 optional expansion maps across Night Shift, Living Threads, Fieldcraft and the illustrated Homeward Skies chapter.

## The loop

Leave claimed ground to start a vulnerable cut; return to claimed ground to close it. The cut and connected regions without a field enemy become revealed. Enemies on both sides can leave a trail-only capture. Permanent walls block movement and are excluded from the coverage denominator. A bright centerline and tile overlay identify the vulnerable cut.

Reach the coverage target and capture required objectives. A failed cut costs a life and clears that cut while retaining earlier territory. Some maps add a mission deadline, a cut deadline or a maximum trail length; zero disables each limit. Other clocks only affect medals. Victory reveals the whole picture, plays a skippable celebration and retains the actual captured percentage in the result.

Copper Orchard also offers the optional **Steady Signal** seal: close one cut through eight distinct active interference cells with signal-resistant equipment, then finish without losing a life. The goal tracks open-line and closed-cut progress separately, survives verified saved-flight restoration, and is replay-checked before being added to your collection. Each retained setup lists its class route, steering mode and seed. Ordinary wins still unlock the picture and next mission. See the [mastery guide](../docs/round-17-mastery-increment.md) for exact rules, local record limits and authoring boundaries.

River Switchyard adds **Supply Line** for successful refills, closed suppressed crossings and a switch at the southern hangar. Home Beacon adds **Safe Return** for a live-cut impact pulse, completed recovery and clean finish. Pause shows named requirements, while flight keeps a compact summary. See [all three equipment seals](../docs/equipment-seals.md) for their distinct rules and supported authoring formats.

The campaign introduces bouncers, border patrols, supplies, objectives, obstacles, a telegraphed lane boss, signal interference and hangars. FPV Front, Ukraine Atlas, 1994 Forever and Spend Network change presentation. The business world is an original Coupa-inspired metaphor, not official product behavior or real customer savings. Military classes use fictional arcade abilities rather than real operational specifications.

## Solo controls and classes

| Input | Action |
|---|---|
| Arrows / WASD | Move in four directions; release to stop |
| Shift | Boost while held |
| E | Use the active class ability |
| R | Collect supplies when nearby and applicable |
| Escape / P | Pause or resume |
| Touch direction buttons | Hold to move; optional Tap steering latches direction, tap again or press Stop to clear |
| Standard gamepad | Release then press a face button to join. D-pad / left stick moves; South ability, West supply, North hangar, East Stop, right shoulder boost, Menu pause |
| G / Change craft control | Choose another available class while safely docked |

With the default map, D-pad moves menu focus, South confirms and East goes back. Selects and sliders preview a value before applying it; East cancels the edit. See [controller navigation](../docs/controller-navigation.md) and try the actual menus in [Controller practice](controller-lab/). **Settings → Controller controls** lets you change the complete flight/menu maps, choose position/Xbox/PlayStation labels, select or invert sticks and tune press/release thresholds. Apply adopts the whole draft; Cancel and closing Settings preserve the current layout. Help and edit previews use your selected labels. These solo preferences are not yet shared with couch play or Replay Theater. See [controller settings](../docs/controller-settings.md) and [forward-compatible profile transfer](../docs/controller-preference-migration.md). Pause and focus loss clear held input. Touch Boost follows hold or tap steering, and Stop clears it. Controller adapters and viewport fixtures do not certify particular hardware.

**Immediate** turns at the current position. **Grid + buffer** turns at cell centers and buffers the latest held direction. Releasing clears that buffer. The board remains 48 × 36 cells at every viewport size. Starting-class or steering changes in the flight deck start a fresh attempt; the in-flight hangar changes class within the existing attempt.

| Class | Ability and tradeoff |
|---|---|
| Scout | Scan marks objectives and briefly shows enemy direction hints |
| Light carrier (`bomber`) | Collect one charge, then place a temporary enemy-stunning field |
| Heavy carrier (`carrier`) | Carry two charges of the same stun-field ability |
| Interceptor | A temporary shield can absorb one enemy/lane contact; it cancels the cut and recovers at home |
| Fiber relay | Scan and ignore signal interference; the live cable/trail remains vulnerable |
| Impact craft | Stun nearby enemies, abandon the unfinished cut and redeploy without losing a life; no territory is granted |
| Trapper | Collect a charge to place a slowing field |

A hangar switch requires safe ground, no live cut and the configured cooldown. Each class retains its ammunition and cooldown; switching does not refill it. Maps can disable switching by declaring no hangars. Body, palette, rotor animation and theme are separate from these gameplay recipes.

## Keep progress and pictures

Campaign clears award local progress, medals and cosmetic unlocks. **Collection** contains unlocked bodies and completed pictures; pictures can replay their celebration. Search the gallery and browse 12 pictures per page. **Library & saves → Local scores** searches results grouped by map and exact setup, including class changes, with ten setup groups per page. These are device-local records, not authenticated global rankings.

For a complete transfer:

1. Choose **Library & saves → Saves & loads → Export complete backup**. It includes the library, installed packs and a snapshot of the current unfinished campaign flight; without one, it includes the existing suspended flight if present.
2. On the receiving browser, use **Load a saved JSON file**, or paste the JSON and choose **Load this JSON**. The complete backup replaces those three parts together after validation.
3. Choose **Load suspended attempt** to continue the restored flight. **Undo complete backup import** restores the previous collection, packs and flight while this page remains open.

Export before importing if you want to retain both collections after a reload. The separate library, installed-pack and attempt exports remain available. The [full-backup guide](../docs/full-backup.md) explains limits and interrupted-import recovery.

One game tab owns saving for the profile. Additional tabs remain playable and exportable with session-only progress and settings. Close the owning tab, then reload the second to make it writable; export session changes first. The app displays a warning instead of letting the second tab overwrite the owner's preferences or progress.

The capacity display in **Saves & loads** shows usage against 512 campaigns, 4,096 picture records and a 4 MiB profile budget. Old pictures are preserved. Export archives before capacity is reached; the interface will not silently delete earlier pictures to store a new collection.

Attempt loading reconstructs and verifies recorded gameplay before adopting the run. A replay export by itself is a verification document; use an attempt export to resume. Storage errors are reported, and incompatible/corrupt data is preserved for recovery. Browser storage can be cleared or evicted, so downloaded backups matter. See [library/pack contracts](../docs/library-and-packs.md) and [replays and sessions](../docs/replays.md).

Development and each archived release keep separate profiles. **Bring progress from an earlier release** reviews and explicitly copies a compatible collection on the same browser origin, preserving the earlier release. Copy checks the source again and requires a new review if it changed. Use a complete backup file for another browser, address, port, device or native origin. Earlier v0.1.x saves require an explicitly compatible migration. See [continuation and release copying](../docs/continuity-transfer.md).

## Add variety

In **Library & saves → Expansion packs**, install a bundled example, import a `xonix-pack.v1` file or import an exported pack library. Select its campaign to play its maps and earn its own progress. Invalid imports preserve the previous installed content; removing a pack retains player records so reinstalling can restore its pictures. Packs select supported rules and media; they cannot execute scripts, introduce an unregistered algorithm or fetch remote media.

[Fieldcraft](../docs/fieldcraft-challenges.md) explores resistant signal crossing, bomber supply and emitter suppression with a hangar switch, an Impact recall and slowing nets. Its maps also retain ordinary completion routes for every built-in class. These are alternate approaches to playtest, not promises that one class is mandatory.

**Challenges** provides date-selected Daily route, Open skies and Pressure run boards. Earlier dates remain playable; no login streak expires. Generated boards are candidates and are not all covered by the authored campaign completion fixtures.

Settings offer synthwave, chiptune, rock, metal and ambient music, independent master/music/effects levels, a preview and Reduced effects. Sound requires user activation. All tracks use original oscillator/noise arrangements; expansion descriptors can select tempo, tonic and scale. The four world families have distinct picture finales. Read [audio and rewards](../docs/audio-and-rewards.md).

## Watch a verified run

Open [Replay Theater](http://127.0.0.1:8768/game/replay-theater/) to watch four recorded Fieldcraft examples: signal-resistant flight, supplies with a hangar switch, Impact recovery and a slowing net. It starts paused and stays silent. Choose **Play**, **Pause**, **Restart**, **Step 1 tick**, or **0.5× / 1× / 2×** speed. With the canvas focused, Space toggles playback and Right Arrow steps one tick. Four theme choices change only the presentation.

Import your own `xonix-replay.v3` file, or paste JSON under **Import your own replay → Verify and load JSON**. Verification must finish before the new recording replaces the previous one; **Cancel load** cancels adoption. The theater reads no player library and awards no scores, pictures or progress. Its progress bar is a readout, with no arbitrary seeking or control over the recorded craft. To continue an unfinished flight yourself, use a saved attempt in the main game. See [Replay Theater](../docs/replay-theater.md) and [recording/export](../docs/replays.md).

## Couch race

Open [Couch race](http://127.0.0.1:8768/game/couch/) for two independent boards with the same map, class, seed and steering. Choose a 30-, 90- or 180-second round. First clear wins; simultaneous clears can draw. At timeout, coverage, lives and then score decide. A series is first to two points.

| Action | Player 1 | Player 2 |
|---|---|---|
| Move | WASD | Arrows |
| Ability | Q | Enter |
| Supply | E | / |
| Boost | Left Shift | Right Shift |

Escape pauses both boards. **Focus boards** hides setup and secondary controls to keep both arenas and control sets in the shared viewport; **Show setup** returns to configuration. Starting a round enables focus automatically. Each side has touch controls, and two standard controllers can drive separate players. Couch results are separate from campaign rewards. This is a local race, with no shared-arena co-op or network connection. The focused couch layout was checked in the same browser at six CSS viewport sizes, including 320 × 640, with 44 CSS-pixel control targets. This is layout evidence, not physical-device or controller certification. The [public-release guide](../docs/public-release.md) describes the future network boundary.

## Create and share

The [playground](http://127.0.0.1:8768/game/playground/) edits map/theme/class/rule JSON, paints signals and hangars, imports expansions, replaces eight image roles and exports playable scenarios or a new one-map expansion. Fiber, Bomber and Impact presets exercise their actual interactions. **Play configuration** uses the same engine in practice mode, which grants no campaign rewards. Its six embedded screen-size fixtures are layout tests, not device emulators. See [the playground workflow](../docs/playground-runtime.md).

The separate motion lab, legacy draft packs and media library retain their own formats; they require an explicit adapter where their data differs. AI-assisted game changes should use [Runtime Maintainer](../authoring/skills/xonix-runtime-maintainer/SKILL.md) and [Expansion Author](../authoring/skills/xonix-expansion-author/SKILL.md) with the relevant art/design skill.

The [authored-art workflow](../docs/authored-art.md) covers source preservation, optional AI styling, map-specific embedded pictures, pack rebuilds and actual reveal/gallery checks. Homeward Skies supplies three original illustrated examples with separate source files and effective prompts.

The static distribution includes **Prepare offline play** in Settings. Preparation must finish online before an offline reopen; source previews do not register a worker. See [offline instructions](../docs/offline-release.md), [development](../docs/development.md), [public release](../docs/public-release.md) and [saved versions](../docs/versioning.md). Native store packages and physical phone/controller/audio/performance checks remain separate from browser layout and automated simulation evidence.
