# Device-aware flight and Arcade R4

## v0.44 integration of touch modes and steering hand

The integrated settings expose one **Steering hand** selector for floating stick,
swipe and D-pad. The same touch surface, direction buttons and ability buttons
move in native DOM order; CSS does not reverse that order a second time. Mode,
size and opacity remain independent. When importing a profile that has the older
`touchControls.side` but omits `screenSteeringHand`, that explicit side becomes
the in-memory hand preference without rewriting source bytes. An existing
`screenSteeringHand` remains authoritative; old stored touch metadata is retained.

The running short-landscape surface uses the baseline fullscreen board and fixed,
independently sized HUD/warning overlays. The earlier compact-chrome reserve rules
below apply outside that running surface, avoiding two competing arena size caps.
Opaque Pause and mission restart remain intact. The historical notes below retain
their original source and browser evidence; they do not certify this merged layout.

Integration checks passed 189 focused input, migration, actor, guide, navigation and
collection cases, plus the retained production-register/animation checks. A fresh
worktree needs its ignored `.cache` directory before running the metadata-history
fixtures directly. Actual merged short-landscape layout and physical controls still
require their separate browser/device checks.

## Steering hand — source candidate

**Settings → Steering hand → Left / Right** places the existing on-screen pad
under either thumb, outside the arena. Left is the default. Right moves the
same direction controls and, when an older map supplies equipment, places that
existing group on the other side. The arrows keep their meaning and the top
Game menu and Pause stay in place. The same two groups follow visual order in
the DOM, retaining focus and the original buttons. Arcade still shows directions
and Pause without manual equipment or Stop.

Hand placement is independent of **On-screen steering**. Auto still appears
only for touch during flight; keyboard or controller use hides it. Always also
allows a mouse. Off stays Off. Menus, pause, recovery and results do not show
active steering controls. This change keeps the existing 46px targets, compact
portrait 56px targets, safe insets and arena reserves; it adds no size preset.

The preference uses an omitted-only Left default when reading old profiles,
without rewriting their stored bytes. Save, reload, merge, import and Undo use
the actual adopted value. A refused save or practice change remains visibly
session-only. Other preferences, earned pictures and the saved flight retain
their own identities. Opening Settings keeps its existing pause/autosave; the
hand change itself does not resave the attempt, add a tick or resume flight.

Exports containing the new preference are forward transfers: strict frozen
readers may reject it. Keep native previews in a distinct profile channel;
never write the new field into a frozen edition's existing profile. Couch has
its separate two-player layout.

