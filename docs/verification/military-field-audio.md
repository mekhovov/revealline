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
| Worlds              |      102 / 15,481,834 |              104 / 15,515,242 | 104 files / 16 MiB |
| Academy             |        69 / 4,292,422 |                71 / 4,320,866 | 72 files / 8 MiB   |
| Assisted flight gym |          43 / 589,229 |                  45 / 613,903 | 64 files / 8 MiB   |

The [package admission receipt](military-field-packages.json) binds these results
to clean runtime commit `98c467d7ac074d2543bfbec127df2d11c594bf75` and tree
`50f4748b443d85feddf4ad9901afa8773a70917c`. These checks use the repository's
`v0.142.4` package version and do not grant public eligibility.

The [committed-source preparation receipt](military-field-build.json), using
candidate version `v0.143.0`, records 2,967 prepared files and 995,299,417 payload
bytes from the same clean commit. The core contains 1,340 files and 67,064,485
bytes, below its unchanged 67,108,864-byte cap by 44,379 bytes. Its build manifest
SHA-256 is `4419277d68c0803f939bd4a406e08009377213af6dd37afabaaf6dc446f4b3b7`.
Preparation used the production build path; no completed archive is claimed.

Source-manifest verification authenticated all Git blob contents and modes for
24,968 tracked files (2,352,422,896 original bytes) at that runtime commit. The
5,855,947-byte source manifest SHA-256 is
`9c70d0f504e2741171111872ba6ba6e2ab8bb6b4486618c58bc632927148aa7f`.
The subsequent verification-receipt commit changes documentation only.

Manual browser observations cover hub selection, Snake start/pause, the military
board and transparent soldiers, Capture Solo startup and sound activation, and
paired-board Versus startup/pause. No new browser errors appeared after fixing
the greybox startup path. These observations do not establish listening quality,
human completion routes or full device/controller compatibility.

## Release limitations

The full archive requires 995,804,281 bytes for the ZIP alone and 1,991,103,698
bytes for the expanded output plus ZIP. This checkout's volume had only
581,955,584 bytes available at preparation completion. The earlier ordinary committed build
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
