# Archive51 preservation inputs for the next selector

Archive51 preserves the original v0.82.1 release at
<https://mekhovov.github.io/revealline-archive-51/releases/v0.82.1/site/game/>.
The release owner approved admission after the full public byte audit, the scoped
native journey, and an independent evidence review. This directory is a staging
package. It does not change the active selector, allocation registry, catalogue,
game source, or release version.

- Archive infrastructure: `8bf0ed6c3947ca8c47ad2d9246db3e57acd986cf`, tree
  `c057f683ae6f7afcf3696120d9d5d65fb9fb38d7`.
- Deployed run `35747012670`, deployment `6594278854`, successful status
  `18683226213`.
- Preserved game: v0.82.1, source `64ec9fd2e5688f4248fe005ac6a47c0c1394ea9e`,
  tree `402f5f12d83cb86dbceb9d9dceec12731ea48980`.
- Original distribution: 590,546,744 bytes,
  SHA256 `eb98abe00155176d77facbcedcd1510219031057afc56a5669f98c7330b2b3af`.
- Public archive: all 1,059 files / 590,404,002 bytes verified by full response
  hashes and MIME checks. There were 1,060 attempts, one retained HTTP 503 and one
  successful retry, with no final failures or skipped paths.
- All nine original release asset IDs, names, lengths and server digests, and the
  annotated tag reference, remained unchanged. The hosted extractor verified the
  original distribution bytes. The local check did not redownload the large source
  TAR or rehash all nine remote bodies.

## Use in a later selector PR

1. Rebase the eventual publisher work on its accepted controller base. Preserve
   existing allocations and admissions. Append `allocation-entry.json` once.
   `allocations.json` is the exact 50-entry accepted baseline plus archive51; its
   hash is in `configuration-fragment.json`. Do not replace a newer allocation
   registry with this snapshot.
2. Copy `evidence/archive-51-v0821/` unchanged into the controller's `evidence/`
   directory. The 51 evidence pins in `admission-entry.approved.json` are relative
   to the controller root after that copy. Append this entry once to
   `publication.json`'s admissions and update `allocationSha256` from the actual
   final allocation bytes. The fragment is partial input, not an executable
   publication configuration.
3. Retain the original v0.82.1 catalogue and metadata. The small `metadata/` copy
   here is identical validation input, not replacement game content. Supply the
   later current release's real catalogue entry, original metadata, source
   qualification and release authority. No v0.83 source pass is asserted here.
4. Run the complete real controller validation, assembly/capacity checks and
   hosted workflow for that final selector candidate. Archive51 uses 590,404,002
   of its 800,000,000-byte budget; the later main Pages size depends on its actual
   current release. Reconfirm deployed identities if any archive infrastructure
   changed. Complete the selector's actual public HTTP and native acceptance.

The approved `browser-admission.json` is a successor to the retained
`browser-admission.pending-original.json`. The owner instruction and independent
review are explicit pinned references. Earlier observation and preparation
receipts intentionally retain their then-pending wording.

## Local check and evidence boundaries

From this repository root run:

```sh
node publishing/pages-controller/delivery/archive51-v0821-staging/verify.mjs
```

This uses the accepted controller's real `validateAdmissions` with
`requireBrowser: true`, verifies the original metadata, all 51 direct evidence
pins and the append-only allocation, and checks that pending/missing browser
approval and changed evidence are refused. Controller dependency hashes are
pinned. It performs no network requests or publisher assembly. Its bounded
metadata view contains only current v0.82.1, so it deliberately produces no
historical routing overlay and does not qualify a future selector.

The native operator used a fresh isolated headed Chromium session. The initial
`sessions.mjs` HTTP 503 produced “Flight on hold”; the ordinary Reload control
recovered. A guessed completion-label wait was interrupted, and a paused/caught
attempt was retained. After explicit Restart confirmation, actual First Signal
finished at 52.2%, 8,160 points, 0:04 and three lives. The archive index's current
release explorer link and browser Back were exercised. The owned session closed.
This is separate from the one PNG 503/retry in the full HTTP audit. The independent
review reconciles retained evidence; it is not a second physical browser witness.
No offline, physical-device, touch, controller or audible/listening result is
claimed.

The 51 native originals are retained individually and in a ZIP with their exact
support manifest. Raw PR/deployment/API receipts, public HTTP attempts/results,
helper source/tests, original source qualifications, failure history and review
receipts are retained. `staging-manifest.json` pins every file in this staging
package except itself. No game payload, source TAR or distribution ZIP is copied
into this evidence package. Some historical receipts name external cache paths;
only the explicitly retained bodies are claimed, not generic recursive closure.