The [Playdigious mobile-port account](https://www.gamedeveloper.com/design/porting-i-dead-cells-i-to-mobile-an-in-depth-breakdown)
describes positioning choices and explicit menu access after playtesting.
[Playdigious also documents configurable mobile controls](https://playdigious.com/news/sharpen-your-thumbs-dead-cells-is-now-slaying-foes-on-android).
[Microsoft's navigation guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112)
supports consistent entry/exit controls and matching navigation to the changed
layout. These inform the option; comfort still needs actual playtesting.
The complete focused pair passed all23 cases on Node22 and again on Node20:
eight new preference cases, seven new actual-host cases and eight unchanged
host regressions. Source bytes stayed fixed across both runs. The host cases
use modeled DOM/input boundaries and preserve the paused checkpoint, original
controls, accepted direction and exact saved attempt (apart from the existing
Undo snapshot timestamp). They do not measure native focus or layout.
Actual target fit, warning stability and visible-input checks in both hands,
including Large text and short landscape, remain pending. Viewport or iframe
results must be labeled separately from physical touch/controller evidence.

## Return from Settings — source candidate

Opening Settings & sound from the title keeps the title beneath the settings dialog. Close, Escape and controller Back return to that same title action. Music Studio remains a child of Settings: Back returns to Settings first, then to the title. Settings entered from a paused flight returns to that paused flight; it never resumes automatically. Mission selection and saved-flight destinations still leave the title through their existing handlers.

This follows the same-input and consistent-navigation guidance linked above. Source and native verification are recorded separately; this change does not certify physical controllers.

## Stable flight feedback — source candidate

At a fixed viewport, text size and input mode, changing an encounter from quiet
to warning or active must not resize the arena. The current device layout owns
one width calculation for all encounter phases, including short landscape.
Warning text remains below the arena; it does not cover a route or move the touch
pad. Rotation, text-size changes and deliberate input-layout changes still use
their normal responsive rules.

A stationary unfinished cut says **LINE EXPOSED / CHOOSE A TURN**. This is a
presentation of the existing cutting and speed state, not a new collision or
automatic turn. Pause, recovery, capture-stop and saved steering keep their
existing behavior. Results say **Target reached**, while campaign completion
offers a replay; neither continues to instruct the player to finish a cut.

Pause actions use a full-width Resume followed by Mission brief and Main menu
on narrow portrait screens. Short landscape uses the viewport's lower safe area
instead of squeezing those actions into the narrow arena. Steering remains
hidden while paused; the existing explicit Resume contract is unchanged.

The source preview passed native browser checks at 1280 × 720: the live arena
remained 980 × 490 with Standard text and 920 × 460 with Large text across actual
eroder warning transitions. A blocked unfinished line displayed the turn prompt;
an ordinary direction escaped it and later completed the mission. Results showed
Target reached. At 390 × 844 and 844 × 390 with Large text, all three pause actions
were visible and keyboard navigation reached Mission brief and Main menu. Touch
controls were inspected using the Always preference, outside the live arena.
These are source-preview browser and CSS viewport results, not physical touch,
controller or frozen-release qualification. The embedded preview was session-only
while another tab owned saving; it was not used to claim save persistence.

The layout follows [Apple's touch-game guidance](https://developer.apple.com/videos/play/wwdc2026/358/)
on keeping controls clear of play and showing relevant actions, and
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/avoid-placing-essential-temporary-information-outside-the-players-eye-line/)
on keeping essential temporary information near the player's focus. These are
design principles applied to the browser game, not adoption of Apple's native
Touch Controller framework.

## September 13, 2026 — current chapter menu source

The current source features R5, eight current packs and four older First Light
editions (R1–R4). In All missions, **Older chapters (4)** is a native disclosure,
closed initially. A currently selected older edition opens the group when the
menu focuses its chapter. All exact native select options, installed content,
saved flights, Collection and replay identities remain available. Opening or
closing the group never chooses a pack or resumes a flight.

Tab/Shift-Tab and Enter/Space, controller directions/Confirm, and pointer/touch
activation use the existing controls. Closed chapter cards are excluded from
navigation; Back/Escape retain the mission dialog's normal behavior. The summary
has a 44 px minimum and uses the existing text-size settings. Native browser and
physical-device acceptance must still be recorded separately from source tests.

The R4 delivery history and earlier pack-count/byte measurements below describe
their original milestone; they are not current storage measurements.

## Original R4 delivery context

This correction implements the player's September 13 feedback before the next roadmap phase. The game entry, input presentation and authored mechanics change together; earlier campaign editions and frozen releases keep their own rules. [Research and primary platform guidance](research/round-38-device-controls.md) records what was inspected and what remains device qualification.

## Player contract

The intended public root journey is a native title inside the current immutable edition. The [entry correction](boot-launch.md#immutable-public-entry--p77) is now gated with ordinary-capture reliability in v0.29.2 after a previously cached mutable `/game/` mixed editions; the immutable v0.29 permalink remains playable. About, archive information and development tools are under **Main menu → Studio & extras**. A raw local HTML file cannot load the game's origin-dependent content; the independent [boot screen](boot-launch.md) keeps the old inactive page hidden and offers explicit online/local-server entry. It never transfers a profile to another origin by itself.

- **Keyboard/controller:** no permanent bottom toolbar. The top Game menu and Pause controls remain available; Restart and music belong to the menu/settings.
- **Touch Auto:** a cardinal pad appears only while flight owns input. Up is above the empty center, Down below it, Left and Right on opposite sides. Portrait uses the lower thumb area; short landscape uses side gutters. Controls do not cover the arena.
- **Hybrid devices:** deliberate keyboard/controller input hides Auto controls; a real touch brings them back. Viewport width alone never enables the pad. Every supported adapter remains usable.
- **Mouse-only:** choose Settings → On-screen steering → Always. Off explicitly hides the pad for keyboard/controller use. This preference is presentation-only, saved with the player library and included in backup/import. An omitted old value defaults to Auto without an automatic write; invalid explicit values are rejected.
- **Menus, pause, results and recovery:** no active steering pad. Explicit Resume preserves saved heading and queued Grid turn. Capture completion and recovery still need a fresh direction, according to the current map's rules.

The same original input nodes are repositioned, preserving pointer capture and keyboard/assistive handlers. Physical cleanup must never discard an already accepted fresh controller direction or erase logical heading. Joining, returning focus and holding an old key/pad remain neutral-gated.

## Training navigation

First Flight has its own non-awarding context. During an active lesson, the visible Game menu and Settings header share the same keyboard/controller navigation as the ready, paused, picture and result controls. Settings never starts or replaces the lesson. Its modal retains focus until closed.

The training menu offers Back to lesson, Settings & sound, Music on/off and How to play. Campaign selection, Collection, scores, downloads, couch and creator destinations are hidden because they cannot operate in that course session. Back to lesson restores its current briefing or result without resuming. Embedded End course hides the shell and leaves the terminal reader; the parent page owns returning to the game.

This follows the [Game Accessibility Guidelines recommendation](https://gameaccessibilityguidelines.com/ensure-that-all-areas-of-the-user-interface-can-be-accessed-using-the-same-input-method-as-the-gameplay/) to support the gameplay input method throughout menus. Source-host checks model controller hardware separately from real browser keyboard checks; neither certifies physical controllers.

## Arcade and authored equipment

First Light R4 is the new featured three-map chapter. The map sets craft/speed, and the four classic bonuses activate on contact. Completing a mission earns its picture and opens the next available challenge. Manual Scan, Supply and Boost are absent from this edition, including core processing of keyboard/controller/replay commands. Authored movement speed is 15, preserving the proven earlier boosted route pace without a held extra key.

This is an explicit validated `classic.arcadeActions: { "version": "arcade-actions.v1" }` opt-in, not an inference from a name or theme. `arcadeActionCapabilities(level)` supplies presentation capabilities; the fixed-tick simulation remains the authority. An absent descriptor preserves previous behavior, hashes and recordings.

Legacy/advanced chapters keep their authored equipment:

| Action     | What it does                                                                    | When meaningful                                                                         |
| ---------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Scout Scan | Reveals nearby hidden objectives and briefly shows moving enemy direction hints | Authored discovery/scouting objectives; no damage, slowdown, capture or invulnerability |
| Supply     | Refills a charge-based craft at a supply pad                                    | A charged craft and a map with supplies; Scout has no ammo to refill                    |
| Boost      | Multiplies current flight speed                                                 | Editions explicitly retaining manual Boost; no invulnerability                          |

Classic field pickups are independent of Supply and collect automatically on contact. Future Tactical scenarios must author meaningful objectives, charges and counterplay before exposing new equipment. Removing a button alone does not change a replay's rules.

## Catalog and storage

The active catalog contains R4 and the six other current packs. A separate archive catalog advertises R1/R2/R3 at their unchanged paths. Both are discoverable and lazily installed; existing installed/paused recipes retain exact identity. The small metadata stays in the core offline download. All three historical First Light pack JSONs are optional online downloads, as listed by Offline Settings.

No storage cap increased. Current seven normalized packs use 34,211,353 bytes; adding any one historical First Light edition remains below the existing 48 MiB installed-library limit. Installing all ten simultaneously exceeds it and must fail without replacing the working library. Validators verify both catalogs and all historical routes in bounded groups. Generate metadata with `node scripts/generate-pack-catalogs.mjs --write`; ordinary validation checks it against exact source recipes.

## Verification boundaries

See [v0.29 verification](verification/round-38/v029-release.md) for exact source/release evidence. Its 2,355 tests and all 1,207 public network files passed, but mutable-path cached-browser startup failed. The [v0.29.1 entry build](verification/round-38/v0291-entry.md) passed source/artifact checks but failed an ordinary first capture online and in a stopped-server browser. [v0.29.2](verification/round-39/v0292-capture.md) addresses this release blocker; startup/restore success must not be reported as a complete offline journey. R4 remains authored direction-only Arcade. Modeled host tests exercise real input, core, recorder, preference and backup handlers; they do not certify physical touchscreens/controllers. Browser measurements use rendered rectangles, not a claim that viewport resizing is a real phone. Direct `file://` browser navigation was denied by tool policy; independent boot tests cover that path without claiming a live browser result.

Remaining release-quality work includes actual phones/controllers, accessible large-text/lifecycle journeys, measured performance and human challenge/replay assessment. Bulk media production, Tactical demonstrations and native stores are separate roadmap deliverables.

## Short landscape arena space — source addendum

At widths of at least 681 px and landscape heights up to 540 px, the shell already hides the flight-status and run-message rows. Explicit Arcade maps can use a smaller height reserve only when their validated original level has no encounter and every authored enemy is a bouncer, border patrol or contour patrol. The presentation hook reads that original level, not a current warning phase or the surviving enemy list. Bouncer pressure cues stay on the arena and do not use the below-arena warning card. Claimed rovers, eroders, lane bosses, relay sentinels, Tactical maps and unknown future roles retain the existing 175 px Standard / 205 px Large reserve. First Flight training retains it too.

Eligible fields use 140 px Standard / 145 px Large. The existing safe-area deductions, 314 px side allowance, 46 px direction buttons, 44 px action minima, HUD text, aspect ratio and explicit Pause/Resume layout remain unchanged. Narrower landscape, portrait, tall layouts, couch and historical non-shell layouts are unchanged. At 844 × 390 with no safe insets, Large text and controls shown, the formulas permit a 490 px wide 2:1 arena instead of 370 px; these are source calculations, not measured browser sizes. Warning-capable maps do not receive the smaller reserve, so their phase changes cannot cause a layout change or lose warning space.

All three bounded helper cases passed on Node 22 and Node 20 (0.072 and 0.573 seconds), with unchanged source pins. Syntax, lint and CSS formatting passed. The native comparison remains pending. Native review must compare Standard/Large, Left/Right, controls hidden/shown, Pause/Resume and an actual warning-capable map. It must confirm complete HUD/warnings and separation between the arena and fixed controls. Viewport/iframe results remain distinct from physical-device and frozen-release qualification.

If a future accepted enemy role gains a below-arena warning card, update this eligibility contract before reclaiming its warning space; never base the decision on the current quiet phase.

## Warning and HUD width in short landscape — source correction

The subsequent 844 × 390 Large-text browser preview exposed a separate problem on Sentinel Relay: the narrow 4:3 arena also constrained its HUD and warning card, wrapping the target and clipping the instruction below the iframe. The retained screenshot is `75-relay-shield-landscape-large.png` in the presentation integration native evidence. The compact Arcade eligibility was correct; this correction addresses the full-layout branch.

For authored full-layout maps at the same short-landscape breakpoint, the panel now uses the whole center column between the controls, while only the inner arena receives the aspect-ratio and height limit. Its stable reserve is 205 px Standard / 225 px Large, including hidden, open and active warning phases. Training retains its prior layout. Text sizes, 46 px direction buttons, the 146 px pad, control side clearance and compact Arcade 140/145 px reserves are unchanged. With no safe insets at 844 × 390, the source formulas give a 506 px HUD/warning panel and a Large 4:3 arena height cap of 165 px. These are projections, not measured containment.

The three unchanged authored-classification cases passed on Node 22 and Node 20; scoped CSS formatting and whitespace checks passed. Those tests do not render CSS. Native verification of the complete HUD, instruction, control separation and stable board across warning phases remains pending. This source correction does not claim physical-device, offline or frozen-release qualification.

## Warning border clearance — source addendum

The subsequent native checks in `77`, `78` and `79` confirmed that the full HUD and warning fit and that the board stayed stable from SHIELD to LANE WARNING. At 844 × 390, the warning border still overlapped the opposite 160 px Tactical equipment group by about 3 px; its text remained readable. The full-layout panel now reserves another 8 px on each side only while on-screen controls are shown. The existing centered panel supplies this symmetric gap for either steering hand. With controls Off, the panel keeps its previous width.

This changes only the full, non-training short-landscape panel cap. The inner arena cap, warning-phase stability, compact Arcade reserves, typography and control targets are unchanged. At the same viewport with controls shown and no safe insets, the projected panel width is 490 px instead of 506 px. Final native checks must still cover both steering hands, Standard/Large text, controls Off and compact Arcade. No new rendering, gameplay, offline or physical-device result is claimed by this source adjustment.
