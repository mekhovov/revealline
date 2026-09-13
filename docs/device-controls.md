# Device-aware flight and Arcade R4

This correction implements the player's September 13 feedback before the next roadmap phase. The game entry, input presentation and authored mechanics change together; earlier campaign editions and frozen releases keep their own rules. [Research and primary platform guidance](research/round-38-device-controls.md) records what was inspected and what remains device qualification.

## Player contract

The intended public root journey is a native title inside the current immutable edition. The [entry correction](boot-launch.md#immutable-public-entry--p77) is now gated with ordinary-capture reliability in v0.29.2 after a previously cached mutable `/game/` mixed editions; the immutable v0.29 permalink remains playable. About, archive information and development tools are under **Main menu → Studio & extras**. A raw local HTML file cannot load the game's origin-dependent content; the independent [boot screen](boot-launch.md) keeps the old inactive page hidden and offers explicit online/local-server entry. It never transfers a profile to another origin by itself.

- **Keyboard/controller:** no permanent bottom toolbar. The top Game menu and Pause controls remain available; Restart and music belong to the menu/settings.
- **Touch Auto:** a cardinal pad appears only while flight owns input. Up is above the empty center, Down below it, Left and Right on opposite sides. Portrait uses the lower thumb area; short landscape uses side gutters. Controls do not cover the arena.
- **Hybrid devices:** deliberate keyboard/controller input hides Auto controls; a real touch brings them back. Viewport width alone never enables the pad. Every supported adapter remains usable.
- **Mouse-only:** choose Settings → On-screen steering → Always. Off explicitly hides the pad for keyboard/controller use. This preference is presentation-only, saved with the player library and included in backup/import. An omitted old value defaults to Auto without an automatic write; invalid explicit values are rejected.
- **Menus, pause, results and recovery:** no active steering pad. Explicit Resume preserves saved heading and queued Grid turn. Capture completion and recovery still need a fresh direction, according to the current map's rules.

The same original input nodes are repositioned, preserving pointer capture and keyboard/assistive handlers. Physical cleanup must never discard an already accepted fresh controller direction or erase logical heading. Joining, returning focus and holding an old key/pad remain neutral-gated.

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
