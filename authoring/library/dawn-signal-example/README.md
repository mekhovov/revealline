# Dawn Signal — explicit story example

This example binds the owned eight-second silent Dawn Signal movie and its exact native ending-frame PNG to **base-game First Signal → First Signal → FPV Front**. It is separate from optional chapter packs. The exact authored identity is `first-signal/2/88639f3aab7b6cc1`, map `signal-01`, revision `1`, theme `fpv`.

The helper produces a new pair through the public `.rlmedia`/`.rlstory` APIs. It does not export browser storage, install a pack, award progress or alter a current/saved flight. The observed native browser's download requests have not yielded verified disk bytes; these files are explicitly **CLI-produced**, not substitutes for evidence of native download completion.

From the repository root, run:

```sh
node authoring/library/dawn-signal-example/build.mjs .cache/dawn-signal-example/NEW-CANDIDATE
```

The output directory must be new and inside this checkout's `.cache`. Existing directories and symlink parents refuse; no hostile concurrent-rename guarantee is claimed. Output contains `Dawn-Signal-originals.rlmedia`, `Dawn-Signal-stories.rlstory` and an identity/hash manifest. The producer pins its input campaign/classes/themes and both original media files. A changed input refuses rather than silently changing this immutable example.

The PNG is the unchanged 442,522-byte native frame at **95/12 seconds** from [the original candidate](../dawn-signal-story/README.md). The Node decoder verifies PNG chunks/CRCs, bounded full inflation and all RGB row filters; it does not re-encode the file. The unchanged 713,732-byte MP4's dimensions/duration come from its retained native inspection. CLI export verifies original bytes and descriptors; browser import must inspect the actual codec again.

## Explicit import

1. Open this edition's **Picture Workshop**, then **Open local media**. Choose the `.rlmedia` file, review, and explicitly restore originals. The default policy preserves conflicting current assignments; choose replacement only when you intend the file's exact assignment set to replace yours. **Choose Reload saved media and installed maps before continuing.** Restoring the picture invalidates the current editing context, so the other tools remain disabled until this explicit reload.
2. Choose the `.rlstory` file, select **Restore incoming bindings**, review, and explicitly restore stories. The exact retained poster must already exist. Reload afterward.
3. In the game, choose base-game First Signal, its First Signal mission and FPV Front. Start a fresh attempt and earn the picture. **Victory story** offers explicit Play/Skip; Collection retains the first-earned story. Previously earned/null entries and saved flights keep their earlier choices.

The pair contains one still, one movie and retained owner/descriptor history. It contains no game progress or soundtrack. Importing the example does not change existing first-earned receipts. There is no silent installation or default assignment for all users. Fresh-origin native import/playback and later packaged/offline/public checks remain separately recorded acceptance gates.
