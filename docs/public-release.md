# Publish the browser game

The public artifact is a self-contained static website and downloadable ZIP. It needs no application server, paid graphics service, account system or runtime CDN. Publish the **whole distribution**, including the sibling animation assets and the original Phaser license. Native iPhone/desktop wrappers live in separate source workspaces; store distribution and network multiplayer require their own verification and services. The static website does not contain native binaries or a multiplayer backend.

## Produce and identify the artifact

Run the release checks against the intended source, then preserve that source in Git:

```sh
npm ci
npm run validate
npm run lint
npm test
npm run format:check
npm run build
node scripts/game-cli.mjs serve --root dist --port 8769
```

The root page links to solo play, the included couch race, Replay Theater and playground, privacy/storage information and credits. It uses local relative links and does not redirect the player to another origin. Open `/game/` to go straight to the game. The distribution also includes [Replay Theater](replay-theater.md) at `/game/replay-theater/`, with four verified Fieldcraft examples and local replay-file import. Keep that directory and its recordings with the rest of the version.

A working-tree build records `sourceRevision:null`; use it for review, not as evidence of a frozen release. After the intended source has been committed and tagged, snapshot that real tag using `node scripts/game-cli.mjs release-snapshot --ref YOUR_SAVED_TAG --version YOUR_RELEASE_LABEL`. Replace those placeholders with the actual saved revision and new immutable label. [Versioning instructions](versioning.md) describe the files and collision protections.

The recorded release contains a site ZIP, exact source archive and `release.json` identifying their SHA256 digests. The playable ZIP includes `manifest.json`, which identifies every output file. Keep the source archive and release metadata as the rollback record; they do not have to be exposed as public web routes.

## Static hosting requirements

Extract `distribution.zip` and publish its contents as one directory. Retain `game/`, the selected `authoring/motion-lab/` dependencies, generated icons, manifests, worker, notices and root page. No build process is needed on the host. Alternatively, publish the `site/` directory from a saved release; its additional ZIP and digest files are useful downloads.

Use HTTPS. Serve `.mjs` and `.js` as JavaScript, JSON as `application/json`, `.webmanifest` as `application/manifest+json`, SVG as `image/svg+xml` and PNG as `image/png`. A missing asset must return 404, not an HTML SPA fallback. Directory navigation should serve its included `index.html`. Do not enable a rewrite that sends every URL to `/game/index.html`.

Prefer immutable paths such as `/releases/v0.2.0/site/` and move only a separate human-readable version index. The service worker scopes itself to its own distribution directory. Avoid deploying another application's private routes within that directory. Do not overwrite a public version in place: retained offline clients deliberately reject file bytes that differ from their recorded build.

