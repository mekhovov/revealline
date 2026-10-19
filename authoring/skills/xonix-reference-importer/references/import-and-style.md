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

For generation and editing, use the image tool available to the agent. For authoring integration, consult the actual local presentation/media contract before writing data. The [Round 10 research note](../../../../docs/research/round-10-reference-and-import.md) explains the observed access boundary, Reloaded feedback proposals and current engine recommendation.
