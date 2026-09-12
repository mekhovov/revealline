# Keep playable versions

Commit source changes to retain the code and content that produced a version. The CLI's release snapshot then builds that saved Git revision into an independent local folder. It never checks out a branch, changes the index, creates a commit or moves a tag.

## Create and compare

After the intended revision has been committed and the requested tag/ref exists:

```sh
node scripts/game-cli.mjs release-snapshot --ref YOUR_SAVED_TAG --version YOUR_RELEASE_LABEL
node scripts/game-cli.mjs serve --root releases --port 8770
```

Open [the version index](http://127.0.0.1:8770/). It links each label to its playable site, distribution ZIP and release metadata. The uppercase values are placeholders: choose an existing ref and a new label. `release-snapshot` does not invent or create either Git history or a tag. A valid local commit hash, tag or branch can be supplied; the tool resolves it to a complete commit hash before archiving.

For a separate browser origin and isolated origin-scoped saves, serve one version directly:

```sh
node scripts/game-cli.mjs serve --root releases/v0.1.0/site --port 8771
```

This example uses an already saved v0.1.0 folder; substitute the version being compared. Open [that version](http://127.0.0.1:8771/game/). Two paths on the same host and port still share an origin. In v0.2.0, player libraries, installed packs and suspended-attempt slots separate development and release channels, while a release channel keeps its player profile across build versions. Campaign content identity partitions progress, gallery and score records within that profile; installed-pack data uses a separate store. Earlier v0.1.x keys remain version-specific and require an explicit compatible migration. Separate ports isolate all browser storage, including practice transfers and offline caches. A different path or service-worker scope alone does not isolate local storage. Do not treat study fixtures as earned progress.

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

Use the package/build version for a shipped artifact, and keep level IDs/revisions and simulation rules separate. Plan how an art-only update retains earned cosmetics and never grants class advantages. The current campaign key conservatively includes normalized level and full recipe data; even presentation metadata can change its identity. Retain old partitions and add an explicit migration when intended, rather than silently assigning old results to changed content. A rule, map or scoring change needs a deliberate replay/result compatibility decision, even if the public package version is a small increment. A seed reproduces generator choices only with its generator version; retain the explicit generated JSON in reviewed content for long-lived levels.

The current simulation is `xonix-core.v2`; recorded runs use `xonix-replay.v3`. Preserve old executable builds for old replay versions. A saved-attempt envelope also needs the matching campaign and class roster before it can resume. Use a [full backup](full-backup.md), or export player libraries, pack libraries and unfinished attempts separately when comparing or moving installations; [library/pack workflows](library-and-packs.md) and [replays](replays.md) describe the boundaries.

Built distributions have an explicit, content-addressed offline installation scoped to their own directory. Keep public release paths immutable: an older worker rejects changed bytes instead of mixing code from different builds. Storage can be evicted, so offline caching does not replace portable saves or an external artifact backup. See [offline releases](offline-release.md).

Before taking a release snapshot, validate the content, run relevant behavior tests, inspect the built browser game and record what devices were actually exercised. Keep experimental motion-lab profiles separate from game progress. The package version `0.2.0` describes the current source; it does not prove that a saved snapshot, remote deployment or native store package exists. See [development](development.md), [deployment](deployment.md) and the [public-release gate](public-release.md) for the required evidence.
