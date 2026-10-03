# Expressive enemies and Living Routes implementation

This branch adds the local expansion and a private-room preview. It does **not**
represent the full online roadmap or public-release qualification as complete.
The six pilots and all chapter drafts are available for review without rewriting
the released Journey or historical attempts.

## Open the content

From the main mode selector, choose **New pursuit campaigns**. The shared hub is
`/game/hunt/`. It links Capture Solo/Versus, Capture Team, Classic Snake and the
optional native FPV SIM catalogue. **Private rooms preview** opens `/game/online/`.

- Capture chapters: `?journey=pursuit-campaigns-v1`; the pilot route is
  `?journey=pursuit-pilots-v1`. Use the normal Solo, couch Versus or Team host.
- Snake: choose **Living Routes**, then **Twin Intercepts** or **Moving Windows**.
  Select Solo, Versus or Team independently. **Board appearance → Retro Field**
  restores the green board and connected body with the animated FPV drone head.
- Existing Snake layouts: **Target rules → Varied prey** prepares an accepted
  successor. **Moving-target remix** retains the simpler Runner option.
- Existing Capture levels: enable **Running enemies**, then choose **Original**
  or **Varied**. The preparation group shows the accepted population and explains
  unavailable combinations. Changing next-attempt settings requires an explicit
  restart to replace an already accepted attempt.
- SIM: the Snake hub has eight six-course flight playlists, including **Ground
  Routes** and **Approach Windows**. These use finite unarmed native patrols.

## Delivered content

| Stream        | New layouts | Local modes                            |
| ------------- | ----------: | -------------------------------------- |
| Capture       |          24 | Solo, paired-board Versus              |
| Capture Team  |          36 | Shared native cooperative board        |
| Classic Snake |          12 | Solo, Versus, Team                     |
| FPV SIM       |          12 | Self-level, Acro                       |
| Total         |          84 | Mode adaptations are not counted again |

Classic Snake now has 96 layouts. Snake-related SIM has 48 courses. Capture's new
chapters use separate candidate source/progress ownership; promotion into the
default released Journey remains a qualification step.

The [complete inventory](qualification/expressive-content-inventory.md) names all
84 layouts. Its JSON companion contains admitted recipe identities, pace/mode
coverage, Studio provenance and explicit pending completion-route fields.
Regenerate it with `node scripts/inspect-expressive-content.mjs docs/qualification`.
This invokes production content admission, not a gameplay test suite.

## Roster and presentation

The twelve catalogue families are Lookout, Patroller, Runner, Sprinter, Courier,
Guard, Refuge seeker, Switchback, Rendezvous pair, Shield bearer, Brace trooper and
Relay warden. Tactical, Rival crews and Arcade casts provide 36 procedural visual
variants with shared compact/detailed rigs, accessories, palettes and reactions.
Native capabilities remain authoritative: armed Guards and Wardens are Capture
actors; current SIM Hunt supports unarmed patrols, not grid armor or fleeing AI.

Ordinary prey remains catchable by immediate valid contact. Shield and Brace
appear only in explicit specialist missions. Their warnings, facing and recovery
states determine contact, with native fatal/protection/enclosure ordering. The
field guide explains Goal, Tell and Counter without relying on color or audio.

Clean catches, stronger equipment breakup and graphic blood/body fragments share
actor identity and existing presentation limits. Brutality and blood remain
opt-in; remains, Reduced effects and audio are independent. Procedural actor art
does not require a downloaded frame atlas. The page artwork budget remains
32 MiB, shared across paired boards.

There are two stable EN/UK reaction scripts per family, integrated with the
existing cooldown/priority director and recording replacement workflow. The
48-job voice generation manifest produced **48 real EN/UK recordings** (868,186
encoded bytes), wired into the existing bounded voice library as replaceable
originals. Active actor families are warmed on demand. Listening review remains
pending; captions work with speech disabled or unavailable.

Native SIM uses the shared director through a checked source projection. Its
optional package remains within the unchanged 104-file / 16 MiB limits; see the
[package receipt](qualification/fpv-hunt-reactions.md). Company editions retain
actor captions, custom recordings and the existing pilot voices. Their declared
adapter omits the new built-in actor recordings instead of requesting missing
files; an optional Company actor-voice package is still outstanding.

## Studios, ownership and multiplayer

The Capture Studio pursuit panel edits accepted actors, routes, goals and pair
links through native source compilation. Classic Snake has its own editor within
the shared Studio navigation and uses runtime validators for import/export and
preview. FPV World Studio exposes native Hunt actors and the shared field guide.

Community adapters cover Creator, Classic Snake, native Team and FPV World
packages across publisher, validation, installation, previews, launch, progress
and offloading. Immutable installed editions retain separate progression;
community clears cannot unlock official Snake chapter accents. A real-account
publish/install review remains pending.

The largest Company edition remains blocked by its existing 64 MiB admission
guard: 67,592,864 bytes after integrating Theme Studio main `cf0b62e53`, or
484,000 bytes over the cap. Before that merge it was 67,559,900 bytes, compared
with 67,423,717 on main `66d83c424`. The edition menu omits unused flight data;
no package cap or brand media was changed. [Capacity details](fpv-world-package-closure.md) distinguish this from
the passing optional SIM package.

The dedicated room service implements authoritative private Capture/Snake Versus
and Team attempts, paired readiness, shared pause, once-only inputs, rematch,
60-second reconnection, exact engine/content identities, full snapshots and
reproducible outcome receipts. It binds to loopback by default and needs a
separately deployed HTTPS endpoint for a public game host. GitHub Pages alone
cannot run it. See [room service instructions](../services/rooms/README.md).

Public matching is disabled by default. Hosted authentication and abuse controls,
durable credential/state recovery, native endpoint approval, community/Company
room admission, asynchronous challenges/ghosts, SIM races and shared-world flight
are later roadmap stages, not completed features of this preview.

## Qualification and verification

Automated suites are explicitly waived. Relevant regression sources were added
without running them. Structural compilation, format/lint, localization,
distribution references, source identity and the committed-source build are
reported separately from gameplay qualification.

Manual browser observations include the hub, launch navigation, Retro Field,
EN/UK deep links, private two-seat readiness, and compact Team Snake controls.
At 320×740 the page had no horizontal overflow, all four turn buttons measured
56×56 CSS pixels, and Pause and both players' controls stayed inside the viewport.
At 740×360 the board and controls fit side by side. These checks are not a
complete device, accessibility, simultaneous-touch or gamepad qualification.

No completed human route is claimed for the 84 drafts. Each needs its pinned
qualification-seed route, supported pace/mode review, readable specialist contact,
useful Team roles, clean/brutal equivalence, low-end performance and Studio
round-trip review before public promotion. Network latency, late/duplicate input,
reconnection, backgrounding and authoritative reproduction need real-network
qualification before broader discovery.
