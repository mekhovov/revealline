# Unique guided backup download observation

On 2026-09-15, the root reviewer used the immutable source preview at `http://127.0.0.1:56297/game/`, commit `050a02aacd730db6be9f4a7edb496d4135451bbe` (tree `dd9e05226dd42d0265ae4fbcf2223b7981ac910f`). This was a source preview, with `dev` / `dev` / `null` edition/channel/source in coverage; the preview receipt and HTTP source headers supply the separate source binding.

Five explicit Enter activations with sequential Tab focus produced five actual files in Downloads, all under prefix `RevealLine-backup-20260915T050434355Z-e6814d7631d74c179f839797f649b5d0-`. The browser added no rename suffix, and no owned copy or normalization was needed. The four component byte lengths and SHA-256 values matched the downloaded report. The existing strict read-only checker verified that actual Downloads set on Node 20 and Node 22.

| Component suffix     |  Bytes | SHA-256                                                            |
| -------------------- | -----: | ------------------------------------------------------------------ |
| `game-data.json`     |    799 | `3ca2d3463c403a61c25dcfd63651ac283304cf58e073bdb42c81a61ed520aae8` |
| `originals.rlmedia`  | 56,378 | `c731a8cc0e70008a12c9cdc40e2c7350125a74d4f0e2f388fd7cbf2fdff83b82` |
| `stories.rlstory`    | 15,554 | `a69e6079c984ae471073c2f921a52705d6a14daf380eaed24f507d18e9cef7b5` |
| `soundtrack.rlsound` |    192 | `97cf00ac47a512848c19869483c075c69b1142da21e8a15ddced77b31f1a4d1e` |
| `coverage.json`      |  2,640 | `be81d42b6e7d0cda875cda47e84e77a1fdb20aeaed67f942872685dd9c2b09d5` |

Total: **75,563 bytes**. The profile contained an empty player library and default saved metadata, with no custom uploads or flight. Its coverage includes one retained 40,810-byte still original and zero video/MP3 originals; empty player progress does not mean all shared media storage was empty. Back returned to Settings with Saves focused, then Title with Settings focused, as observed by the root reviewer.

The same observation exposed long raw filenames as oversized primary link text. The subsequent short-purpose-label / **File names** disclosure change preserves these file bytes and naming rules, but its responsive layout, disclosure and new labels require their own native review. This receipt does not qualify custom media upload, restore, codec/playback, offline use, earned ownership or a frozen release. Keep the [earlier fixed-name a858 observation](guided-backup-a858-downloads.md) as a distinct historical record.

Retained local evidence is under `.cache/round47/guided-backup-050a02a-preview/`:

- `actual-downloads.json` — 4,577 bytes, SHA-256 `9e99642f0acf690705fc1ea506c122d2366c0bbf039db168e880b09e6509c340`.
- `actual-cli-node20.json` — 2,330 bytes, SHA-256 `2c79f941ebaf9bc0dcd4f41737ccc1dec4beabf3268d3396fc3fbf126b221f39`.
- `actual-cli-node22.json` — 2,333 bytes, SHA-256 `b1958ba1eeb8bb8ce41fec5611da710f03f012b0ee7bb8149afadb1a3a784f5b`.
- `native-all-requested.png` — root screenshot of the five requested downloads; visual evidence was observed by the root reviewer, not rerun by the source reviewer.