The builder generates `_headers` for compatible dedicated static sites. Both [Netlify](https://docs.netlify.com/manage/routing/headers/) and [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/headers/) document this format. Host behavior is still configuration-dependent: a nested `_headers` file is not automatically interpreted by every server, and a `/*` pattern at the host's publish root applies across that published site. For a shared host or nested release collection, apply the equivalent policy at the intended release prefix instead.

The generated policy is:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cache-Control: no-cache
```

Inline **styles** remain allowed because the renderer and responsive controls update presentation properties; executable inline scripts and `unsafe-eval` are not allowed. Data/blob image sources support validated local artwork and local exports. Only same-origin connections and scripts are allowed. Same-origin frames support the playground. This is a policy for the current static application; adding a remote service requires a deliberate design and policy change. [MDN CSP documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) explains the directive behavior.

`no-cache` permits a browser to retain bytes but requires validation for ordinary network delivery. The explicit offline worker uses its own verified cache. The local CLI applies the same headers when serving a CLI-owned build root, so release browser testing can exercise the actual policy. It intentionally leaves the source server unchanged. The generator does not set an arbitrary `Service-Worker-Allowed` header: the worker already lives at the directory it owns.

For an Nginx deployment, configure the MIME mappings and corresponding `add_header ... always` directives on the release location, then use `try_files $uri $uri/ =404`. Include the correct document root and HTTPS configuration for that installation. Those operational values are host-specific; no server/domain/certificate configuration has been provisioned by this repository.

## Privacy, saves and content

The generated `privacy.html` describes what the current implementation does:

| Data                                                                   | Where it lives                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Preferences, achievements, local scores and gallery records            | Browser local storage, separated by channel/content identity           |
| Suspended attempt                                                      | Local save slot or an explicitly exported replay-backed file           |
| Imported image packs                                                   | Browser IndexedDB                                                      |
| Playground-to-preview configuration                                    | Browser session storage                                                |
| Prepared offline game files                                            | Scope/version-specific browser cache                                   |
| Complete backups and separate library, pack, attempt or replay exports | Files explicitly downloaded by the player                              |
| Replay Theater playback                                                | Temporary in-memory state; no player-library access or progress awards |

The game has no analytics SDK, advertising tracker, account login, cloud save, public scoreboard, telemetry endpoint or network multiplayer server. It does not upload imported images/packs or player libraries. These are statements about the shipped game code. A public hosting provider still receives normal HTTP requests and may keep access logs; the publisher must describe any host-specific collection or extra services it adds.

Local results and backup files are editable by their owner. Checksums validate consistency and detect accidental changes; they are not authentication or a competitive anti-cheat system. A future public scoreboard cannot accept local save JSON as proof of an earned score.

Clearing site data removes locally stored progress, packs and offline files. Private browsing and browser storage eviction can also remove them. Keep the existing export/import controls available in the public UI. There is no hidden server recovery service. Browser offline installation is described in [offline release instructions](offline-release.md).

The generated credits page links the preserved Phaser MIT notice and distinguishes original procedural music and game artwork from design references. It does not grant new rights to third-party packs or imply endorsement by a depicted company. Telegram reference artwork has not been shipped. Publish only pack assets whose applicable reuse/redistribution permissions and attribution have been recorded. The original project code's ownership/licensing decision remains with its owner; an engine dependency's MIT license does not relicense the whole game.

## Fixed public release gate

A release can be marked ready for its **tested browser targets** once these concrete checks are recorded for the exact saved build:

1. Content validation, formatting and behavior tests pass; campaign and bundled pack proofs match current content.
2. The static ZIP and file manifest verify, and a second build from the same source/version produces the same bytes.
3. Under the production CSP, main game, playground, couch page and Replay Theater load without missing assets or script-policy errors.
4. Both steering modes complete a real level; live trails, failure, pause, focus-loss release and restart behave as described.
5. Class switch, carrier supply, signal/fiber behavior and challenge timers can be exercised through visible controls.
6. A completed picture animates, remains viewable and enters the gallery; scores and achievements survive a page reload.
7. A suspended live cut loads and continues; complete-backup export/import/Undo works; malformed files preserve previous data; a secondary tab cannot overwrite the saving owner.
8. A bundled pack installs, offers its maps/theme/classes/music, plays to completion and can be removed without corrupting the library.
9. The named responsive sizes fit; actual target devices exercise touch/controller, audio activation and reduced-effects settings. A desktop resize alone is not hardware certification.
10. Offline preparation reports a complete inventory, an offline reopen succeeds, and a second version remains separate.
11. Couch players can start, pause, finish and rematch using the documented controls and Focus boards layout. Simultaneous finishes and identical-input draws remain fair. Replay Theater verifies before playback, preserves a previous recording on failed/cancelled import, and reaches the expected final checkpoint.
12. Public entry, privacy notice, credits, license files, version links and rollback artifacts are present. The publish destination applies the required MIME types/headers and returns 404 for missing assets.

Record failures as release blockers for the affected target rather than silently broadening claims. Do not hold a tested browser release hostage to unimplemented native stores or networking; advertise its actual mode and platform boundaries.

## Scope of readiness

The v0.4.0 source supplies 25 maps, seven gameplay roles, four presentation themes and four installable expansions. Homeward Skies adds three original illustrated picture rewards; continuation and reviewed earlier-release copying extend the player library. Refer to the exact saved build’s verification report for test totals and artifact hashes. Automated results do not certify every target below.

| Target                        | Implemented or checked here                                                                       | Evidence still required before claiming that target                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Static browser package        | Main game, playground, couch mode, Replay Theater, local backups and explicit offline preparation | Exact final artifact checks, applicable browser matrix and a preserved source revision                               |
| Responsive layout             | Six same-browser CSS viewport fixtures, including focused couch controls at 320 × 640             | Physical screen, touch comfort, safe areas and sustained device performance                                          |
| iPhone / iPad browser         | Responsive controls and browser APIs                                                              | Physical Safari audio activation, touch, rotation, home-screen/offline behavior and long sessions                    |
| Controllers                   | Solo and two-player standard-gamepad adapters                                                     | The intended physical controllers, mappings, simultaneous input and disconnect/reconnect behavior                    |
| Native macOS                  | Electron shell, isolated dependencies, verified unsigned ARM64 packaging and security fuses       | Actual native UI/save/export/controller checks, publisher signing/notarization and distribution                      |
| Native iOS                    | Capacitor SPM project, bridge, privacy/MIME declarations, diagnostics and isolated tests          | Xcode compile, device storage/share/MIME/lifecycle checks, signing and provisioning                                  |
| Steam                         | Local desktop packaging foundation                                                                | Steam app/depot configuration, integration, private-branch testing and store submission                              |
| Public website                | Static files, headers template, privacy/credits and hosting guidance                              | Actual deployment to a named HTTPS host, its MIME/CSP/cache behavior, operational privacy details and rollback check |
| Network play / global ranking | Documented future protocol boundary                                                               | Server-authoritative transport, hosting, rooms, abuse controls and authenticated score handling                      |
| Enjoyment and replay appeal   | Capture/reveal loop, equipment variations, collection rewards and authored challenges             | Human playtesting, accessibility feedback, balance and voluntary replay evidence                                     |

No public-host deployment or store submission is established by generating a ZIP. Localhost CSS fixtures and automated routes do not establish physical iOS/controller results. Describe the tested browser release precisely; claims of a perfect game or certified human enjoyment would go beyond the evidence.

## Network multiplayer design boundary

The current couch duel uses two independent deterministic boards stepped together in one local process. Its transport-independent packet validator is a starting contract, not a deployed multiplayer service. Network play requires server work before its button can truthfully connect anyone.

For a future small-room implementation, use a server-owned fixed-tick simulation. Clients submit bounded inputs tagged with match, player, sequence and tick; they never submit authoritative positions, claimed cells, scores, cooldowns or rewards. The server checks the installed ruleset, map and roster hashes, validates a narrow input schema, enforces a bounded lead/late window, and sends snapshots plus acknowledged input sequence. Client prediction can improve responsiveness, while authoritative corrections decide capture and simultaneous completion. Colyseus is a reasonable JavaScript/TypeScript candidate because its official [state synchronization](https://docs.colyseus.io/state) and [fixed-timestep/input](https://docs.colyseus.io/netcode/server-input) contracts separate these responsibilities. This is a recommendation; Colyseus is not installed or running here.

Reconnect should preserve a server-owned seat for a documented short window, clear held input on disconnect, issue a full authoritative snapshot on return and reject duplicate/out-of-window commands. Decide disconnect outcome before enabling ranked play so reconnect cannot grant an indefinite pause. [Colyseus reconnection documentation](https://docs.colyseus.io/room/reconnection) provides supported lifecycle patterns; actual tokens, durations, storage and host behavior must be designed and tested for this game.

Use WSS, validate allowed origins, authenticate room membership when accounts/invites exist, bound message size and frequency per connection/player, cap queued work and apply room admission limits. Close invalid or flooded connections without retaining unbounded data. Ordinary browser WebSocket has no automatic backpressure, so transport queues and `bufferedAmount` need explicit limits. [MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) and [OWASP WebSocket guidance](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) support these requirements. A production service also needs abuse reporting, deployment/rollback, observability with appropriate privacy controls and authoritative score submission.

No credentials, rooms, account provider, matchmaking service, relay infrastructure or remote leaderboard are included in this static release. The current data-only pack boundary must remain intact: an installed pack may select registered rules and media, never provide server-executed JavaScript.
