# Native menu implementation

This change applies to active source and generated packages. Archived release snapshots stay unchanged. The shared presentation moves existing DOM controls and keeps gameplay, route guards, storage and multiplayer ownership in their existing hosts. It does not migrate saves or create a second gameplay controller.

## Landing contract

This is the approved target, not blanket published acceptance. The September 30 public check found extra landing actions; [correction #854](https://github.com/mekhovov/revealline/pull/854) merged during this review; deployment and public requalification remain open at the [current roadmap](native-menu-roadmap.md) cutoff.

Normal landing screens contain the title (edition identity where applicable), a truthful Start/Continue action, Select Mission, Settings, Sound, supported mode names/icons, passive soundtrack information and release version. Fullscreen was added at the user’s request on 29 September 2026. Solo retains its existing landing control; Versus and Team expose a landing utility mirrored in Display & Language. These controls retain a 44px target and the shared icon/focus style. Loading, cancellation and save recovery are temporary exceptions. The selected mode is a focusable button that does nothing when activated; other modes retain their guarded links. Isolated lesson menus retain their own Help, sound and checked Return controls rather than exposing campaign destinations.

English mode names are Solo, Versus, Team; Ukrainian names are Соло, Дуель, Команда. Unsupported edition modes are hidden. A mode switch does not start a match. Existing multiplayer readiness and assignment controls retain their host behavior.

`game/ui/native-menus.mjs` is the presentation adapter. `native-menu.css` is the authoritative active landing layout. `mode-choice.mjs` supplies mode semantics; `native-menu-icons.mjs` supplies a single 16-pixel icon family. Icons are decorative CSS masks; action names remain real localized text.

Fullscreen has one browser-state owner per document, so the landing and Settings controls cannot issue duplicate requests or disagree about Enter/Exit state. Escape while fullscreen and focused inside the landing exits fullscreen without closing Home; gameplay and controller Back ownership are unchanged. Browser rejection is shown as localized status. Unsupported browsers preserve the existing iPhone/iPad installation-help handoff where available. Browser transient activation remains required; a synthetic gamepad event cannot grant it.

## Routes and capability matrix

| Host             | Current route                                   | Additional supported entry                           | Mode                           | Branding / scene                                    |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| Solo             | `/game/`                                        | `?journey=legacy`, mission-library/custom handoffs   | Solo                           | FPV / LINE; selected theme or FPV fallback          |
| Versus           | `/game/couch/`                                  | `?journey=legacy`, supported imported Versus content | Versus                         | FPV / LINE; opposing-player composition for each base world |
| Team             | `/game/couch/relay-rescue.html`                 | `?journey=legacy`, Team creator/import handoffs      | Team                           | FPV / LINE; team composition for each base world   |
| Custom Solo      | `/game/creator/player.html?edition=<stable-id>` | Installed picture-campaign player                    | Solo; qualified Versus handoff | Campaign identity; approved FPV fallback            |
| Company editions | `/game/?edition=<slug>`                         | `/editions/<slug>/app/`; legacy company launcher     | Solo only                      | Edition title/logo; original 14 mapped scenes, four newer FPV fallbacks          |

Current title and logo behavior is documented in [FPV / LINE branding](fpv-line-branding.md); DroneAid uses the public slug `droneaid` while retaining its saved internal identity.

The complete edition table is in `docs/native-menu-inventory.json`, generated from the current catalogue and checked against `game/ui/menu-scene-catalog.mjs`. Neon Arcade and FPV Field Kit change UI color treatment independently of scenery. Both support English and Ukrainian.

## Action destinations

| Settings category     | Controls / former landing destinations                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Gameplay              | Difficulty, actor appearance, gameplay tuning; Versus match options and Advanced Setup; Team arena/team setup and imports |
| Controls              | Keyboard/controller mappings, steering, sensitivity, Controller Practice                                                  |
| Audio                 | Master/music levels, playback, next song, soundtrack library, playlists and optional keyboard music shortcuts             |
| Display & Language    | Language, palette, ornaments, terrain detail, fullscreen                                                                  |
| Accessibility         | Plain/pixel type, standard/large text, reduced effects, animated backgrounds                                              |
| Progress & Collection | Collection, pictures, player library, local scores, saves, backup, profile/artwork recovery                               |
| Content & Offline     | Worlds, editions, community content, installed packs, downloads, installation, storage retention                          |
| Help & Extras         | Instructions, FPV simulator, Flight practice, field guide, demo, Replay Theater, credits, releases, creator-tool launcher |

Edition pickers live in Content & Offline; original-art recovery lives in Progress & Collection; edition sources/about live in Help & Extras. The language picker has one visible home. Runtime music transport is rendered in Audio; landing song metadata is passive. Existing Apply/Cancel behavior remains owned by each original control. Demo entry closes its Settings parent temporarily and restores the same section when leaving without a gameplay handoff.

The September 30 landing correction moves the real Collection, Help and practice controls into those sections, preserving their handlers and exact nested Back targets. Soundtrack initialization cannot append transport to a prepared native landing. Pause transport and optional music shortcuts still use the existing audio owner. See the [current restoration evidence](verification/landing-whitelist-restoration-2026-09-30.md); local qualification is separate from the pending public correction.

The installed Custom Solo player exposes four populated sections: Gameplay, Display & Language (including its accessibility preferences), Progress & Collection and Help & Extras. Its runtime has no audio owner, so it has no inactive sound/track controls. It preserves its verified runtime and saves, supports in-pack mission selection with replacement confirmation, and hands qualified Versus content to the ordinary multiplayer host.

## Visual specification

- Desktop: a 510px menu area beside scenery; generated game wordmark or 44px edition title (66px game text fallback), 22px action labels, 56px action rows; primary action warm yellow, other actions quiet dark surfaces.
- Portrait: 44px title, modes with icon above name, full-width vertical actions, independently chosen scene framing. The metadata footer sits at the screen edge.
- Short landscape (600px+ wide and <=540px tall): title/modes in the first column and the ordered vertical action stack in the second; 44px targets retained.
- Settings: eight-category rail with one panel. At <=700px, categories and panel are separate views. Confirm opens a panel; Back first returns to categories, then closes Settings.
- Standard text should fit; Large text and 200% zoom may scroll. Labels wrap between words, never inside Ukrainian words. Hidden items remain hidden even where presentation CSS uses flex/grid.
- Focus: cyan 3px outline with 4px offset. Selection: persistent yellow underline/border. Disabled controls remain visible where their unavailability is meaningful, and are excluded from navigation. Loading/error controls retain host status announcements and cancellation.
- Fonts: Departure Mono v1.500 for actions/display, Exo 2 for descriptions/metadata; Plain text retains system fonts. See `fpv-typography.md` for glyph/size/license evidence.

## Input and lifecycle

Navigation has horizontal, vertical and grid groups, with explicit layout semantics and geometry-based transitions. Focus does not activate modes. The existing router still owns controller remapping, neutral gates, duplicate activation protection, foreground ownership and multiplayer seats. Settings and nested tools restore focus to their actual parent screen. Controller field editors support English/Ukrainian text, multiline JSON, caret/selection, numeric steps and colors with Done/Cancel transactions. Native compact-dialog cancellation consumes only the first Back; sibling host listeners cannot close the screen prematurely. The stable offline launcher also uses the shared router/navigation, with no automatic action on focus or Back and a neutral input gate after lifecycle restoration.

See `menu-scenes.md` for all 18 profiles, composition source/provenance, active byte budgets and reduced-motion behavior. Scenes never modify missions or saves. Static artwork appears before motion, only the active scene is requested, and animation pauses with hidden/background/inactive hosts. Browser/OS file pickers and installation prompts are platform-owned; creator tools offer bundled in-app sources for controller-only workflows.

## Delivery status

Shared landing/Settings, typography/icons/branding, 18 scene profiles and authoring adapters exist, but the seven phases' exit criteria remain incomplete. Current scope is **18 Solo-only editions, 16 active tool routes and 16 reference routes**. Demo recording is now present in main with shared authoring input; its current 16-clip workflow needs fresh qualification. The actual Community directory still needs the shared controller owner; historical Community store/moderation evidence does not qualify the new directory or friendly-entry handoffs.

All four base worlds have distinct Versus/Team compositions in both orientations. Four newer editions still use the FPV fallback. Ambient regional motion is implemented; the original plan's richer separated layers/sprite actors and independent Solo portrait artwork remain creative deliverables. Current motion still needs representative mobile frame-time, memory and comfort evidence. Do not regenerate accepted art merely because an older checklist calls it pending.

Use the [current roadmap](native-menu-roadmap.md) for priorities and completion criteria, the [inventory](native-menu-inventory.json) for routes, and the [historical evidence ledger](native-menu-plan-status.md) for recorded workflows. Earlier screenshots and export receipts qualify their recorded snapshots, not every later PR head. The roadmap separates real implementation gaps from browser/tooling limitations and from physical-device/public acceptance.

Source compiles now cover all 18 editions at dated revisions; they do not establish installed-offline, native Xcode/device or published acceptance. Release integration and allocation remain with the established coordinator. The approved public landing correction and player safety/accessibility/device gates take priority over further historical reference-gallery work; all original scope remains tracked.

## Verification levels

Evidence is tracked separately for automated unit/host checks, local browser observation, physical hardware and published packages. A passing synthetic controller test is not evidence of a physical pad, Steam Deck, iOS or shipped desktop support. The September 28 report is historical evidence; current follow-up commands and browser observations are linked from `native-menu-plan-status.md`. Authoring tool coverage and boundaries are recorded with the authoring input implementation. Publication must use the repository release process; this implementation does not rewrite archived snapshots.
