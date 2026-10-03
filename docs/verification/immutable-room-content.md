# Immutable room content and pilot authoring follow-up

This follows PR #997. It advances the pilot and private-room items in the
expressive-enemy plan without qualifying the draft campaigns or deploying a room
service. No new layouts are counted.

## Changes

- Studio exposes the Living Routes pilot and chapter sources for Solo/Versus and
  Team through its existing Inspect → Apply workflow. Newer pursuit recipes use
  their correct scenario envelope. A standalone preview owns its accepted picture
  recipe instead of looking for the draft mission in an installed campaign. Locale
  refresh waits until the pursuit editor has an adopted mission.
- The six-pilot packet exports native Capture sources, Snake content and the SIM
  source/package, recording exact recipes, modes, paces, seeds and pending gates.
  An explicit command can verify an actual exported completion through the native
  replay validators. It cannot supply human/device evidence or promote a release.
  See the [pilot guide](../qualification/pursuit-pilots/README.md).
- A default-off room registry admits operator-selected immutable Community Snake
  and data-only native Team packages. Full raw byte count/SHA-256 checks precede
  native import. Only the service chooses accepted recipes; clients cannot upload
  levels, assign publication ownership or provide executable AI.
- Room preparation shows the accepted mission and package before Ready. Shared
  selections and invitations pin the catalogue identity and accepted rules. A
  missing selection is explained rather than replaced silently. Recipe SHA-256
  binds source ownership through snapshots, rematches and result exports. Imported
  result verification requires the trusted accepted recipe, not only a hash label.

The registry is an operator approval mechanism, not automatic publication
authentication. Creator/Team media needs matching verified media delivery and
rendering before admission. Current Company editions declare Solo only; they
cannot be relabeled as multiplayer. Flight content also remains unsupported in
these Capture/Snake rooms. See the [service contract](../../services/rooms/README.md).

## Manual review

The [browser record](immutable-room-content-browser.json) covers the following
local observations:

- Crossing Post: bundled source inspection, explicit Apply, exact Solo preview,
  Start, Pause at four seconds, and Close preview back to the saved draft.
- A clearly labelled local-review Snake package: two seats joined the same pinned
  mission, both chose Ready, the match reached a terminal result, and both requested
  a rematch retaining the source identity and seed. This was not a mission clear.
- A native Team package opened Pincer Yard in the Ukrainian lobby. A Company Solo
  capability link remained unavailable with its specific explanation and disabled
  Create action. No substitute mission was selected.
- At a 320×740 desktop viewport, the expanded Ukrainian source details did not
  cause horizontal overflow; Ready measured 44 CSS pixels high. This is a menu
  layout observation, not physical-phone or active-game qualification.

The review registry contained two admitted native packages/four multiplayer
entries and two unavailable siblings (Company Solo and invalid raw SHA-256).
These were local review fixtures, not newly published Community editions.
Temporary services and review tabs were closed; existing user services and tabs
were retained. Replay download was requested, but the browser returned no download
receipt, so that export is not recorded as a passed file round-trip.

## Verification and remaining work

Automated suites remain unrun under `publishing/test-policy.json`. Regression
sources cover malformed formats, preview ownership, early locale refresh, exact
native package admission, recipe/provenance substitution and room result export.
Full lint, service lint, changed-file formatting, localization/content validation,
generated appearance/audio/SIM projections and all 189 Company generated files pass.
Seven existing link warnings refer to destinations assembled by publication.

The receipts below bind source commit `b20ca9e0ed568b3f5477726083f011cc2e19f4ac`, tree
`244f148d14d2c9e169ad453290e3c459e35e5081`. Later evidence-only commits do not relabel that source.

- [Source identity](immutable-room-content-source.json): 25,061 tracked
  files / 2,358,176,094 bytes verified against raw Git blobs and modes.
- [Production archive](immutable-room-content-build.json): 2,985 manifest
  files / 1,000,053,983 ZIP bytes. Every member's bytes, SHA-256 and CRC match;
  the exact member set passes. Core uses 66,923,590 bytes, with
  185,274 bytes remaining under the unchanged 64 MiB limit.
- [Optional FPV packages](immutable-room-content-packages.json): all three pass
  independent native archive admission within unchanged budgets.
- [Pilot packet manifest](../qualification/pursuit-pilots/packet/manifest.json):
  prepared from the same clean commit, with six pilots, 32 cases and five native
  artifacts totalling 24,659 bytes. Every completion/human/device gate remains pending.

The full game build uses planned version `v0.150.0`; optional candidates retain
repository version `v0.142.4`. No published version is changed.

Next:

1. Supply actual completion recordings and human/device review for the six pilots;
   add a portable local Capture Team/Versus terminal recording path.
2. Complete media-bearing Creator/Team and Company multiplayer admission only
   after verified presentation and explicitly supported multiplayer content exist.
3. Qualify private hosting, real-network reconnects and native endpoints before
   wider online discovery. Account policies, durable rooms, asynchronous challenges
   and SIM networking remain separate stages.

No public release, deployment, merge, listening review or physical-controller
qualification is claimed.
