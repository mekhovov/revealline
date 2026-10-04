# Examples for installed worlds

Draft prerequisite for D5; browser/package qualification and publication remain pending.

An installed world can import and verify a demonstration yet have no Watch action:
the host only searched optional records for built-in catalogue entries. Conversely,
an imported copy of a built-in course could borrow its bundled example without
matching the imported pack's dependency identity.

The focused host change keeps bundled examples scoped to built-in entries. Installed
projects use only verified, completed demonstration records with the exact
`fpv-pack:<SHA-256>`, normalized course (including revision), requested mode,
runtime model/backend and self-consistent recorded response identity. Lookup cache
keys include project, pack and mode. Full independent replay before playback remains
the authority for physics, course/world/rules/conditions identities and final state.
Lookup does not construct a physics world. Import verification, missing/invalid
record bytes, dependency guidance, rewards and playback pause guards are unchanged.

The draft is based on main `5931ef12678cc52ab332fbbfe5516ad93a60caa9`; only
`world-app.mjs` changes among admitted runtime inputs, growing by 474 bytes.
Capacity PR #1047 is independent. Its reviewed integrated reserve of 17,552 bytes,
less the projected 6,281-byte coaching change and this draft, leaves 10,797 bytes
before D4 mode editing. This is arithmetic, not a combined admission result.

The manual preparer executes the actual private lookup functions extracted from
the host through Acorn, with real course validators and recorded proofs. Its 46
functional checks include baseline reproduction, exact positive lookup, wrong
pack/revision/mode/session/response/runtime controls, invalid/missing/incomplete
records, cross-pack shared-object cache separation and copied built-in exclusion.
Both retained D4 industrial split-level authoring recordings keep every ordinary
control and final identity; only their session marker changes to demonstration.
Independent replays complete at 4,024 Self-level and 3,670 Acro ticks. Archive
import resets claimed verification as expected. This is source-level evidence,
not a native browser or final package pass. No new unit coverage is added.

The bounded browser fixture uses the full immutable d9ad admitted player closure
and an explicit source-host overlay. Native File imports/IndexedDB and actual
catalogue actions compare baseline and candidate, exercise proof removal/import,
same-course alternate pack SHA, retained revision activation, pack removal with
proof preservation, exact reinstallation, HTTP reload and two complete rendered
Watch replays without rewards. It keeps the real performance clock and pause
guards, uses controlled RAF timestamps, and stops on lost focus, unexpected pause
or stalled progress. It does not claim FPS, physical device acceptance or offline
qualification. The admitted player contents are never modified in place.

Prepare from retained D4 authoring proofs, then freeze for root-owned browser work:

```sh
node scripts/qualify-fpv-imported-examples.mjs \
  --starter /absolute/path/to/retained-d4-r5 \
  --out /tmp/new-imported-examples-data
node scripts/prepare-fpv-imported-examples-browser.mjs \
  --player-root /absolute/path/to/immutable-d9ad-player \
  --player-receipt docs/evidence/fpv-world-disposal-admitted-player.json \
  --data /tmp/new-imported-examples-data \
  --out dist/fpv-imported-examples-new
```

After this prerequisite and D4 mode editing, the next content increment is
[Mountain Reservoir](fpv-mountain-reservoir-readiness.md): one external authored
world, eight distinct bilingual courses and sixteen optional exact-pack examples.
The readiness audit specifies original asset/provenance, collision, budget,
distribution and acceptance limits. No reservoir content is delivered by this
lookup fix.
