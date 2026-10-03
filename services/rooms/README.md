# Authoritative room preview

Run from the repository root with the configured Node runtime:

```sh
node services/rooms/server.mjs
```

Then open `http://127.0.0.1:8779/game/online/` with the local game server running.
The room service binds to loopback port 8783 by default. `PORT`, `HOST`, and
`ROOM_ORIGINS` configure deployment; approve exact game origins. Production game
pages need a configured `data-room-service` HTTPS origin on the HTML element.
Static GitHub Pages alone cannot host this service.

Create a room, share its single-use invitation, and have both players choose
Ready. Each browser keeps a separate ephemeral seat credential in session
storage. Invites convey only the second seat; neither URL nor catalogue exposes
the first seat credential. Controls, readiness, pause and rematch are the only
client mutations. The service resolves exact catalogue recipes and owns fixed
ticks, collisions, AI, RNG, scores and terminal outcomes. Full state snapshots
include queued controls and input acknowledgements. Pauses retain discarded-input
acknowledgements in replay receipts, and exact terminal ticks must reproduce. Rendering uses the existing
Capture, Team and Snake painters. Repeated snapshots preserve presentation
ownership and do not award local chapter progress.

The transport additionally advertises `revealline-room-controls.v1`. Every full
snapshot binds a service-owned `controlActivation` to its state identity. Ready,
Pause, input and Rematch requests must carry that current activation; the service
checks it after reading the complete request body. Pause, resume, rematch,
heartbeat pause and service-stall transitions rotate it. An already-sent delayed
input or Ready request therefore cannot affect a resumed attempt. Gameplay and
replay formats remain unchanged; clients without this control contract need a
matching deployment and a fresh room.

Five seconds without a seat heartbeat pauses both boards. A player can reconnect
for sixty seconds; both seats must explicitly choose Ready to resume. Missing
rooms are abandoned. Both players must request a rematch; it preserves the
accepted recipe and seed. Rematch generations reject stale inputs. A server
stall over 250 ms pauses play rather than advancing an unseen interval. A match
has a thirty-minute active-time/input budget. Outcome downloads contain accepted
controls and can be reproduced by `verifyAuthoritativeRoomResult`.

The browser immediately suspends local controls and presentation time after a
failed request or lifecycle interruption. At most eight controls may be pending;
queue pressure pauses the room instead of dropping a held-control release. Pause,
hide, leave, recovery and rematch retire queued commands and pending input fetches.
Recovery reads a fresh snapshot, requests a shared Pause, and observes the paused
room before offering Ready. This also clears previous readiness when restoring a
waiting room. Returning to a page never resumes gameplay automatically.

HTTP errors retain a readable `error` and add a stable `code`: stale activations
return `STALE_ACTIVATION` (409), unavailable seats `SEAT_UNAVAILABLE` (401), and
expired rooms `ROOM_UNAVAILABLE` (410). Missing seats after service restart are
terminal: the browser clears its saved credential and offers **Choose another
room** or a fresh invitation. Transient failures offer **Reconnect**. Saved seats
are scoped to the configured endpoint; they are not sent to a different service.

Public matching is disabled by default. `ROOM_PUBLIC=qualified` enables only
unranked pairing of identical recipes and seeds; deployment review, rate limits,
authentication, real-network play qualification and abuse handling must precede
public discovery. This preview does not implement account rankings or native
endpoint approval. There is no player chat or user-supplied executable content.
The browser loopback fallback applies only to HTTP development origins; native
`capacitor://localhost` does not qualify. Native schemes remain unavailable until
their separate endpoint policy is approved. Lifecycle suspension and replay
exports use the shared platform adapters.

Room loss on service restart is deliberate: an in-memory room is abandoned,
never reconstructed from a replay hash. Durable recovery needs a trusted full
snapshot store and exact engine/source deployment identity. The core provides
`checkpointAuthoritativeRoom` / `restoreAuthoritativeRoomCheckpoint` for a trusted
server storage adapter, including history and full typed state. These checkpoints
are never admitted from clients; credential retention, durable storage and restart
clock rebasing are not implemented by the preview service. Hosted account
identity, complete media-bearing Community/Company room admission, asynchronous challenges,
SIM races and shared-world flight remain separate delivery stages.

Regression cases are authored in `game/test/online-room.test.mjs`,
`game/test/online-room-client.test.mjs` and `game/test/online-room-service.test.mjs`.
They include held HTTP bodies crossing pause/resume, stale readiness, bounded
client queues and abandoned-room recovery. Automated
suites remain unrun under the current repository waiver. Local browser checks
are recorded separately from network and public-release qualification.

The server catalogue includes 258 structurally admitted native recipes: 96 Snake
Versus, 96 Snake Team, 28 Capture Versus and 38 Capture Team. New pursuit chapters
use the authored standard-difficulty execution catalogue. Constructor/snapshot
admission is not evidence of human completion or network play qualification.

