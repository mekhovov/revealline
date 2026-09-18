# Guide copy/source review

Compared the retained guide with actual Studio handlers on 61cf9c14. Scoped updates explain preparation → staging → saving/exporting and remain inside the working page.

- `requireSettled`, `startUpload`, `validatePending`, save/export/import, reset/reload and history handlers support the stated operation and byte-retention distinctions. Recipe-only slots reject image uploads; source recipe changes remain reviewed code or supported tokens.
- Corrected a stale documentation paragraph: loadWorkspace restores saved work, otherwise verifies the compiled collection, with source fallback only where no collection exists. It does not always start with source-only assets.
- Corrected a requirements overstatement in the existing upload guide: creator/source/rights are required, while prompt is recorded when used. Runtime does not require a nonempty prompt. Inline copy now uses the same wording.
- Description of field context and technical validation remains bounded; no full cross-mode playthrough or production-art approval is claimed.
- Current Enter/Space, focus, held-Escape and terminal cleanup require their event and native checks. This prose review is not a browser, physical-device, upload/download or release qualification.
