# 1994 Forever — seven player-body source candidates

Seven independently generated original bodies for the existing `scout`, `bomber`, `carrier`, `interceptor`, `fiber`, `impact`, and `trapper` roles. The shared vocabulary is an original top-down arcade spacecraft/toy-robot collection with cream shells, cyan forward cues, magenta fittings, and dark outlines.

These are source candidates on an isolated branch based on `e9928cdaad2f55d912aadd2ef25f635fb99e938c`. They are not installed in the game and do not constitute seven animation rigs. No runtime registry, presets, build configuration, collisions, abilities, release assets, or existing role IDs changed.

| Existing role | Distinguishing source shape | Original PNG bytes |
| --- | --- | ---: |
| Scout | Round saucer with attached cyan north nose | 861,737 |
| Bomber | Broad manta shoulders and large closed magenta bay | 925,255 |
| Carrier | Blocky H, six cargo blocks and central bridge | 847,580 |
| Interceptor | Pointed delta with swept fins and forked stern | 706,515 |
| Fiber | Unequal square counterweight and large round spool | 830,708 |
| Impact | Blunt armor bar, cyan visor and chunky rear legs | 831,788 |
| Trapper | Open square cage with cross struts and corner pads | 733,320 |

The seven PNGs total **5,736,903 bytes**. Every returned image is **1254 × 1254 RGBA, 8 bits per channel**, despite the prompts requesting 1024-square output. Exact tool originals, original filenames, prompt text, PNG chunk validation, SHA-256 values, and exclusive APFS clone provenance are retained. Each image came from a separate fresh text-only `image_gen.imagegen` call. Existing FPV and Ukraine scout sources informed conventions through visual inspection; no reference image pixels were supplied to these calls.

The full images have been inspected individually with `view_image`. All visible body parts are inside the frame, and all seven substantial alpha bounds (alpha at least 128) are inset. Bomber's 20-pixel side margins and Interceptor's 36-pixel nose margin are tighter than requested. Low-alpha fringes reach canvas edges in six images, so these are not uniformly clean padded masks. The originals contain actual transparent pixels plus many intermediate-alpha pixels. The requested 16-color limit was not achieved; exact distinct RGBA counts are recorded in [alpha-inspection.json](provenance/alpha-inspection.json). No image was cropped, resized, palette-reduced, flattened, or otherwise edited.

[The inspection board](inspection/index.html) displays the unchanged originals at 24, 32, and 56 CSS pixels over black and a retained Retro reward-picture crop. Its visible controls choose North/East/South/West and Auto/Pixelated sampling. The reference scene is served read-only by the owned preview from the separate reserve illustration collection, without adding a duplicate image here. Opening this HTML alone requires a `/scene.png` route; the body paths remain relative. [Native screenshots and findings](inspection/game-scale-receipt.json) retain North/Auto, East/Auto, and settled East/Pixelated states. All seven broad shapes remain distinguishable on black and the scene at the reviewed CSS sizes. At 24 pixels, Carrier/Fiber/Trapper interior detail compresses and directional reading is less immediate than Scout/Interceptor. Pixelated sampling produces noisier fine highlights than Auto. The transitional capture is explicitly labeled East/Auto despite its original filename. CSS presentation is not a gameplay, physical-device, animation, or hitbox test.

Forward is up in every source. A centered paint pivot and the stern socket, payload-bay, spool, or corner-pad locations are proposals for later authoring work. No numeric anchor contract is emitted. Static painted parts cannot independently animate without additional source work; any later rigid-body bank, engine effect, cable, payload, or trap motion requires its own design and validation. These large authoring originals also need a separately reviewed runtime sizing and loading decision.

Example prompt directions: “broad round cream disk with an attached cyan north nose” for Scout, “unequal square counterweight and large magenta annular spool” for Fiber, and “open square cage with four large interior windows” for Trapper. Full prompts, rather than these short summaries, are retained under `prompts/`.

The new-data allowance is 32 MiB including retained tool originals, eventual Git data, and small inspection artifacts. APFS workspace clones have independent inodes but initially share storage; logical file sizes are not presented as exclusive allocation. The original bytes plus a raw same-size Git allowance and a 2 MiB metadata/inspection reserve total **13,570,958 bytes** before final measured staging. Source generation and inspection require no production build or test run.
