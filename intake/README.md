# Soundtrack intake from the game repository

`add-music.mjs` is a launcher for the intake tool maintained in the separate
[RevealLine Soundtracks 02](https://github.com/mekhovov/revealline-soundtracks-02)
repository. It lets a contributor start in this game checkout while catalogue,
rights evidence, immutable MP3 paths and the archive pull request remain owned
by the archive repository.

```sh
node intake/add-music.mjs "/path/to/cleared-mp3-or-folder" \
  --archive-root "/path/to/revealline-soundtracks-02" \
  --artist "Creator name" \
  --source "https://creator.example/album" \
  --rights-evidence "https://creator.example/album#license" \
  --license cc-by-4.0 \
  --styles "rock,electro,gameplay" \
  --description "Collection description" \
  --confirm-rights
```

The archive checkout must be clean. The launcher also checks the
`REVEALLINE_SOUNDTRACK_ARCHIVE` environment variable, a sibling
`revealline-soundtracks-02` clone and the standard Codex worktree location. Use
`--archive-root` for an unambiguous checkout. Add `--open-pr` only after the
generated batch has been reviewed.

One public intake accepts at most 20 MP3s and 64 MiB. The public workflow
requires recording-specific permission for public MP3 redistribution and
web-game playback. A YouTube URL identifies a source but does not grant those
rights.

For the 80-file UA-FPV folder whose public rights remain unverified, build
private local album files with the same launcher:

```sh
node intake/add-music.mjs "/absolute/path/to/docs/research/dah-soundtracks" \
  --license unknown \
  --private-output "/absolute/path/to/new-empty-private-directory"
```

`--license unknown` is private-only. It cannot be combined with `--open-pr`,
`--confirm-rights` or `--archive-root`, and it never writes to either public
soundtrack archive. The equivalent direct builder command is:

```sh
node scripts/ua-fpv-local-pack.mjs \
  --source-dir "/absolute/path/to/docs/research/dah-soundtracks" \
  --output-dir "/absolute/path/to/new-empty-private-directory"
```

Import the generated `.rlsound` volumes through **Music Studio → Backups & album
files → Add album file to draft**, save each volume, then select its UA-FPV
playlist. See [the complete private-upload guide](../docs/ua-fpv-upload-guide.md).
