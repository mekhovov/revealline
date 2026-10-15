# Maintaining Flight practice

Flight practice is a directory of independently packaged applications, not an unlock system. The existing **FPV flight simulator** shortcut remains separate. **`.rlpack` files are content imported inside World Studio, not executable applications for this directory.**

The SIM workstream owns mechanics, controls, lessons, demonstrations and rendering. This directory owns descriptions, launchers, offline preparation, publishing integration and guides. Do not fork training instructions: point players to the app’s maintained Flight guide / first-flight demonstration.

## Inspect and preview

From the repository root, after `npm ci`:

```sh
node scripts/bundle-optional-practice.mjs --list
node scripts/bundle-optional-practice.mjs --preflight
node scripts/bundle-optional-practice.mjs --preview .cache/practice-preview
node scripts/game-cli.mjs serve --root .cache/practice-preview --port 8877
```

Open `http://127.0.0.1:8877/practice/`. Use a new output directory each time: preview outputs are not overwritten. The preview contains practice applications, not a second copy of the main game; the main-game shortcut requires the complete site. It is deliberately **not publication-qualified**, even if local preflight passes.

Preflight reports missing runtime files, missing/empty license inventory, invalid descriptions or translations, missing/oversized previews, exact dependencies, file/byte limits and local readiness to bundle. The bundle command then reproduces artifacts twice and runs independent admission. Neither command invents human review evidence.

Before assembly, use the existing bundle tool's read-only capacity mode:

```sh
node scripts/bundle-optional-practice.mjs --capacity /absolute/path/capacity-input.json
```

The [capacity review and input recipe](flight-practice-capacity-review-2026-10-14.md)
explains how to combine a complete core inspection with current/retained candidate
manifests and an explicit growth reserve. `cannot-fit` exits 1. A successful
`requires-exact-build` result only means the lower bound did not exceed the guard;
it does not replace archive admission or the final complete-site inventory.

## Register an application

1. Create `optional-practice/<id>/index.html`, a manifest, application modules and `README.md`. Use a stable lowercase hyphenated ID; do not rename an installed app to ship an update. Add instructions, asset sources, copyright/license inventory and support information. Offline preparation must pass that ID to the shared installation service.
2. Add an explicit entry to `publishing/optional-package-policy.mjs`. Declare every runtime file in `localFiles` or `sharedFiles`, the existing worker/launcher templates, locale inputs, licenses and any vendor hashes. Choose justified file and byte limits. No remote imports, arbitrary app fetches or archive-declared expansions of executable dependencies are allowed. Reuse `optional-practice/worker-template.mjs` for new packages. Add dependencies to the core build only if the application is also intentionally bundled there. Apps reusing `sim-presentation.mjs` must explicitly opt into its reviewed `coreOnlyImports` entry for the literal shared settings-tools link; those tools stay in the core game and are not added to the optional archive.
3. Add `package-info.json`, `preview.png` and `guide.html`. The policy adds these discovery files, shared guide/navigation helpers and generated launcher files to each registered app. Account for **both runtime and source archives, including generated manifests**. Run `--list` and `--preflight` to obtain the current effective limits and actual usage from `publishing/optional-package-policy.mjs`; do not reuse numbers from older qualification reports. The effective registry includes shared-file adjustments after the base policies. A larger simulator needs an explicit reviewed policy change, not a bypass of admission.
4. Capture a real gameplay PNG, at most 300,000 bytes; avoid menus alone, synthetic artwork and private imported content. Record provenance/license information in the package README. Copy the bilingual package guide pattern, keeping current app-specific first-flight instructions accurate.
5. Supply this exact bounded descriptor shape, with every copy field in both languages:

```json
{
  "format": "revealline-practice-description.v1",
  "id": "sample-flight",
  "support": "https://github.com/OWNER/REPOSITORY/issues",
  "changelog": { "en": "What changed.", "uk": "Що змінилося." },
  "copy": {
    "en": {
      "name": "Sample Flight",
      "description": "What you can do.",
      "purpose": "What you learn.",
      "inputs": "Supported controls.",
      "requirements": "Graphics and device requirements.",
      "firstFlight": "Where to find the maintained first-flight walkthrough."
    },
    "uk": {
      "name": "Зразок польоту",
      "description": "Що можна робити.",
      "purpose": "Чого навчає.",
      "inputs": "Підтримуване керування.",
      "requirements": "Вимоги до графіки та пристрою.",
      "firstFlight": "Де знайти актуальний посібник першого польоту."
    }
  }
}
```

