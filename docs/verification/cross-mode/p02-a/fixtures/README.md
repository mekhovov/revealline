# Owned native-audio test signals

These two 32,600-byte MP3s are original programmatically generated CC0 signals for P02-A behavior checks, **not album assets or finished music**. [owned-media.json](owned-media.json) preserves the original size/hash, two note frequencies, 88,200 mono PCM samples at 44,100 Hz and encoder identity. Rising uses 440/660 Hz; falling uses 660/440 Hz. The [generation script](create_owned_chimes.py) is copied byte-exact from root's owned cache; the two [rising](rising-chime.mp3) and [falling](falling-chime.mp3) originals are unchanged.

Root imported both through the UI and observed native duration 2.0375 seconds (including MP3 encoding padding). The generated PCM is two seconds; these durations are different representations, not a mismatch. The [integration record](../integrated-source-native.json) pins these files and the script. No audible listening, musical review, codec-wide support or physical-device result is claimed.

The script requires optional `lameenc==1.8.4`, imported from a sibling `audio-tool` directory. To reproduce in a fresh private directory from the project root, with sufficient temporary capacity:

```sh
p02a_fixture_dir=$(mktemp -d "${TMPDIR:-/tmp}/p02a-chimes.XXXXXX")
cp docs/verification/cross-mode/p02-a/fixtures/create_owned_chimes.py "$p02a_fixture_dir/"
python3 -m pip install --only-binary=:all: --no-deps --target "$p02a_fixture_dir/audio-tool" lameenc==1.8.4
python3 "$p02a_fixture_dir/create_owned_chimes.py"
```

This is a documented optional reproduction command, not a command executed by the evidence packager. The script writes its sibling filenames, so do not run it inside the retained fixture directory. Compare regenerated hashes with the original metadata; do not replace original evidence to accommodate a different wheel/platform result. No project runtime or mandatory test dependency is added.

Earlier `afconvert` encoding refusal and an unavailable 1.8.1 wheel were local fixture-tool setup failures, not game failures. The failed empty MP3 is deliberately excluded. The final production script and `lameenc` 1.8.4 outputs are the only fixture authorities here.