## Optional operator-owned content registry

Additional content is disabled by default. An operator can set
`ROOM_CONTENT_MANIFEST=/absolute/path/to/rooms/registry.json` before starting the
service. The registry is a local, immutable startup snapshot. Players select its
exact catalogue IDs; they cannot upload levels, change publication ownership,
provide a validator, fetch URL or supply executable AI. Restart the service to
replace the registry. Existing ephemeral rooms then become unavailable under the
normal restart policy.

The manifest has the following shape (replace the example hash and size with the
**actual raw file** values; this example is not an admitted package):

```json
{
  "format": "revealline-room-registry.v1",
  "packages": [
    {
      "id": "my-snake-workshop",
      "kind": "community",
      "path": "packages/snake-workshop.json",
      "sha256": "FULL_64_CHARACTER_RAW_FILE_SHA256",
      "bytes": 12345,
      "editionId": "ed_FULL_64_CHARACTER_PUBLISHED_EDITION_ID",
      "version": "1.0.0",
      "title": { "en": "Snake workshop", "uk": "Майстерня Snake" }
    }
  ]
}
```

Operators obtain exact edition IDs, versions, sizes and SHA-256 values from the
trusted Community publication catalogue, review permission to host them and
retain the corresponding raw published downloads beside the manifest. This is
an operator approval boundary, not online publication authentication: the room
service does not contact the Community backend or automatically track unlisting.
Remove an unlisted or revoked source from the manifest and restart the service.
A player's installed receipt or a well-formed `ed_...` string is never admission
evidence. Distinct publication owners stay distinct even when native geometry is
identical.

Current supported imports:

| Native package                              | Room modes   | Presentation                                         |
| ------------------------------------------- | ------------ | ---------------------------------------------------- |
| Classic Snake portable package              | Versus, Team | Shared runtime assets; namespaced native mission IDs |
| Team portable v1/v2, without attached media | Team         | Shared native Team painter                           |

The service verifies exact byte count and full SHA-256, then runs the existing
native package importer and validators. Team package evidence is checked by its
normal import path; structural source evidence remains structural evidence.
No publication is promoted to human or network play qualification. Classic
pace and prey choices use the shared accepted-attempt preparer. Authored Team
rules remain native; no Solo board is converted into Team geometry.

Creator Capture bundles and Team media bundles return `MEDIA_UNSUPPORTED`, since
the current room painters do not preserve their verified pictures and stories.
FPV packages return `FLIGHT_UNSUPPORTED`. These do not receive playable entries.
Company capability diagnostics accept `kind: "company-catalog"` with a pinned
local `edition-catalog.json` and the logical `editionId`. The native catalogue
validator reads only that JSON and does not follow its source or asset paths.
Current Company content declares Solo only and returns `COMPANY_SOLO_ONLY`.
Future multiplayer declarations still return `COMPANY_OWNERSHIP_UNSUPPORTED`
until full production admission binds campaign bytes, brand and media ownership.
A catalogue hash alone cannot authorize a Company room. Built-in Snake offered
inside a Company site does not become a Company-authored campaign.

Limits are 32 package pins, 4 MiB per local file, 32 MiB total pinned bytes, a
128 KiB manifest, and 512 imported room entries. Native format limits can be
smaller. Package paths must be relative and remain under the manifest directory
after resolving symlinks; URLs, traversal, outside symlinks, non-files and growing
oversize reads are rejected. Invalid configuration fails startup. An invalid,
missing or unsupported individual package is quarantined while valid siblings
remain available. Neither package paths nor decoder errors reach the client.

`GET /catalogue` explicitly projects public entries and localized unavailable
reasons, plus aggregate registry counts. Startup logs and the in-process
`server.contentRegistryReport` contain per-pin status, raw hashes and diagnostic
codes, without payloads or paths. Every new accepted recipe binds its exact
catalogue ID, source kind, immutable publication ID/hash/version, accepted mission
ID/revision and shared-presentation adapter. The normal recipe SHA-256 therefore
also separates publisher ownership. Snapshots, rematches and result receipts
retain that content identity. Room outcomes remain separate from local official
Journey and chapter rewards; a reproducible receipt alone does not establish
publication authority or a server signature.

The extension seam is `inspectPinnedRoomPackage` in `content-registry.mjs`.
Future media support must add native verified media ownership, bounded service
delivery and matching client painter preparation before returning entries with
a new presentation contract. Do not remove the current fail-closed checks merely
because its simulation could run.

`game/test/online-room-registry.test.mjs` adds native admission, immutable owner,
SHA/length, malicious field, media/Company rejection, path containment, retained
snapshot and HTTP client-authority regressions. These are authored and unrun
under the current automated-suite waiver.

Explicit service lint: `node_modules/.bin/eslint --config services/rooms/eslint.config.mjs services/rooms/*.mjs --max-warnings 0`.
