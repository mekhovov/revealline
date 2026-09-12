# Keep playable versions

Commit source changes to retain the code and content that produced a version. The CLI's release snapshot then builds that saved Git revision into an independent local folder. It never checks out a branch, changes the index, creates a commit or moves a tag.

## Create and compare

After the intended revision has been committed and the requested tag/ref exists:

```sh
node scripts/game-cli.mjs release-snapshot --ref v0.1.0 --version v0.1.0
node scripts/game-cli.mjs serve --root releases --port 8770
```

Open [the version index](http://127.0.0.1:8770/). It links each label to its playable site, distribution ZIP and release metadata. The example ref is illustrative: `release-snapshot` does not invent or create it. A valid local commit hash, tag or branch can be supplied; the tool resolves it to a complete commit hash before archiving.

For a separate browser origin and isolated origin-scoped saves, serve one version directly:

```sh
node scripts/game-cli.mjs serve --root releases/v0.1.0/site --port 8771
```

Open [that version](http://127.0.0.1:8771/game/). Two paths on the same host and port still share an origin. This game separates campaign save keys by development/release channel, build version, campaign ID and campaign revision. Use distinct labels for frozen versions. Separate ports add origin isolation for all browser storage, including the practice pack transfer. Do not import study fixtures or old saves into production progress without an explicit compatible migration.

## What is frozen

`releases/<version>/` contains:

| File/directory | Meaning |
|---|---|
| `source.tar` | `git archive` of the resolved commit; uncommitted and ignored working files are absent |
| `site/` | Static distribution built by the CLI contained in that archived revision |
| `release.json` | Version, exact commit and SHA-256 of the source archive, site manifest and distribution ZIP |

The shared `releases/index.json` and `index.html` list the saved labels. Version labels accept letters, digits, dots, underscores and hyphens, start with a letter/digit, and cannot contain `..`. Labels matching the two index filenames are reserved. Existing labels are never overwritten. `releases/` is generated local output, not automatically a remote backup. Copy or publish the reviewed artifacts separately if durable external storage is required.

The snapshot archive is extracted into a temporary directory with path checks. Symbolic/hard links and special file types are rejected. The selected revision must contain the build CLI and its complete vendored/browser inputs. The frozen CLI executes from that trusted local revision; select only repository revisions you intend to run. Pre-runtime research revisions can still be retained in Git, but cannot be advertised as playable releases.

No build timestamp is injected into playable assets. Source hashes, version labels and checked-in rules/content make comparisons traceable. Reproducibility means the same recorded inputs and tool produce the same bytes; it does not prove gameplay determinism, fairness or compatibility with another version's saves.

## Version decisions

Use the package/build version for a shipped artifact, and keep level IDs/revisions and simulation rules separate. An art-only update should not silently reset earned cosmetics or grant class advantages. A rule, map or scoring change needs a deliberate replay/result compatibility decision, even if the public package version is a small increment. A seed reproduces generator choices only with its generator version; retain the explicit generated JSON in reviewed content for long-lived levels.

Before taking a release snapshot, validate the content, run relevant behavior tests, inspect the built browser game and record what devices were actually exercised. Keep experimental motion-lab profiles separate from game progress. See [development](development.md) and [deployment](deployment.md) for commands and delivery limits.
