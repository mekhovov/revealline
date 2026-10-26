# Publication tooling

The rolling main game is built and deployed by `.github/workflows/publish-main-pages.yml`. It uses the current source and records the exact deployed commit.

The previous frozen publication catalog has been retired after the content ownership migration. Its source metadata, archived website evidence and delivery records are preserved in the external Git backups. The registry contains no admitted external archive routes, and frozen-controller deployment is disabled. Original distributions and their approvals must not be relabeled as rebuilt releases.

`docs/migrations/retired-frozen-publication.json` records the retired versions and predecessor inventory identities. This source change does not itself delete remote release assets or rewrite Git history; those operations have separate backup and cutover receipts.

The generic release, metadata, catalog, archive validation and checksum tools remain available. A future frozen release must begin with fresh source qualification and new exact distribution identities before enabling that controller again. Optional package publication remains governed by `optional-packages.json`.
