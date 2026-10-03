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
identity, qualified community/Company room admission, asynchronous challenges,
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

Explicit service lint: `node_modules/.bin/eslint --config services/rooms/eslint.config.mjs services/rooms/*.mjs --max-warnings 0`.
