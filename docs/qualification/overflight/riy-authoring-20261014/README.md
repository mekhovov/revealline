# Riy authored content and Community compatibility — 2026-10-14

Riy uses the existing Survivor Creator Studio at `game/studio/overflight.html?operation=riy`. The encounter, upgrades, goals, shared resources, source editor, draft, preview and import/export actions remain the shared editor. An additional EN/UK section edits focus, recall, attack ranges and both escorts' formation offsets and impact profiles.

## Content contract

`OverflightRiyProjectV1` retains the Survivor project fields, declares `survivorFormat` (`OverflightProjectV1` or `OverflightProjectV2`), and contains bounded `riy` settings. Native and Studio call `compileOverflightRiyProject()`, which delegates ordinary gameplay and resource validation to the existing Survivor compiler. Runtime format/rules stay compatible; source format and project identity distinguish authored Riy content. Changing an escort setting changes the compiled identity. Existing Survivor and Raid validators and package formats remain unchanged.

The settings admit exactly one sweeper and one breaker, finite bounded values, at least 24 units of formation separation, a leash covering the focus range, and a cooldown covering the focus duration. Attack and formation settings are content tuning, not new remote code or arbitrary asset references. The shared exact resource closure is preserved.

The Riy package and shared-profile library have separate identities and storage namespaces. A local fresh-library import recreates the same compiled definition and canonical export bytes. Making an updated copy of legacy Riy content preserves its escort settings without modifying the imported source.

## Community and offline support

The Community client recognizes the distinct `overflight-riy` family, routes installed packages to `play.html?operation=riy&community=…`, and shares the existing atomic edition ownership, exact-byte recovery, offload and reinstall implementation. The service validator admits Riy and Raid through their native compilers. Public metadata retains those families and does not advertise an unavailable generated preview. This also corrects an existing server-side Raid admission omission.

The source-based offline dependency test verifies that Riy's dynamically imported mode and its core/project/package dependencies belong to the player cache graph. The existing shared Studio remains optional tooling. The distribution includes the whole `game` tree; no separate document, texture atlas or asset pack is introduced.

## Evidence

- `tests.tap`: 40 passing tests across the Riy schema/editor/round trip, Riy/Survivor/Raid Community ownership, other native family regressions, Community store and service admission.
- Scoped ESLint passed for changed game modules. The integration full-file Prettier check reports style drift, including in the pre-existing base versions of edited modules; this is not a full formatting pass.
- The added `Riy operation` case in `scripts/test-offline-core-closure.mjs` passed against actual source modules; unrelated cases were excluded from that focused run.
- Two new game suites are registered in the industrial Creator verification phase. Service admission coverage extends its existing test file.

These automated results establish data compatibility and dependency inclusion. They do not constitute a live authenticated Community publication, a browser offline capture, an actual fresh-browser Studio round trip or an enjoyment/balance claim. Native browser review is recorded separately by the integration task. No package was published to a live service for this change.

## Local authenticated service qualification

`authenticated-lifecycle.tap` adds two passing end-to-end service cases, one each for Raid and Riy. They use production Fastify HTTP handlers, the real package validator/worker and the shared client/publisher/library. Upload bytes use a real temporary `DiskBlobStore`; validation reopens it with a separate store instance. Catalogue repository state and browser IndexedDB are finite test adapters, and authentication uses explicitly local development tokens.

For each family, the owner publishes two immutable editions in one collection. Another authenticated account cannot read, upload, submit or unlist the owner's content. A player discovers and installs the first edition, retains exact recovery bytes, offloads it, reinstalls with network access deliberately rejected, then installs the revised edition without overwriting the first. Package and runtime identities remain intact.

This completes a **local authenticated service-flow check**, not a production account deployment check. No production session, remote moderation queue, real-network upload transport, real browser IndexedDB persistence or PostgreSQL deployment was exercised here. Temporary fixture directories are removed by the test; no user content is removed.
