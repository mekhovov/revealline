# Static audit of external-volume dependencies

The existing internal application checkouts have **no discovered live link or hardcoded runtime/build dependency on alex** in the inspected scope. This is a static finding, separate from root's GitHub-only restored-player audit and from completion of the global file backup. It does not grant native, full-player, public-persistence or performance acceptance.

The canonical primary was read at `f69a58fb7170fd742e14205b8df9faf493653115`; the historical `fpv-progress-isolated-20261015` root was read at `9276bd4ef4f6189a6eda51910a0782d1dca51d87`. Product PR1540 remains a separate Draft at `b65d80f716b8db646bfdf5f714892f1c0f6409b0`. Existing working changes were not edited. Local application roots are represented by aliases in these reports; unrelated private paths and contents are omitted.

`live-checkout-links.json` records 42 canonical links and four historical-root links. None resolves to alex. Both common Git directories are internal, with no object alternates, selected Git metadata symlinks, or local path-setting overrides found. The link walk did not follow directory symlinks and excluded `.git` contents and private/tool cache directories; the relevant Git metadata paths were checked separately. No browser, player storage, renderer, large staging, build or package installation was used.

Two existing historical-root convenience links are dangling:

| Link relative to historical root | Existing target |
| --- | --- |
| `node_modules/@gltf-transform/core` | `/tmp/fpv-coaster-tools-20261015/node_modules/@gltf-transform/core` |
| `node_modules/@gltf-transform/extensions` | `/tmp/fpv-coaster-tools-20261015/node_modules/@gltf-transform/extensions` |

Those temporary targets are already absent; disappearance of alex is not their cause. The actual authoring context in **both** internal roots resolves core/extensions/functions `4.5.1` and `gltf-validator` `2.0.0-dev.3.10` through internal `authoring/fpv-worlds/node_modules`. The historical authoring directory links to the canonical internal authoring dependencies. Root's repaired root-level validator link also points to the exact internal saved dependency. `module-resolution.json` records filename lookup results without importing or executing these packages. A direct root-level import of the glTF transform packages still lacks a root dependency; use the declared authoring context or restore its pinned install.

Twelve relevant package manifests/lockfiles contain no absolute local, `file:` or `link:` dependency value. Main runtime/build scripts, workflow sources and the inspected publishing pin/delivery source contain no `/Volumes/`, alex or SMB reference. The authoring lockfile records npm registry URLs, versions and integrity values. `npm ci --prefix authoring/fpv-worlds` is the corresponding reinstall recipe when needed; it was not run by this audit.

Six manual authoring verification helpers retain the default fixture directory `/Volumes/alex/CodexMigrationStaging/fpv-large-worlds-20261014/urban-mixed-r2`:

| Helper under `authoring/fpv-worlds/regions/` | Fixture positional argument after the script name |
| --- | --- |
| `verify-host-session.mjs` | first |
| `verify-optional-navigation.mjs` | first |
| `verify-restore-containment.mjs` | first |
| `verify-finite-runtime-position.mjs` | first |
| `verify-saved-locations.mjs` | first |
| `verify-session-snapshot-reuse.mjs` | second, after its preserved baseline session module |

Pass a restored local fixture directory to replay them. Their defaults will fail without the old share, but no invocation was found in the checked standard package scripts or workflows. These are verification inputs, not application startup requirements. Additional authoring JSON matches are historical source-folder, scratch or failed-stack records; they were not rewritten into claims of success.

The completed primary inventory contains 85,733 file rows and 262 symlink rows. The two supplement files were captured as stable readable-prefix snapshots and may continue growing. Together the snapshots contain **282 unique staged/external-checkout links**, of which 281 target the captured alex subtree. They belong to external authoring checkouts or staged verification copies; those original copies remain path-dependent until restored. `staged-copy-link-targets.json` preserves every exact app-relative link and target. Their presence is not a dependency of either internal application checkout, and selected inventory rows alone do not prove that all target payloads are already uploaded.

One staged link targets a separate internal app worktree outside the global archive's captured source root:

```
fpv-package-qualification-20261014/batched-storage-103be7a7/independent-storage-checks/authoring/fpv-worlds/regions/urban-bando/delivery-review-r1
  -> <internal-app-worktrees>/fpv-rgba-isolated-20261015/authoring/fpv-worlds/regions/urban-bando/delivery-review-r1
```

The target's **39 files, 1,461,705 bytes** are all clean tracked files, with no nested symlinks or unique untracked payload. Each local SHA-256 and Git blob identity was checked against the published GitHub tree `032814d85295c4bc54652eeb5e62e0001e1914b5`. That exact tree exists in local/published `f3b34f4c8130ebd1f5f09f19a868d05898ed495a`, product `b65d80f716b8db646bfdf5f714892f1c0f6409b0` and the already durable preservation checkpoint `0959055975afe3a929c8f2c8602a6ab77488277c`. `outside-root-target-github-coverage.json` records every file's hash and the exact source bindings.

`portable-link-mapping.json` closes the data dependency explicitly: restore those exact GitHub blobs under the new restore root's `_github-review-dependencies/urban-bando-delivery-review-r1`, verify every byte, then create the missing staged leaf as a relative link to that new location. The file records the exact relative link value and an exclusive-write recipe. The mapping was not applied by this read-only audit, and neither old absolute path must be recreated. The bulk restore owner must incorporate the mapping and verify the resulting link before claiming complete portable staged review.

`exact-link-dispositions.json` records all **282** link/target mappings and alias chains. The other 281 targets map inside the captured source root and have selected terminal file/subtree payloads in the current inventory snapshots; no terminal target lacks a selected file. Those counts establish a static selection/mapping disposition, not completion of CAS uploads or proof that every directory member is already restored. Captured-root absolute targets become relative links, and missing target payloads prevent the restore receipt from being complete. Git checkout recovery remains a separate receipt. The bulk lane has been notified of the exact mapping and GitHub data closure.

The 21 original ZIPs remain independently preserved by the sibling `archive-preservation/release-assets-manifest-21.json`. Its restore helper requires a new explicit destination and uses numeric GitHub asset identities; it does not require alex or recreate the mount. Old 9213/9214 review links must be pointed at the newly restored matching runtime before a future review. Restoring bytes does not repeat native acceptance.

No source, dependency link, player data, original failure, archive or existing asset was changed. Only this small report and a normal preservation-only child commit were created. Global backup coverage and execution/verification of the recorded staged mapping remain separately owned gates; this audit does not declare the volume disposable.
