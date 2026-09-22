# Journey checkpoint reconciliation with main

The September22 main merge of PR221 introduces the accepted soundtrack-player
source and canonical FPV56 production history. PR225's unpublished checkpoint
`e1eaf90460e50fd0717fab435e7aa4d1fe5808b2` had a separate FPV55–58 candidate
lineage. Its theme55/56 records differ from main's records; blindly combining
them would assign two meanings to the same immutable identity.

`e1eaf904-production.tar.gz` is an inert Git-generated archive containing exactly
that checkpoint's `authoring/library/fpv-field-kit/production.rltheme`. It preserves
the entire unpublished ledger and original payloads for authenticated historical
inspection. It is not an import authority, runtime fallback, build input or
published edition. The original commit remains in merge ancestry as well.

The active ledger starts from main
`f22a47e570f14cee79fdd41e5676c6b58d0a8112`/FPV56, then the normal producer appends
canonical FPV57 with the combined current sources. All prior main records remain
unchanged. This FPV57 is not the archived candidate's FPV57; full source/bundle
identity must distinguish those lineages. No skipping, padding or weakening of
the strict next-revision contract is permitted.

The soundtrack source, default selection, stylesheet fingerprint and reviewed
HTTP/source evidence from main are preserved. Journey motion/effects source
fingerprints remain explicitly reviewed; combined-source verification and an
independent reconciliation review are required before promotion. No new image or
music generation is part of this merge.

## Reconciled working-source checks

- The new historical regression authenticates complete main56 and canonical57
  bundle bytes, strict one-step revision, unique identities, the alternate archive,
  main audio records and all127 unchanged original payloads. The initial four-file
  bindings/import/actor cohort passes59/59 on Node20.19.5.
- The broader32-file soundtrack, Couch audio/pictures, navigation, presentation
  history and Studio library cohort passes **559/559 on each Node20.19.5 and
  Node22.22.2**, with no failures, skips or cancellations. Its local logs are
  `.cache/reconcile-node20.log` (SHA256
  `c84bc95caebf9bc6deaa7fbb1d457dcadf437fe588c1d105fbd96c4be1284bda`)
  and `.cache/reconcile-node22.log` (SHA256
  `95ea474c68a2b947e9d38d7f0ad3e6c1de51f4d0019176cdb5d01bd78c405ed2`).
- Full source validation, ESLint, game/script/site formatting and diff-whitespace
  checks pass. `produce-field-kit-theme.mjs --check` reproduces canonical57.
- [Independent read-only review](independent-review.md) finds no concrete blocker.
  It separately verifies54 stable file hashes, all130 manifest entries, all127
  original payloads, fourteen exact main audio inputs, eight selected audio
  records and six exact Team frames. No test rerun is claimed by that reviewer.
- Native in-app-browser smoke on private port8858 follows Versus's actual Team
  link, waits for the exact picture, Starts First Connection, pauses at0:04,
  opens Audio→Music library, and returns through Audio to the same paused0:04
  board with0%/three reserves. The main quick-player/advanced sections are visible;
  focus returns to the Music library opener and then Settings. Console warnings
  and errors are empty. Sound stays off, no library edits/downloads are made,
  and the owned tab is closed. This does not certify audible quality, full clears,
  physical controllers, offline operation or every picture.

Canonical bundle SHA256:
`e2539ea2152bf5a8715621089f6d09eefba0d30b80f2a13dbbd47fa27b33f0d9`.
The archive and canonical/main complete-bundle oracles are pinned in
`game/test/fixtures/production-main-reconciliation.json`.

These results qualify the reviewed working files, not a release. A new committed
head still requires hosted preflight, all test shards and build, then immutable
freeze/release, Pages and public byte/browser verification. Earlier e1e CI and
native observations remain evidence for that exact predecessor, not a substitute
for qualification of the reconciled source. All broader human/device gates in
the completion ledger remain open.
