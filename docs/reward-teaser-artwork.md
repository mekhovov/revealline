# Separate discovery preview artwork

`CompletionRewardDefinition.v1` accepts an optional `teaserImage`:

```json
{
  "asset": { "assetId": "workshop-preview-v1", "sha256": "<64 lowercase hex characters>" },
  "locales": {
    "en": { "alt": "A closed workshop exhibit with six empty stands" },
    "uk": { "alt": "Зачинена виставка майстерні із шістьма порожніми підставками" }
  }
}
```

The asset must be an approved PNG, JPEG or WebP in the selected edition's existing asset inventory and campaign dependency list. Its ID and SHA-256 must differ from earned payload media, including an earned cosmetic image. The compiler verifies exact bytes and the existing 4 MiB raster limit; edition, offline and source-publication budgets still apply. No external image URL or runtime SVG is accepted.

The shared Level/Campaign and Company Studio discovery editor offers a separate preview-art fieldset. Enter the registered asset ID, SHA-256 and both descriptions, then preview an explicitly chosen local original. Preview checks the exact hash and raster format without uploading, importing, saving progress or earning a reward. Apply/Remove use the existing versioned reward sidecar editing path and rebind authored reward references. Company Studio source packets and compiled player exports retain the same pins.

The ready card and campaign finale offer an explicit preview action. Collection's picture toggle shows separate teaser artwork on locked cards and earned pictures on collected cards. No locked surface falls back to earned media. Without a teaser image, the existing text promise remains. Missing exact art retains the text and progress; it never substitutes newer art. Closing a surface, changing presentation or disposing it cancels requests and releases owned image URLs. Collection retains at most twelve images and loads two at a time; the campaign selector retains at most one explicit preview.

Adding or removing preview artwork changes the authored presentation/reward revision, not mission gameplay identities or requirement sets. Existing player promises and receipts keep their exact original definitions, so retained presentation snapshots must include old teaser assets when needed. Definitions without the optional field serialize unchanged. Authored teaser production and review remain separate from these framework capabilities.
