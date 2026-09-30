# Optional package candidates

Flight practice apps remain separate opt-in packages. Their candidate
format is `revealline-optional-packages.v1`; it is not an arcade edition and is
never added to the default core or an edition asset inventory.

After committing the reviewed source, run:

```sh
node scripts/bundle-optional-practice.mjs --out .cache/optional-candidate-VERSION --base-path /revealline/
```

Omitting the selection preserves the historical `civilian-flight` assisted gym.
To include the independently registered `civilian-fpv` first-person package, select
the exact package IDs explicitly:

```sh
node scripts/bundle-optional-practice.mjs --out .cache/optional-flight-candidate-VERSION --base-path /revealline/ --packages civilian-flight,civilian-fpv
```

Empty, repeated or unregistered IDs fail before compilation. Each selected package
is built twice independently, with its own exact manifest, source archive, worker,
installation ID and review gates. Adding a package cannot change the historical
gym's artifact bytes at the same source revision. The package builder also accepts
`--package civilian-fpv` after its output directory for a development-only build;
this does not satisfy frozen-source or release qualification.

The output directory must be new and either outside the checkout or Git-ignored.
The command must execute the builder from that same checkout. It requires a clean
committed source tree, verifies every selected original input against Git object
identities, builds twice and compares all artifact bytes, then independently
checks every ZIP member before writing immutable output. It does not upload,
change a deployment selector or claim human/device qualification.

The envelope binds the release version, exact commit/tree and package revision
to four original artifacts: manifest, distribution ZIP, selected source inventory
and selected source ZIP. A policy registry explicitly allows the app's runtime
and shared dependencies; unknown imports, paths and packages fail closed.
Selected source includes the worker and launcher templates and pruned validator translations.
Original aggregate locale hashes are recorded, while their unrelated strings do
not enter the archive. Generated worker, launcher and icon dependencies are listed; vendored
i18next includes its exact version and license descriptor. The existing separate
64-file/8-MiB package limits, 64-MiB/2,000-file core limit and 32-MiB edition asset
limit are unchanged.

The FPV policy admits only Three.js 0.186.1 `three.core.js`, `three.module.js` and
the MIT license from the [official npm distribution](https://registry.npmjs.org/three/0.186.1).
The upstream tarball's SHA-512 integrity was verified before selecting these
2,121,966 bytes. Exact file lengths and SHA-256 pins are checked before parsing
and again at archive admission; the selected source inventory retains the license,
version and upstream integrity reference. Only these byte-pinned vendor modules
are exempt from the application's ban on network loader calls, because the official
Three.js build contains unused native loader implementations. No loaders are invoked
by that exemption; application imports remain explicitly relative, and application
network calls still fail compilation. The full upstream package is not included.

The new scope-owned worker uses `revealline.optional.package.v1:<scope>:` caches.
The historical gym's worker and its existing cache namespace remain unchanged.
Package selection does not install a worker or migrate another package's state.
The integration tests build the actual FPV runtime twice and verify its complete
runtime/source archives, alongside synthetic dependency-tampering fixtures. Those
tests deliberately use synthetic source bindings and cannot replace the clean
committed-input verification performed by the frozen CLI. Neither packaging test
establishes simulator correctness or physical-radio compatibility. The shared
numeric portability helper separately verifies all 24 demonstration replays and
two 3,000-tick stress sequences, with complete-state checkpoints every 250 stress
ticks; its Node result alone does not establish browser agreement.

`optional-package-review.json` starts with every gate pending. The verifier binds
approved evidence bytes to the exact envelope and rejects missing, pending,
duplicate or changed evidence. Human learning, physical devices, installed
identity/isolation, performance and rollback are not inferred from build success.
The candidate verification file therefore records `publicEligible: false`.

The existing guarded release publisher now admits complete optional envelopes and
reviews alongside the unchanged core and company edition contracts. The optional
delivery CLI verifies original bytes, uploads only to an existing draft, and
stages a selector only after downloading the published bytes and independently
checking the release tag's commit/tree:

```sh
node scripts/publish-optional-packages.mjs verify --bundle BUNDLE --review REVIEW
node scripts/publish-optional-packages.mjs upload-draft --bundle BUNDLE --review REVIEW --repository mekhovov/revealline --release-id REVIEWED_DRAFT_ID
node scripts/publish-optional-packages.mjs sync-selector --bundle BUNDLE --review REVIEW --repository mekhovov/revealline --selector publishing/pages-controller/optional-packages.json --base-path /revealline/
```

No command allocates a version, creates a tag, publishes a draft or rebuilds a
qualified artifact. `upload-draft` requires the explicitly reviewed numeric draft
ID and uses that ID's upload endpoint, never a tag-resolved upload. It rechecks
the draft, tag, source and exact asset inventory before and after each POST.
The append-only `optional-package-delivery-attempts.jsonl` records each started
operation and verified or unresolved outcome. An ambiguous interruption requires
fresh draft/asset inspection and explicit recovery review before another POST;
there is no automatic retry. A deliberately resumed command verifies matching
originals without replacing them and retains the first delivery receipt unchanged.
The sole Pages publisher reads the separately pinned optional
selector and copies the exact reviewed bytes into `practice/<id>/releases/<version>/site/`.
A stable `practice/<id>/app/` launcher and explicit manifest ID keep installations
stable across updates. Its local pointers use package identity plus installation
root, and are saved only after successful verified offline preparation. Removal
preserves other roots and packages; a retained previous version remains available.
Workers keep nonoverlapping scopes and explicit cache ownership.

The published `practice/index.json` lists only active reviewed packages. Launchers
and this list do not fetch practice assets automatically. Update checks and entry
into practice require explicit actions. A selector rollback chooses retained
immutable bytes rather than recompiling them:

```sh
node scripts/publish-optional-packages.mjs select-retained --version vX.Y.Z --packages civilian-flight --selector publishing/pages-controller/optional-packages.json --repository mekhovov/revealline --base-path /revealline/
```

The checked-in selector is empty. No optional release has been allocated,
uploaded, selected or promoted by implementing these adapters. Human/device and
performance gates remain pending until actual evidence is supplied.
