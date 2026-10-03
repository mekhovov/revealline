# Overhead soldiers, Military Field and shared audio

This follow-up replaces the twelve actor families' three visual casts with
transparent overhead military kits and connects every reachable gameplay host to
the shared audio services. It does not claim new vehicle physics, public release
qualification or completion of the earlier online roadmap.

## Delivered integration

- Thirty-six actor variants use compact/detailed rigs, movement-facing bodies,
  six-frame gait and notice, warning, recovery, blocked and idle states. Field
  guides and Capture Studio expose direction/pose previews. Snake removes the old
  rectangular token background. Native SIM uses corresponding soldier materials
  and equipment on its native articulated mesh.
- Military Field provides utility cars, cargo trucks, armored carriers, scout
  cars, tracked tanks, radar trucks, concrete walls, ruts and marked hazards.
  These are presentation variants of existing mechanical/terrain roles. Authored
  custom artwork retains ownership. Native SIM currently adds its existing
  utility-car appearance; additional native 3D truck/tank models are not delivered.
- Capture Solo/Versus/Team, Snake Solo/Versus/Team, FPV Worlds, FPV Academy and the
  assisted 2D flight gym share output routing, master mute/volume and semantic
  encounter cues. Studio play uses the respective gameplay host. Static previews
  do not autoplay; historical flight verification remains silent.
- Explicit Military Field hub launches apply the appearance before navigation.
  Bare appearance URL defaults continue to respect saved personal settings.
- Source-owned Capture pilot missions with intentionally absent background art
  now launch in Solo and Versus. No mission identities or background assets were
  substituted; Team already supported this case.

## Verification

Automated suites remain waived by `publishing/test-policy.json` and the user's
explicit instruction. Relevant regression sources were authored without running
them. Full configured ESLint passed, followed by targeted checks for later fixes.
Changed-file formatting and whitespace checks passed. EN/UK localization and
distribution validation passed, with the same seven pre-existing navigation
warnings. Presentation metadata remains pinned to field-kit revision 104.

Both generated source projections reproduce their checked-in bytes: Worlds has
25 modules / 890,533 bytes, and Academy has seven modules / 44,115 bytes. Canonical
sources remain authoritative; neither optional package gains an extra file slot.

Production in-memory optional-package builds, candidate construction and
independent admission passed with unchanged caps:

| Package             | Runtime files / bytes | Complete source files / bytes | Limit              |
| ------------------- | --------------------: | ----------------------------: | ------------------ |
| Worlds              |      102 / 15,481,640 |              104 / 15,515,048 | 104 files / 16 MiB |
| Academy             |        69 / 4,292,228 |                71 / 4,320,672 | 72 files / 8 MiB   |
| Assisted flight gym |          43 / 589,064 |                  45 / 613,837 | 64 files / 8 MiB   |

These package measurements are mutable-source checks, not release certificates.
Committed-source preparation and source identity are recorded separately below.

Manual browser observations cover hub selection, Snake start/pause, the military
board and transparent soldiers, Capture Solo startup and sound activation, and
paired-board Versus startup/pause. No new browser errors appeared after fixing
the greybox startup path. These observations do not establish listening quality,
human completion routes or full device/controller compatibility.

## Release limitations

The full archive requires about 995 MB for the ZIP alone, while this checkout's
volume has roughly 585 MiB available. The earlier ordinary committed build
already failed with ENOSPC. Preparation/inventory admission is distinct from a
completed archive; no successful new release archive is claimed. No unrelated
workspace or user artifact was removed to free space.

Human play, physical phones/controllers, EN/UK listening, low-end performance,
Community round-trips and network qualification remain pending. Existing Company
edition capacity and optional actor-voice package limitations remain recorded in
the [earlier verification report](expressive-actors/README.md).

See [Military Field roles and controls](../military-field-appearance.md),
[shared sound coverage and references](../shared-game-audio.md), and the
[full expansion report](../expressive-enemies-implementation.md).
