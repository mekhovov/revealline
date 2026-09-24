# Creator framework reference

Baseline inspected: `1deaae1a9a30c6146ecbb36c83cf43c9346a57c0` (source version 0.104.0). This is a source inventory, not a public-release or full-browser acceptance claim.

## Ownership and data flow

`ContentProjectV1 → compileContentProject → resolveMission / execution catalog → attempt preparer → practice host`

`legacy scenario → expansionFromScenario → preparePack → installed pack library → Custom mission source → ordinary Solo host`

The first path does not yet install modern projects in the second path. Phase 1 supplies a project-backed Custom source and portable media resolver instead of hiding modern data inside a legacy schema.

| Component                                             | Authority and reuse point                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `game/content-design/project.mjs`                     | Strict project compiler, references, policy and actor/difficulty catalogs; privately owned immutable compiled values |
| `game/content-design/map.mjs`                         | Map geometry compiler; revisioned map source                                                                         |
| `game/content-design/execution.mjs`                   | Explicit mode/preset execution identities; imported candidates remain ineligible for official progress               |
| `game/content-design/attempt.mjs`                     | Cancellable exact-artwork and run preparation without awarding or adopting a run                                     |
| `game/content-design/assets.mjs`                      | Bounded PNG header/dimension/hash verification and privately branded artwork                                         |
| `game/content-design/acceptance-evidence.mjs`         | Exact-target evidence; distinguishes automated, native and human checks                                              |
| `game/studio/`                                        | Editor, structural operations, checkpoints, conflict detection, source import/export and practice                    |
| `game/playground/model.mjs`                           | Existing scenario-to-expansion conversion; exports one edited map, not a rebuilt multi-mission source project        |
| `game/packs.mjs`                                      | Legacy pack validation, decoding and installed-library boundaries                                                    |
| `game/mission-library/`                               | Source registry and mission selection; current Custom adapter accepts prepared legacy packs                          |
| `game/managed-media-store.mjs`                        | Shared IndexedDB accounting, reservations, domain transactions and retained originals                                |
| `game/media-bundle.mjs`, `game/story-bundle.mjs`      | Bounded manifest plus binary bytes; existing exports cover their own domains                                         |
| `game/video-poster.mjs`                               | Header inspection, native decoding, poster capture and cancellation                                                  |
| `game/victory-story.mjs`, `game/ui/victory-story.mjs` | Exact-picture story descriptor and explicit Play/Skip/Replay                                                         |

## Formats and limits

| Format                                     | Purpose                                        | Important boundary                                                          |
| ------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `ContentProjectV1`                         | Editable map/mission/campaign/pack registry    | JSON source, not a portable media installation                              |
| `MapDesignV1`–`V3`, `MissionDesignV1`–`V4` | Versioned authored geometry and rules          | Use the generation supporting the chosen mechanics                          |
| `CampaignDesignV1`, `PackDesignV1`         | Ordered source references                      | References must resolve in the project                                      |
| `AssetRevisionV1`                          | Candidate reveal PNG pin                       | Required exact path, SHA-256, byte count and dimensions                     |
| `xonix-pack.v1`–`v9`                       | Existing runtime expansions                    | Corresponding core/level generation, strict keys; no arbitrary added fields |
| `.rltheme`                                 | Presentation records and bytes                 | Not mission progression or campaign installation                            |
| `.rlmedia`, `.rlstory`, `.rlsound`         | Managed media domain transfers                 | Not a selected campaign dependency closure                                  |
| `.rlpack` / `revealline-content-bundle.v1` | Planned scoped modern gameplay + runtime media | Phase 1 implementation; not accepted by today's importer                    |

At this baseline, project JSON is capped at 4 MiB: 512 maps, 384 missions, 64 campaigns, 64 packs and 512 assets. Each project PNG is at most 4 MiB, 8,192 pixels on a side and 16 million pixels total. Its logical path is a versioned `content-design/assets/...png` path. A portable resolver must satisfy the same checks.

Legacy packs are capped at 24 MiB each, 48 MiB installed total, 12 installed packs, 128 levels and 8 campaigns per pack. Managed media has a separate 256 MiB committed-plus-staged budget, 64 MiB individual source limit and four concurrent reservations. These budgets are independent; neither browser quota estimates nor sequential writes prove an atomic installation across them. Preserve budgets and use staging/recovery before publishing an installed index.

The video inspector bounds sources to 64 MiB, 120 seconds and 1920×1080. MP4/WebM headers and actual native decode determine acceptance; extensions and `canPlayType()` are not proof. Captured posters record requested time separately from observed frame time when available. A playback range leaves complete original bytes intact.

## Identities and revisions

Keep project, map revision, mission, campaign, pack and runtime execution identities explicit. Names and filenames are labels. Hashes identify media bytes. A gameplay edit changes the applicable simulation evidence; artwork review is separate. Do not copy an uploaded approval flag into a trusted prepared object.

Installed editions, saved attempts and earned pictures must retain their original identities. Retry/Next, save recovery and media pin ownership need runtime integration tests; preview success cannot stand in for them. A newly installed pack is Custom even if it reuses an official name.

## Repeatable source checks

From the repository root:

```sh
node scripts/compile-content-project.mjs authoring/community/example-project.json --check
node scripts/compile-content-project.mjs authoring/community/example-project.json --mission nearby-shore --mode solo --difficulty standard
node scripts/compile-content-project.mjs authoring/community/example-project.json --journey --pack opening --mode solo --difficulty standard
node scripts/compile-content-project.mjs authoring/community/example-project.json --pacing --pack opening --mode solo
```

Repeat mission resolution for Gentle/Standard/Expert and each declared mode. The example supports Solo/Versus; Team must be authored separately. Compiler diagnostics and pacing ratings are not human balance review or successful play recordings. Preserve `readyForRelease: false` where reported.

See [the creator walkthrough](creator-guide.md), [maintainer delivery](maintainer-guide.md), and [phase status](delivery-plan.md).
