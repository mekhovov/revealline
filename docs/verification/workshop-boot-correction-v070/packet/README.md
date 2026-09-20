# v0.70 shard1 UX corrections

Exact base: `4bb553d06d62f7a8cce301c77b245573838bfdcb`.
Hosted failure: run35525568313/job106117253046,1913/1915pass. The release coordinator retains the original full hosted logs. This packet owns only Replay HTML, the static markup test, the title-flow DOM boundary, and their maintenance documentation. The coordinator is correcting the other tools' static Game home exits and separate shard3 fixtures.

## Fixes

Replay has a real pre-module recovery defect: both return links were inert until the independent return module loaded. The second anchor is now `#replay-game-home`, labelled Game home, with an immediately usable same-build `../` href. It retains `data-workshop-return="game"`, so the normal module still upgrades it with a validated Journey hint. Contextual `#return-game` / Return to Workshop remains gated until its href is ready. No new boot owner, automatic navigation, hidden focused control or progress write is introduced.

The title-flow test used a simplified `showModal()` that emitted neither native opening events nor autofocus. With Home retained beneath Workshop, that omitted browser boundary left the real modal owner unaware of the new top-layer dialog. The correction models beforetoggle/autofocus only within that test. Production modal/focus code is unchanged. The original title/Missions opener assertion remains, with stronger exact checkpoint and stored-profile comparisons.

## Verification

- Exact original source reproduced locally:23/25pass, two failures. Original log retained.
- Both corrected complete files:25/25 on Node20.19.5 and22.22.2.
- Three additional unchanged complete files (Workshop return, Replay navigation, Replay display host):32/32 on each runtime. These are separate supporting commands, not one combined57-case run.
- Sealed-patch reconstruction: five exact postimages, applicable syntax/build inclusion, and25/25 Node20. Actual `git apply` reproduces all five hashes.
- Targeted HTML/test/doc formatting and test lint pass. Existing skill prefix is preserved with an appended maintenance section.
- Actual local browser1280×720: intentionally unavailable scripts leave loading feedback and Game home reachable with the first Tab; Enter reaches the same build's game boot. Normal startup preserves both context-aware return URLs; Game home remains reachable and45CSSpx high. No claim that a script-disabled game can run, or that this is public/mobile/offline/physical-controller acceptance.
- Both owned servers and the native tab are closed. Their exit130 is intentional SIGINT cleanup.

Root checkout, release version, PR202 and running qualification are untouched by this packet. Final composition must pass its own complete gates and public release cycle. Keep unrelated About/Worlds follow-up packets outside this correction unless separately selected by the release owner.

## Reproduce

```sh
node .cache/v070-ux-shard1-4bb-r2/verify-source.mjs
node --experimental-loader ./.cache/v070-ux-shard1-4bb-r2/loader.mjs --test .cache/v070-ux-shard1-4bb-r2/suite.test.mjs
node --experimental-loader ./.cache/v070-ux-shard1-4bb-r2/loader.mjs --test .cache/v070-ux-shard1-4bb-r2/related.test.mjs
```

The loader reads unchanged files from exact Git with lazy fetch disabled; only manifest-declared changes are reconstructed. `source.patch.gz` contains the reviewable patch. `qualification-logs.json.xz` preserves the original failure and all final runtime results. `serve.py` and native receipts describe the two explicit local fixtures; the working source tree used by them remains in adjacent `v070-ux-shard1-4bb-r1/candidate`.
