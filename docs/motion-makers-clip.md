# Motion Makers original concept clip

`fpv-meet-aircraft-02` can append the shared knowledge and native-video payloads from
`game/company-campaigns/curriculum-motion-makers.mjs`. The helper requires its six exact
publicly admitted originals. It never alters a reward requirement, campaign finale or gameplay.

The silent 12-second, 960 × 540, 24 fps clip is original code-drawn artwork. Its stationary
amber inner stator, moving cyan rotor markers and separated propeller icon distinguish roles.
The outer moving rotor avoids describing a common FPV outrunner's bell as stationary. All
geometry, dot movement and rotation speed are deliberately schematic. It contains no wiring,
installation dimensions, recommended direction, flight procedure or performance result.

The art uses an original small English/Ukrainian pixel alphabet, no copied photography or fonts,
and no music. [NASA's propeller explanation](https://www.grc.nasa.gov/www/k-12/airplane/propeller.html)
and [electric-machines overview](https://www.nasa.gov/eap-technology/electric-machines/) inform
the general motor/propeller roles; neither source is claimed as the maker or reviewer of this
fictional drawing. No source image is reproduced.

## Production and review

The authoring-only script streams deterministic RGBA frames to an installed `ffmpeg` with
libx264. It is not a player dependency and downloads nothing:

```sh
node scripts/produce-motion-makers.mjs --output=/tmp/motion-makers-review
```

Use a fresh review directory. The command writes an MP4, a complete static PNG poster,
English/Ukrainian plain WebVTT and English/Ukrainian untimed descriptions. It prints byte
hashes and encoder arguments. The fixed single-thread settings produced byte-identical
six-file results in two runs with ffmpeg 9.0.2/libx264 on the authoring host. Codec/toolchain
changes can change encoded bytes; compare exact hashes and review new originals deliberately.
Do not overwrite an admitted revision and silently change its pin.

Review decoded opening, middle and final frames. Confirm the stator stays still, rotor and
propeller movement remains slow and legible, and the final view matches the complete poster.
Read both captions and full descriptions, including the schematic limitations. Human pacing
and physical-device playback remain separate evidence; this source review does not claim them.

The existing reward player loads the poster and untimed description without playback, requires
an explicit Play action, and uses the existing native caption, pause, focus and media ownership
handling. Reduced-motion users can use the complete static explanation. Playback is optional
and earns no extra completion. The regular six-win campaign rule is unchanged.

```sh
node --test game/test/company-motion-makers.test.mjs game/test/reward-media.test.mjs
```

The focused tests check actual container duration/dimensions/silence, exact six-file closure,
captions and poster reproducibility, stationary stator pixels, rejection of changed or private
originals, and unchanged reward requirements. Existing media tests cover native ownership,
explicit playback, missing media, export/import and Studio/player reuse.
