# RevealLine: delivery plan and remaining work

Updated 17 September 2026. The [execution register](cross-mode-execution.md) is authoritative; this page is its short, current view. Historical reports retain their original dates and scope.

**Accepted public baseline: [v0.60.4](https://mekhovov.github.io/revealline/releases/v0.60.4/site/game/).** P00 integration, P01 loading feedback and P02-A master sound controls are accepted within their stated gates. P03 navigation and P05 presentation remain partial. The game is playable, but the full production programme and public-release qualification are not complete.

**Active delivery:** v0.60.5 corrects Motion Lab reading preferences, paused previews, static image previews and actionable startup recovery. Its focused checks passed; the first full CI runs exposed an outdated integration assertion for the retired generic text-size hook. Source PR #93 includes the correction and requires fresh full qualification. It is not yet an accepted public release. The next prepared Team artwork candidate must preserve the full picture as an earned reward, retain the exact selected artwork, and pass actual browser play and publication gates.

## Delivery order

Complete each player-facing milestone before expanding tools and campaign volume. “Partial” means implemented foundations exist but the listed acceptance work remains; it does not mean the phase is finished.

| Order | Phase                            | Status                        | Remaining result and acceptance gate                                                                                                                                                                    |
| ----- | -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —     | P00 — Integration baseline       | Complete                      | Preserve the accepted baseline and historical editions in every later release.                                                                                                                          |
| —     | P01 — Loading feedback           | Complete in v0.57.4           | Later hosts must maintain clear progress, cancellation, failure recovery and focus ownership.                                                                                                           |
| —     | P02-A — Master sound controls    | Complete within v0.58.1 scope | Preserve shared mute/volume authority. Finished music, listening and custom playlists remain P02-B.                                                                                                     |
| 1     | P03 — Native navigation          | Partial                       | Finish all Solo/Versus/Team and supporting-screen journeys, explicit Back/Resume, focus restoration and controller/touch coverage.                                                                      |
| 2     | P05 — Readable presentation      | Partial                       | Finish consistent typography, palettes, preferences, EN/UA glyphs, Large/Plain text, zoom and reduced effects across every advertised screen.                                                           |
| 3     | P08-A — Artwork and actor parity | Partial                       | Finish exact artwork identity across modes, earned full-picture reveals, recognizable actors, heading, scale and full-arena visibility. Native Team wins and imported-content coverage remain required. |
| 4     | P08-B — Action feedback          | Partial                       | Finish consistent trail danger, capture, damage, loss/recovery, bonuses, Support/rescue and victory cues, including reduced effects.                                                                    |
| 5     | P09 — Challenge and intelligence | Partial                       | Tune fair pressure and escape routes; complete readable encounter roles and counters with versioned deterministic simulation, saves and replays.                                                        |
| 6     | P07 — Rewards and continuation   | Partial                       | Direct Retry/Next, clear mastery/unlocks, satisfying full-picture reward and optional skippable stories. Failed transitions retain results; rewards cannot be counted twice.                            |
| 7     | P02-B — Music experience         | Partial                       | Qualify uploaded MP3s and ordered/shuffled/mixed playlists in every advertised mode, complete media transfer/offline playback, and audition the finished collection.                                    |
| 8     | P04 — Creation framework         | Partial                       | Complete Studio editing, registries, previews, history, prompts and bundles; demonstrate upload → edit → export → import → play with exact original bytes and recoverable failures.                     |
| 9     | P06 — Content discovery          | Partial                       | Unified compatible-content catalogue, explicit downloads and safe replacement/removal. Interrupted installation preserves the working edition and saved flight.                                         |
| 10    | P10 — Team encounters            | Queued                        | Finish the richer First Connection and Relay Yard variants, Support, rescue, shared objectives and two-player readability.                                                                              |
| 11    | P11-A–D — FPV campaigns          | Queued                        | Four independently released campaigns of twelve missions, with complete art, actors, music, progression and rewards.                                                                                    |
| 12    | P12-A–D — DroneAid campaigns     | Queued                        | Four independently released twelve-mission campaigns with distinct Support/Combat framing and authored class interactions.                                                                              |
| 13    | P13 — Ukrainian culture          | Queued                        | Twelve complete Living Atlas missions with cultural, historical and visual review.                                                                                                                      |
| 14    | P14 — Retro arcade               | Queued                        | Twelve complete After School Arcade missions with distinct nostalgic art, encounters and music.                                                                                                         |
| 15    | P15 — Spend management           | Queued                        | Twelve complete Spend in Motion missions with understandable noncombat goals and complete themed presentation.                                                                                          |
| 16    | P16 — Supporting workflows       | Partial                       | Finish Collection, scores, replay, learning, saves/data recovery and legacy-content workflows against the navigation standard.                                                                          |
| 17    | P17 — Reproducible authoring     | Partial                       | Complete guides, AI skills/prompts, templates and CLI examples; a fresh-workspace example must be created, installed, played, exported and recovered.                                                   |
| 18    | P18 — Browser qualification      | Partial evidence              | Complete regression, performance, accessibility, media/offline recovery, human playtesting and real touch/controller/device acceptance.                                                                 |
| Later | Native distribution              | Deferred                      | Separate iPhone, macOS, Steam and Steam Deck packaging, lifecycle, signing, stores and hardware gates.                                                                                                  |
| Later | Network multiplayer              | Deferred                      | Authoritative private sessions, reconnect and failure handling; no nonfunctional online menu entries.                                                                                                   |

## Fixed gameplay and presentation contracts

- A direction tap keeps a craft moving during a cut. A capture-stop craft stops when it banks that cut on revealed ground and waits for fresh steering. Immediate and Grid + buffer remain available. Returning focus never resumes play.
- Arcade bonuses activate through play. Tactical actions appear only for an authored class/map that supports them; there is no universal Scan/Supply/Boost toolbar.
- Touch controls appear when useful, respect safe areas and stay clear of the arena. All ordinary menus require keyboard, controller and touch journeys without mouse-only steps.
- Hidden artwork is opaque black. Winning grants the complete picture without changing recorded coverage, followed by an optional skippable story. Lobby teasers must not expose an unearned complete reward.
- Pictures, actor appearances and media remain independent of collision, score and campaign identity. New mechanics use compatible level/ruleset/replay/checkpoint versions; old outcomes remain reproducible.
- Difficulty should create route choices and close escapes. Resolve unavoidable hits and unclear warnings before increasing enemy speed.

## Content accounting

The programme remains **132 future Solo missions**, not 132 delivered missions. Bulk production follows the existing three-level benchmark's gameplay and presentation gate. Team compatibility requires separate authored and tested support.

The last accepted content accounting remains **15 of 29 map families / 60 of 116 pictures, 1 of 12 victory stories, and 40 reviewed reserve illustrations**. Another three families/twelve pictures are candidates. Reserve art is not an installed campaign. The targets of **56 complete animated presentation sets** and **24 finished, auditioned tracks** remain open; body images and synthesizer recipes do not complete those targets. Thirteen delivered AI skills still require independent end-to-end authoring acceptance.

Saves, scores, Collection, packs, MP3 tooling, class interactions and couch modes have working foundations. They retain the cross-mode, transfer, media, offline and device gates listed above. Browser emulation, automated checks, audible listening, human playtesting and physical hardware are separate evidence categories.

## Release and progress reporting

Each completed phase or independently released subphase gets a scoped hunk/line review, related code/tests/docs/skills, synchronized version bump, source PR/merge, immutable release, publication PR and GitHub Pages deployment. Verify the complete deployed inventory and affected player journeys before marking it Complete. Preserve earlier releases and a rollback route.

Every execution item records its ID, priority, status, player-visible result, acceptance evidence, playable URL and remaining issue. Reports state what changed, what passed, what failed and what comes next. A successful build or merged PR alone is not acceptance.
