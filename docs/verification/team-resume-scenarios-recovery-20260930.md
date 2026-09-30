# Team Resume coverage recovery

Source basis: 1e0fa85b048ce7ebbf8732632e001b83e5a90ac4. Historical donor: PR #757,
541d7fcde298ccddffe3f683698bf890212db766.

The existing four tests in coop-resume-down-warning.test.mjs remain byte-for-byte
unchanged. This companion restores six missing scenario intentions, not a new
runtime implementation or an assertion that those tests have passed:

- Both seats: Pause, native Settings Accessibility, Large/plain text, Resume,
  and an English/Ukrainian/English round trip without advancing the checkpoint.
- Reconstruct the retained rescue cause after an actual Support pulse temporarily
  replaces its message. A closed authored chamber keeps the moving drifter near
  the stationary partner; only the first seat uses the legal self-cross route.
- Retire the retained cause after an ordinary reserve revival.
- Retire it after a completed partner rescue without spending a reserve, using
  the current terminal-HUD public-command route and host replay.
- Preserve the travelling-impact cause and correct specialist rescue target.

## Current-source adaptations

The donor reverse-turn shortcut is not restored. The new cases use the legal
quarter-turn route already in current tests, or the current Relay Yard route.
Settings uses Accessibility, not the removed Display tab. Revivals and specialist
impacts wait for an observed HUD state within a finite frame limit, rather than
assuming the old movement timing. No host player position, collision, reserve,
knockdown memory or simulation timer is injected. The route helper operates a
separate core and sends the resulting public keyboard commands to the host.

The actual current resume() reconstructs a message from the downed seat and its
retained event. player.revived clears that event for reserve and contact rescue.
These source paths were inspected; that is not runtime execution evidence.

## Verification and limits

Only syntax parsing with node --check and formatting were run locally. No test
module, product simulation, build, producer or compiler was executed. The six
recovered cases still need their first exact-source execution in the deferred
test follow-up (#813); old donor receipts do not qualify these adapted fixtures.
Full tests remain WAIVED_SKIPPED_NOT_PASSED. Required protected merge gates remain.

No runtime, save schema, locale data, generated asset, approval fingerprint or
budget changes. game/test/ is explicitly excluded by the current distribution
collector, and this document is outside the explicit Pages includes. This adds
no hosted/offline-cache bytes and no playable copy. Current generated-provenance
qualification and broader inventory recovery remain separate open work.

## Read-only source pins

These are identity pins for the source context, not execution or approval claims.

| Path | Git blob | SHA-256 |
| --- | --- | --- |
| game/test/coop-resume-down-warning.test.mjs | f5909b2c1fb21747fe31e3f1d50d30769fa4731a | bfa9e257a15b8a66029e7e51f39fcc6ad42c79b568fb8101b852ef14424c8695 |
| game/test/helpers/coop-host.mjs | 102c129cc04f3e365dd721ed70e326980422fa6b | 2d2b5e091bf4b07adc1f15d45a5ef941c60e0270f470d60ac201995d5026f5a7 |
| game/test/helpers/coop-route-search.mjs | acf6ecfc0728af2d0ed1a1c28c74afd9790169b5 | 6455903fc25131a355ca56d3d3dacc20f2d6549621cd9a829f74828b7450070f |
| game/test/helpers/coop-win.mjs | 50040ef78371d92242ae938bcd098791a3cc1280 | 2842c9762cc327a61c22d82cd000d7509c0db4eb99bff44dfff15232e27c0331 |
| game/test/coop-terminal-player-hud.test.mjs | 243c96e5cba3844dd61514c0c68979a0d9e1f223 | 27d4b9a3c152ee84ea9fbfb3da879b81786817521941a1548f541b01c8f16b89 |
| game/test/coop-display-reflow.test.mjs | 4b3b39802bef1151a0ed0f18878445f784ab45fe | 06b7dd3d06c7f7def5c0f15a92ecde784bae2e9f0741efb405ae2257e69edffe |
| game/test/coop-cue-localization.test.mjs | 39392a2b74510fa6732a53661baed9072e51d13c | 7dff99903975f708cb540922d03c4217c1475ad3c989a4864c31121490030e94 |
| game/coop/core.mjs | d3d916072fc7407e383dc4201e9ba0efce5daf83 | d5abe476c8f44b15bdf86c9e05a2f85ad9e2be016ebf7e5540b73d200ea8d545 |
| game/coop/threats.mjs | 2b0bb564704185a3c07dc20364f1befc8f8f6fa9 | 44c24f8a73162fed5eec40053ad4add41b5160908be17af62771c9fe83c7c457 |
| game/coop/library.mjs | b047950e727adb9b7d9d38aab3cc9330617c7967 | a3ec90857ccc34e5821898ff9148a8d087b3b138d3350a58fa541f426e4bfaf1 |
| game/coop/first-connection.mjs | d91fed7fab8eeb3a975a23459c3a634fae0c74b7 | 41dda9601c43ae2387e6a04bde0517d97efba01a2897da89be296a161f22961a |
| game/gameplay-tuning.mjs | 65354472765f012c0640c1b76fe741aa8fcd885a | d24f4f9663aa80279b46e9479a17d633fe5367757db32a05303700eba6dd7c20 |
| game/couch/relay-rescue.mjs | dc03818c68ec21b6fffe9fc82153df288d24fa66 | 606d0c501dde7fbede10821e3f6c06354b0d3af3a1a2582932d0509134aecf04 |
| game/build-config.json | b02f463999b1a730eb88de45a1c57f3816cea44d | 4c461c2a5126fdff069c1d67eab84392b74d5c294d62c9f11c4ad9a252d8402a |
| scripts/game-cli.mjs | 3404a1e2c57b5a0e8b5f98d920fa2bcb2b1ba784 | 3cb3d6b814c200e36e5a1b850cbef898b65a1384b09d7f37fde0e583da02a42e |