Each localized string is required, nonempty and at most 900 characters. Support is a HTTPS GitHub repository issue tracker. The descriptor is at most 12 KiB. The generated details document is bounded to 96 KiB/eight apps and binds descriptions to the catalogue’s package ID and revision. Download/offline sizes come from output bytes, not manually estimated text. The renderer does not have a package-ID switch.

6. Run preflight and preview, inspect English/Ukrainian, focus order and narrow screens, then test launch and offline behavior. Update README/changelog and commit the source before creating a release candidate.

## Freeze, review and publish

```sh
node scripts/bundle-optional-practice.mjs --out .cache/practice-candidate \
  --base-path /revealline/ --packages civilian-flight,civilian-fpv,fpv-worlds
```

The source checkout must be clean and committed. The output includes distribution/source ZIPs, exact inventories, `optional-packages.json`, a verification report and a **pending** review template. CI repeats this for all three real apps, including World Studio. Automated suites are required by the current `publishing/test-policy.json`; historical waiver receipts are not current passes.

When SIM is changing concurrently, build from a recorded, merged commit in an isolated checkout. Do not package its uncommitted work or copy files from an active SIM worktree. Rebase the publishing changes after accepted SIM fixes land and reproduce the final candidate again. A newer candidate must receive its own source-bound evidence; an older passing runtime does not qualify it automatically.

Complete every existing review gate with real, source-bound evidence: automated validation; content accuracy; assets/licenses; keyboard/controller accessibility; installed isolation; update/rollback; same-device performance; human learning/pacing. Record browser/device, source SHA, package hashes, steps, screenshots, results and limitations. A synthetic fixture’s review is never release evidence.

### Repeat player-flow observations locally

Use `scripts/observe-practice-first-flight.mjs PLAN_JSON PLAYWRIGHT_MODULE NEW_OUTPUT`
with an external Playwright installation and a new evidence directory. Supply any
approved test access through a protected environment or silent input, never plan
fields or command arguments. The observer uses the normal access form and does
not alter application bytes, install demonstrations or inject progress.

The strict plan formats are intentionally separate:

| Plan / protocol                                                                   | What it tests                                                                                        | Package revision field |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------- |
| `revealline-practice-first-flight-plan.v1` / `practice-first-flight-public-ui.v1` | Legacy four-case EN launch, motion, pause and retry                                                  | Academy                |
| `revealline-practice-first-flight-plan.v2` / `practice-first-flight-public-ui.v2` | Ten EN/UK cases: Gym plus both FPV modes in Academy and Worlds                                       | Academy                |
| `revealline-practice-gym-exercise-plan.v1` / `practice-exercise-public-ui.gym.v1` | Two EN/UK native Gym lift-and-land exercises, completion screenshots and actual exported transcripts | Gym                    |

Every plan declares exactly `format`, `protocol`, `caseId`, `deviceLabel`,
`quietWindow`, `cases`, `bundle`, `envelopeSha256`, `sourceRevision`, `sourceTree`
and `packageRevision`. Use the candidate's original envelope/source/revision
values, not a branch name or `latest`. Obtain the exact ordered case IDs from the
exported protocol constants and validator tests. Unknown fields, partial matrices
and mismatched package revisions fail admission. All original runtime and source
archives are admitted even when the exercise protocol stages only Gym.

The Gym observer uses visible measurements and ordinary R/F input, requires
ordered checkpoints and a native replay-backed completion mark, then exports
through Settings → Data. It independently replays that actual export with the
same native catalogue/model and byte-matched dependency closure outside the
browser. Missing, changed or newly unpinned replay dependencies fail closed. The
replay must not be used to drive a browser or manufacture an exercise result.

These are automated local development observations, not public release, novice
learning, physical-input or accessibility approval. They start at stable app
launchers; they do not replace the full main-game directory journey. Preserve
failed runs and the exact observer authority, plan, original report, screenshots
and exported transcript alongside any successful retry. `qualified` remains
false; a motion smoke pass is not an exercise-completion pass.

### Publish only after the existing review gates pass

```sh
node scripts/publish-optional-packages.mjs verify \
  --bundle .cache/practice-candidate --review REVIEW.json
node scripts/publish-optional-packages.mjs upload-draft \
  --bundle .cache/practice-candidate --review REVIEW.json \
  --repository mekhovov/revealline --release-id EXISTING_DRAFT_ID
```

