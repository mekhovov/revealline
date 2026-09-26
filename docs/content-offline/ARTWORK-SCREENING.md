# Artwork screening and review gate

[Open the contact sheets](artwork-screening.html). The supplementary report reads the complete ownership inventory and unchanged source originals. It adds exact decoded-pixel rotation/reflection detection and reproducible nearest neighbours. It does not change current missions, original bytes, saved pictures, rights records or published releases.

The baseline contains known cross-owner copies. Ordinary generation and `--check` record them without failing existing-content publication. They are unresolved findings, not an exception granted to new artwork.

## Pinned implementation and bounds

`scripts/artwork-screening.mjs` is the versioned local implementation. Its SHA-256 is recorded in every report. The existing RGB8 PNG decoder is pinned to `100995d31bb65ed7797b0941988624cab76a2c37b297c81ec98ab8e16febcc34`. A second bounded scan exposes samples and must match that decoder's pixel hash. A changed decoder fails until its implementation and screening version are deliberately reviewed. Images are processed one at a time; only small comparison signatures remain in memory.

- Maximum 1,024 originals, 4 MiB per source file, 8,192 pixels per side and 16 megapixels. Unsupported PNG color types, animation, transparency or interlacing fail through the existing decoder contract.
- Exact matching hashes dimensions plus RGB8 pixels for identity, 90/180/270-degree rotation and all four reflected orientations. Encoded metadata differences cannot disguise an exact composition.
- Similarity uses a 16 × 16 area-mean luma grid, 256 mean-threshold bits and 480 directional-gradient bits. Gradient disagreements count twice: distance ranges from 0 to 1,216. Luma uses integer `(77R + 150G + 29B) / 256` on encoded samples; no browser color conversion is inferred.
- Full images are compared against all eight grid orientations and ten fixed crops: 75% and 50% of both dimensions, centered or corner-aligned. Whole-to-crop comparison runs both ways. Arbitrary crops, narrow-aspect crops, local rearrangements and general color substitutions can be missed.
- Each current original gets its three closest non-exact neighbours. Pairs are deduplicated in the HTML. Distance ≤160 is labeled **suspected**, provided both compared grids have 10th–90th percentile contrast ≥16. This conservative screening threshold is not a calibrated probability or originality score. Low-information images still need review.
- Thumbnails have a maximum side of 96 pixels, are deduplicated by original SHA-256 and use explicitly encoded PNG stored-DEFLATE blocks for stable bytes. They are review derivatives, excluded from gameplay; full originals remain linked for inspection.

The [PDQ reference documentation](https://github.com/facebook/ThreatExchange/blob/main/pdq/README.md) explains how decoder/library choices affect perceptual hashes and why matching must be calibrated. This local bounded algorithm is **not PDQ**, does not claim its accuracy, and uses none of its thresholds.

## Ownership and preservation

The same mission/mode may reuse a picture for gameplay, reward and thumbnail without a violation. Repeated references collapse to one current owner. Separately listed Solo and Versus missions are distinct owners. Historical and tooling references remain explicitly listed and linked to the complete inventory; they do not require new pictures merely because they share a current original. Procedural backgrounds stay in the inventory's separate renderer/seed analysis.

## Reproduce the baseline

```sh
node scripts/content-artwork-screening.mjs --write
node scripts/content-artwork-screening.mjs --check
node --test game/test/artwork-screening.test.mjs
```

Generation checks each original's bytes and decoded pixel hash against the inventory. A source change first requires regenerating the complete inventory. `--check` then verifies the JSON, HTML and every thumbnail byte without writing files. No approval is produced automatically.

## Gate new or reassigned artwork

Retain the prior reviewed screening JSON before changing artwork or current ownership. Use that explicit baseline, not the newly generated report, when validating replacements:

```sh
node scripts/content-artwork-screening.mjs --strict-new \
  --baseline /path/to/retained-prior-artwork-screening.json \
  --reviews /path/to/human-artwork-reviews.json
```

This read-only gate compares each `(current mission/mode owner, original SHA-256)` assignment. Unchanged known baseline findings remain visible. Newly introduced exact cross-owner copies fail even if a review receipt exists. Every new or changed current assignment also needs an explicit human visual approval, including images with no suspected nearest match. The gate exits nonzero for exact violations or missing approvals.

A review file has this shape; the example deliberately records **pending**, which does not pass:

```json
{
  "format": "revealline-artwork-visual-review.v1",
  "inventorySha256": "SHA-256 from the new screening report",
  "entries": [
    {
      "owner": "exact current mission/mode owner ID",
      "artwork": "original image SHA-256",
      "decision": "pending",
      "reviewer": "",
      "notes": ""
    }
  ]
}
```

After reviewing the full composition, exact ownership, nearest contact-sheet matches and legibility in actual gameplay, a human can record `approved`, their name and concrete review notes. The receipt binds the exact inventory, owner and source bytes. It is an audit record, not a cryptographic identity proof or a substitute for rights/provenance review. A different inventory invalidates it. An implementation change requires regenerating the prior baseline under the newly reviewed method; baseline method hashes must match.

The pilot's content/design approval, full clears and physical-device gates remain independent. Passing this screen never establishes that missions have distinct gameplay or that offline support is verified.
