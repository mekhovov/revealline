# Tiny native Library-listing contract

This authoring tool reproduces the bounded, non-WebGL component check accepted for
[PR #1537](https://github.com/mekhovov/revealline/pull/1537#issuecomment-6206432325).
It is not part of the normal player or shipped optional package. Do not use it to
inspect, seed, repair, clear, reconnect or delete a player database.

## Prepare a fresh external stage

Use the **original qualified Worlds runtime ZIP** from optional artifact
`12018000809` / [run 38832221920](https://github.com/mekhovov/revealline/actions/runs/38832221920),
head `bc9bc71f192729f0661a0483d7d64609c1973343`.
The archive SHA-256 is
`90d2cabcebd8c4647f6abced993dfb5c40f4a19bd5829a0e15c0b5bfc321f692`.

```sh
node authoring/fpv-worlds/library-listing/prepare.mjs \
  --archive /EXTERNAL/original/distribution-optional-fpv-worlds.zip \
  --output /EXTERNAL/fresh-library-listing-stage
```

The helper verifies the entire supplied archive, extracts just its exact
17,516-byte `optional-practice/civilian-fpv/world-store.mjs` (SHA-256
`6050ac77adf52c2b757b851c444a4b1430a8cbca34a9048713e540601ebcca22`), checks
the four native-observed HTML/style/browser-module hashes and writes an exclusive
fresh directory plus identity. Existing paths, changed archives, changed harness
identities and in-repository staging, including symlink aliases into source, are
refused. Failed partial stages remain
preserved. No package download, server, browser, database or player operation is
started by preparation. The repository deliberately contains **no duplicate
packaged WorldStore**.

The source page is kept as `index.html.template`, outside production HTML entry
discovery. Preparation emits the unchanged native-observed bytes as `index.html`
only in the external stage; no appearance bootstrap or player storage is added.

Serve only the newly prepared directory on a fresh explicitly chosen local port:

```sh
python3 -m http.server 9220 --bind 127.0.0.1 \
  --directory /EXTERNAL/fresh-library-listing-stage
```

Check that the port is unused first; do not stop another task's server. A newly
prepared stage has **no inherited native acceptance**. The original accepted
9212 stage, test data and failures remain immutable and separate.

## Visible native procedure

1. Open the fresh page. Confirm initial `ready=false`, `opens=0`, actions empty.
   No database is opened at page load.
2. Click **Seed tiny test database** once. First visit expects PASS/reused=false,
   version 2, generation 7, counts projects 1/assets 32/revisions 32/meta 2.
3. Click **List metadata**. Expect 32 rows, active-first and retained primary-key
   order, no asset Maps in output, returned-clone isolation, exactly one readonly
   transaction and one revision-cursor request; max asset-bearing rows per
   delivery is 1. Content fingerprint/counts/generation stay unchanged.
4. Click **Abort read**. It intentionally aborts only the synthetic readonly list
   after requests are queued and **before first delivery**. Expect rejection,
   no partial success, preserved content/generation and usable connection.
   This does not reproduce the reported public connection-closing failure.
5. Click List again, then **Export report**. Close normally; reopen on the same
   origin and explicitly Seed again. Expect reused=true without rewriting the
   fixture and a successful List. Export that separate original report too.

Only `codex-authoring-native-library-listing-bc9-20261016-contract-v1` can be
opened by this supplied factory. Unknown nonempty fixture data is refused and
left unchanged; no delete or clear action exists. There are 32 retained rows with
2,016 references plus 32 active shadow references: **2,048 total references to
32 shared one-byte synthetic values**, not a large-data/quota workload.
Expected synthetic content fingerprint:
`09cfa923824af62692dc1cc6b3747a1331fbc11d1782823b91a4fe4dc340087a`.

The explicitly supplied factory uses Proxy facades for its opening request,
database, transaction and revision store, changing those object identities.
It does not patch global/native prototypes or native instances. Native requests,
results, events and transactions remain real. The diagnostic history is capped
at eight actions; reports contain only synthetic counts/hashes. Closing this tab
closes only its test connection and retains the fixture.

## Software checks and evidence boundaries

With the existing pinned authoring fake-indexeddb dependency available:

```sh
FPV_TEST_PACKAGE_JSON=/ABSOLUTE/revealline/authoring/fpv-worlds/package.json \
  node --test /EXTERNAL/fresh-library-listing-stage/verify.mjs
```

Four safety cases cover inert construction, list/abort/content preservation,
normal reuse, refusal of an unknown sentinel and the history cap. The reusable
verifier changes only dependency lookup from the original private verifier;
the four native-observed browser files stay byte-identical.

Accepted historical native reports are preserved in
[`docs/evidence/fpv-library-listing-native-20261016`](../../../docs/evidence/fpv-library-listing-native-20261016).
Both original JSON exports are distinct. The two PNG names are byte-identical
and must not be counted as independent per-visit visual evidence.

This is **not** normal-player refresh/download/Fly integration, measured native
heap/GC/time/FPS, original public persistence recovery, application-process
restart, whole-network offline, quota/eviction, all-24 native retention above
256 MiB, authored two-hour endurance, physical-device or all-plan acceptance.
The original closing-connection and zero-visible-saved-map failures remain open.