Use the normal release owner to allocate/version/publish the release. Optional tooling does not create releases, move tags, overwrite original assets or bypass review. An existing version tag must identify the candidate’s exact source commit/tree; a candidate built later cannot be attached to an older same-numbered release. Upload verifies downloaded originals and is resumable; do not invent a draft ID.

After the normal release is published:

```sh
node scripts/publish-optional-packages.mjs sync-selector \
  --bundle .cache/practice-candidate --review REVIEW.json \
  --repository mekhovov/revealline --base-path /revealline/ \
  --selector publishing/pages-controller/optional-packages.json
```

Review and commit the selector through the normal main-branch process. The production workflow is **`.github/workflows/publish-main-pages.yml`** (not the retired `deploy-main-pages.yml`). It calls the existing optional publisher's `stage-pages` command after building main and before checking the complete 950,000,000-byte hosted budget. Frozen Pages assembly uses the same overlay. No selected releases produces an explicit empty `practice/index.json`, not a missing file. Staging has read-only release access and does not create or publish a release. The post-deployment job checks out the exact deployed source/selector, checks the selected package IDs **and versions**, then reads pointers, manifests and every hashed dependency, including stable launcher copies:

```sh
node scripts/bundle-optional-practice.mjs --verify-site https://mekhovov.github.io/revealline/
```

A missing catalogue, missing details, mismatched selector or changed asset fails this check. A successful byte check still does not prove device controls or a human learning outcome.

The Actions run retains `practice-site-receipt-SOURCE_SHA` alongside the main-site capacity receipt for 30 days. Copy required qualification receipts into the durable release evidence inventory before that retention expires. A green main identity check alone does not prove that Flight practice was deployed. An explicit empty catalogue proves discovery is reachable, not that the three apps have been released.

**Budget retained versions, not only the active package ZIPs.** Pages hosts expanded package files, stable launcher copies, directory assets and every retained release alongside the main game. Per-package admission is not a complete-host capacity pass. The [2026-10-14 continuation](flight-practice-continuation-2026-10-14.md) found that two comparable three-app generations plus the then-current main payload exceeded the 950,000,000-byte guard by at least 24.6 MB, before all publication overhead. Resolve that footprint/retention decision before release; do not drop rollback URLs or raise the guard merely to pass deployment.

## Update, retirement and rollback

- Ship changes under a new immutable release URL; retain the prior reviewed release in the selector. Never replace bytes under an existing version.
- Launchers accept `action=play` and `lang=en|uk`, plus the SIM-owned appearance handoff: exactly one `appearanceFamily` matching `[a-z][a-z0-9-]{0,63}` and one `appearanceRevision` matching `r[1-9][0-9]{0,8}`. The pair is forwarded together only when valid; it selects appearance, not an executable destination. Keep this handoff compatible with SIM. Launchers still validate same-origin package/version/entry paths, and no query parameter arms a flight.
- Players prepare a new version explicitly. Previous installations remain separately owned. No `skipWaiting` or forced reload replaces an active flight; close launcher tabs to activate a waiting launcher update.
- Retire an app by removing its ID from `activePackageIds` in every selected release, after review. Keep `packageIds` and retained releases while old URLs must stay available. New site assembly removes its stable entry but retains immutable release files. Retiring is not remotely deleting a player’s cache or records.
- Roll back an active pointer using existing tooling, then review/commit the selector:

```sh
node scripts/publish-optional-packages.mjs select-retained \
  --repository mekhovov/revealline --base-path /revealline/ \
  --selector publishing/pages-controller/optional-packages.json \
  --version vX.Y.Z --packages civilian-fpv
```

Keep the policy’s historical dependencies while releases using them are retained; policy changes must not silently invalidate already reviewed archives. Validate retained overlays before changing dependency policies.

## Recipe verification and remaining qualification

`node --test scripts/test-bundle-optional-practice.mjs` creates a temporary fourth app with real files and a new registry entry, previews all four cards, verifies its launcher route, admits test-only reviewed artifacts, updates, rolls back and retires it. The fixture is cleaned up and never uploaded or added to the real selector.

For the real-browser companion, provide an existing Playwright installation and
installed Chrome (not added to the runtime packages):

```sh
PRACTICE_RECIPE_BROWSER_MODULE=/absolute/path/to/playwright/index.mjs \
PRACTICE_RECIPE_BROWSER_REPORT=/absolute/new/recipe-browser.json \
  node --test --test-name-pattern='maintainer recipe' scripts/test-bundle-optional-practice.mjs
```

