# Import commands and original-art prompts

Run commands from the repository root. Replace example local paths with actual supplied files. No command sends a message, uploads artwork, searches for credentials or binds an image to gameplay.

```sh
python3 scripts/telegram-reference.py preview --pack vector_monitorwar --out references/vector-preview-01
python3 scripts/telegram-reference.py local --pack vector_monitorwar --out references/vector-selected-01 /absolute/path/plane.png /absolute/path/loop.tgs
python3 scripts/telegram-reference.py api --pack vector_monitorwar --out references/vector-api-01 --token-prompt
python3 scripts/telegram-reference.py api --pack vector_monitorwar --out references/vector-api-originals-01 --token-prompt --download --max-items 200
python3 -m unittest discover -s scripts -p 'test_telegram_reference.py'
```

`preview` saves public HTML and a manifest, not member images. `local` preserves supplied originals and records user-asserted membership. `api` reads the official custom-emoji set; downloading originals is explicit. Use `--token-env MY_CHOSEN_TOKEN` only when that variable was deliberately supplied. Never put the token value in an argument or a saved prompt. The API mode was tested with offline responses in Round 10; no live token was supplied. If local TLS fails, fix the interpreter trust store or choose a correctly configured interpreter; do not disable verification.

The output format is `telegram-reference.v1`. `items[]` records content hash, byte count, local original path, format, limited inspection, source provenance, unknown rights and reference-only usage. `metadata[]` in API mode describes selected set members. `inventoryComplete` describes the item-limit boundary; `originalsComplete` additionally requires every selected/full-set download to succeed. Public/local imports cannot establish a complete pack count. No manifest is a game pack or a production rights approval.

Original files can be supplied through whatever ordinary Save/Export function the installed Telegram client provides, or directly by the creator. Do not claim a whole-pack export control exists unless observed in that client. Keep screenshots distinct from source originals. The current Vector @monitoringwar public page exposes the title and generic Telegram logo only; it does not provide inspectable member artwork.

## Prompt examples

These are authoring prompts to adapt after inspecting real inputs, not claims that generation has already occurred. Replace bracketed placeholders with verified files or findings. If a reference is unavailable, request the missing visual through the normal conversation and continue the independent inventory/documentation work.

1. **Silhouette analysis:** “Inspect [provided emoji image]. Describe its visible axis, negative spaces, value groups and readability at 16, 24 and 32 pixels. Distinguish observation from inferred identity. Propose three general visual principles to reuse without tracing its specific design.”
2. **Original FPV body:** “Create an original top-down pixel-art quadcopter for a fictional Ukrainian-themed arcade game. Use [observed broad readability principles], but invent the chassis, arm proportions, color grouping and markings. Transparent background; north-facing center; separate body from animated blades. No text or specific manufacturer's logo.”
3. **Original heavy carrier:** “Design an original six-arm arcade carrier with a readable compact center, broad negative spaces and a small fictional cargo latch. Use graphite, muted olive and warm amber accents. Keep props, cargo and rotor blades as independent planned layers; do not depict real payload specifications.”
4. **Original heritage variation:** “Turn the general idea of a clear north-facing silhouette into an original Ukrainian-inspired swallow with restrained woven geometric accents. Create a bird identity rather than repainting a drone. Preserve a compact gameplay center; author separate wing attachment positions.”
5. **Original 1994 variation:** “Create an original 1994-inspired cartridge-era courier craft: chunky silhouette, three value groups, cool body, warm leading light, transparent background. Use an invented design. Keep a separate thruster layer and avoid detail that vanishes at 24 pixels.”
6. **Original business variation:** “Create an original friendly Spend Sprite for a fictional business-platform theme, using clear icon proportions and blue/cyan accents. No military markings, official Coupa logo or claimed Navi identity. Suggest separate pulse and status-light attachments.”
7. **Animation analysis:** “Inspect the supplied [TGS/WEBM or supported preview] only through an available viewer. Record which frames/motion were actually seen, then describe phase, silhouette change and loop continuity. Preserve the original file; do not silently rasterize or claim timing from an unseen animation.”
8. **Independent bindings:** “Take reviewed generated variant [path] and propose the actual presentation entry, body dimensions, heading, approximate motor/wing anchors and animation recipe. Keep collision center, turn policy, ability class, equipment and unlocks unchanged. Mark unsupported fields as proposals rather than inserting an invented schema.”
9. **Small-screen comparison:** “Show this original variant beside the existing compact body on the same board at desktop and phone scale. Compare player location, unfinished cut and next-turn readability. Keep identical positions, route and hazards; use a larger inspection view for decorative details.”
10. **Provenance review:** “Audit these imported originals and generated variations. Check hashes, unchanged source bytes, which images were actually inspected, effective prompts, source/variant links and rights evidence. Report reference-only files that accidentally entered a shipping manifest, without assuming all public Telegram art is licensed.”

For generation and editing, use the image tool available to the agent. For authoring integration, consult the actual local presentation/media contract before writing data. The [Round 10 research note](../../../../docs/research/round-10-reference-and-import.md) explains the observed access boundary, Reloaded feedback proposals and current engine recommendation.
