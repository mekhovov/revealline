# Correction: Enemy Workshop is part of the public package

Earlier v0.61.3/v0.61.4 summaries and qualification prose described Enemy Workshop as excluded from the public runtime or source-only. **That statement is incorrect.** The v0.61.4 frozen manifest positively includes:

| Exact manifest path | Bytes | SHA-256 |
| --- | ---: | --- |
| `authoring/enemy-catalog/index.html` | 2,496 | `bad9b572099658506952017b2fa3285af417a7e0d008f599a3fe5e99a2085c4a` |
| `authoring/enemy-catalog/workshop.mjs` | 8,081 | `efae0756a2a6110e7ca33696dea3942f43c11e56eec2673e2c94279dce39820c` |

The accepted deployed inventory matched the immutable entries, and root actually opened Enemy Workshop through the public Workshop menu. It loaded seven roles and four presentations. Closing the initial catalog with Escape left document/body focus; subsequent Escape/Tab did not recover a visible target in that observation. Pointer Return restored the game. That remaining issue belongs to the prepared v0.61.20 correction and later public verification.

The original manifest paths are relative to the artifact root. Searching only an assumed `site/authoring/` prefix can miss these positive entries; the public publisher's `/releases/<version>/site/` URL prefix is a separate mapping. Determine packaging from full exact manifest entries and the actual hosted inventory, then check the real route. Do not infer exclusion from a failed search or from the kind of tool.

Historical originals remain byte-exact, including the incorrect prose and its reviewer approval. This dated correction supersedes their packaging statement. It does not turn earlier source-preview actions into public testing or imply that the remaining focus defect passed.