It uses an isolated browser and the real builder/publisher output: four-card
preview, one-Play launch, explicit start/pause/retry, two versions with changed
bytes, offline preparation, all-tabs-closed offline reopening, rollback and
retirement retaining immutable URLs. The sample alone has a known test credential;
it uses the ordinary password form, never changes a real package's access gate.
The report includes browser, baseline commit, manifest/harness hashes, checkpoints,
a real screenshot and limitations. Synthetic review records and the cloned Gym
remain **test fixtures**, not source-bound review evidence for a public app.

The [all-three installation observer](optional-installation-observer.md) instead
accepts admitted frozen candidates and an authorized test password when required.
Never substitute a sample-fixture success for a real candidate's failed or blocked
installation observation. Physical devices and human learning remain separate.

For a source-bound Academy first-pointer regression check, use the separate
observer described in the [pointer protocol and results](flight-practice-pointer-2026-10-15.md).
Copy a retained `plan.json` from its evidence archive, point `bundle` at the exact
original candidate, and verify the envelope/source/tree/package pins. For a new
candidate, obtain fresh pins from its admitted envelope; never rename an old
receipt to qualify it. Run with an existing external Playwright installation:

```sh
node scripts/observe-practice-pointer.mjs PLAN_JSON PLAYWRIGHT_MODULE NEW_OUTPUT_DIRECTORY
```

Supply `OPTIONAL_INSTALLATION_PASSWORD` through an approved secret environment or
silent interactive input, never in command arguments or committed plans. The
observer uses the ordinary form. It tests EN/UK Workshop, profile backup and
notebook backup separately by mouse and Tab/Enter, using fresh contexts and reload
cases. Setup navigation itself uses keyboard activation. Keep the full output,
including failed attempts and cleanup errors. Run its tooling regressions with
`npm run practice:pointer:test`; these are not browser or device qualification.

For repeatable recovery and player-flow observations, see the separate
[repair protocol and original evidence](flight-practice-repair-2026-10-15.md):

```sh
npm run practice:observer:test
node scripts/observe-practice-first-flight.mjs PLAN_JSON PLAYWRIGHT_MODULE NEW_OUTPUT_DIRECTORY
node scripts/observe-practice-cache-repair.mjs PLAN_JSON PLAYWRIGHT_MODULE NEW_OUTPUT_DIRECTORY
```

Use each tool's own retained plan shape, not the pointer plan. Both pin an admitted
envelope and immutable source. Cache-repair v2 additionally pins all three package
revisions and requires `seed: "worlds-template-copy"`: it creates one ordinary
Workshop project and checks its retained records/card through controlled cache
and worker faults. It alters only its disposable test profile. V1 empty-store
evidence cannot substitute for that populated case. First-flight v1 checks four
EN movement/pause/retry flows; it does not certify a completed exercise, the
main-game entry route, UK, physical controls or human learning.

Keep the complete new output directory, source witnesses, screenshots, failures
and cleanup result. Never reuse an existing output directory or relabel an older
candidate receipt. Quota overrides and message tracing are opt-in diagnostics;
read their stated boundaries and actual outcomes before making readiness claims.
For the controlled all-three quota subcase, set both
`OPTIONAL_INSTALLATION_QUOTA_PROBE=1` and
`OPTIONAL_INSTALLATION_QUOTA_PACKAGES=all` on the installation observer. It uses
Chromium's origin-wide allowance override, never fills the disk or clears site
data, and restores it before retry. A reported zero limit is not a reliable
denial control on the tested Chrome version; retain the v2 positive-headroom
protocol and require every selected app's completed/reset/retry result. Worlds'
in-app removal is in Content → World library, while preparation is directly in
Content. The separate stable launcher also offers scoped removal.

When checking the player guides, follow the runtime menus rather than only the
static HTML: the shared shell reparents input/offline controls into Settings.
Compare English and Ukrainian labels after mounting, including Radio setup and
the expanded Workshop & offline disclosure. Verify that an unfinished offline
check asks the player to check again without deleting their copy; only confirmed
missing files or an invalid owning worker warrant the repair path. Keep site
credentials out of guide screenshots, reports, command arguments and receipts.

See [verification report](flight-practice-verification.md), [English player guide](flight-practice-player.md) and [український посібник](flight-practice-player.uk.md). Phase 1 is **not complete** until the reviewed apps are actually selected on GitHub Pages and required device/human qualification is recorded.
