# Actual Round 06 concept library

[media.json](media.json) is an executed example of the new local asset workflow using this project's generated concepts. It contains the previous board, the corrected derivative and the three-chapter variation sheet. Source and derivative bytes are stored separately with computed hashes and dimensions. The edit's full effective prompt and parent hash are recorded; the built-in image tool did not expose an exact model version, which is stated honestly in metadata.

Bindings use `concept.board` and `concept.asset-study`, deliberately separate from game player, terrain or reveal-image roles. These composite images are design references, not transparent sprites or playable backgrounds. The older image remains as source provenance; its markings are superseded by the corrected variant.

All three assets remain `imported`. Manual concept-review findings are in [the visual review](../../../docs/concepts/round-06-review.md); there is no production-ready declaration. The `mediaVersion` format is separate from the existing content-pack schema and is not consumed by a game runtime.

Validate from the project root:

```sh
python3 authoring/media/media.py validate authoring/library/round-06-fpv/media.json
```
