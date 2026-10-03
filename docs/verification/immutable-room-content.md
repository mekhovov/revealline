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
Mandatory source checks and committed-build receipts are recorded separately.

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
