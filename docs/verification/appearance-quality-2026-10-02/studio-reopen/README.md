# Studio saved appearance and compiled acceptance

The patch preserves exact family/interface revisions in ThemeBundle.v2 without
rewriting legacy v1 documents. A compiled Company preview must carry exactly the
selected draft candidate inventory, even when a tampered report is internally
consistent and all its file hashes have been recomputed.

## Automated evidence

- `focused.tap`: 35/35 passing (saved basis, native/runtime transfers, workspaces,
  candidate validation, Company preview and real compiled package acceptance).
- `studio-host.tap`: 6/6 passing actual Studio handler checks. The existing muted
  one-shot audio fixture now explicitly auditions again after Unmute; changing
  master output alone must not replay a muted cue. No audio production code changed.
- `localization.json`: EN/UK generated catalogue validation, 12,218 messages and
  8,922 references. Focused ESLint completed without diagnostics.

Run:

```sh
node --test game/test/studio-appearance-basis.test.mjs game/test/company-studio-preview.test.mjs game/test/theme-preview.test.mjs game/test/studio-workspaces.test.mjs game/test/studio-runtime-transfer.test.mjs scripts/test-curated-appearance-package.mjs
node --test game/test/asset-studio-host-loading.test.mjs
node scripts/localization.mjs check
```

## Package identity and browser boundary

`browser-package-input.json` records the exact in-memory compiler outputs offered
for browser review: 745 files each, 19,601,025 / 19,600,947 bytes, within the unchanged
2,000-file / 64-MiB cap. The default candidate is River acceptance, Dnipro basis r1.
Native workspace, runtime theme and Company source draft were exported and reloaded
before compilation. All artifacts and every mandatory offline-cache byte were
verified. Each package executes a closure of 142 emitted modules, loads its real
entry/provider over HTTP and reloads through a verified cache-only fetcher.

`same-origin-copy.json` records the byte-identical copy into primary `dist` for
review on the user's already-unlocked origin. No access control or credentials
were changed. Browser screenshots and interaction evidence are owned by the parent
review, separate from these Node receipts.

The fixture uses the same candidate in campaign and community scopes to prove
reuse; distinct-pin precedence is covered by existing community-appearance and
edition-appearance-host suites. Host assertions in the package script use a DOM
adapter. Cache-only Node reload is not physical browser or service-worker
installation proof. No production publication occurred.

Reproduce with:

```sh
node scripts/check-curated-appearance-package.mjs --serve 8876 --receipt /tmp/appearance-package.json
```

See [the workflow guide](../../../curated-community-themes.md) for routes and steps.
