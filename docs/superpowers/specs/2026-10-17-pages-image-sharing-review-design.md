# Pages image-sharing feasibility review

Status: conceptual review authorized by the user's instruction to proceed with
the recommended design on 2026-10-17. This specification authorizes a read-only
feasibility investigation, not image-sharing implementation or a removal batch.

## Problem and frozen baseline

Verified main fb3caf12bd43743670f47c42dc21f7a406223379 publication
39038793037 has 3425 files, 960384263 raw bytes and a 963368960-byte actual
archive. Dated gaps are 13368960 bytes to 950000000 and 63368960 bytes to
900000000. The working raw/archive guards remain 980000000. Main movement makes
these figures historical; freeze and verify a new publication before decisions.
The existing download-only audits cannot justify deleting shared content.

## Selected approach and alternatives

Investigate exact-byte sharing for the previously deferred 38-scenario image
proposal first. The number 38 is a historical proposal, not a proven current
candidate inventory. Derive the complete current inventory before assigning it
any savings. This offers a capacity route without making live art download-only.
Alternative: continue strict download-only removals, currently insufficient by
the retained floor proof. Alternative: change transport/origins/installers or
remove gameplay content; these are outside this authorization and excluded.

## Investigation contract

1. Freeze current main, accepted publication inventory/receipts, build profile,
   relevant source Git blobs, selectors and any public release asset identities.
   Reuse hash-matched retained bodies; do not redownload complete archives.
2. Enumerate every scenario image reference and its actual image bytes, decoded
   identity requirements and ownership. Group only exact hash-and-byte matches;
   visually similar or recompressed images are not duplicates. Missing bodies,
   generated references or unresolved consumers are unknown, never absence.
3. Map each candidate through gameplay, editable copies, Studio/SIM, import and
   export, offline packages/updates, previews, direct URLs, saves and retained
   version identities. Read dynamic construction paths, not just text matches.
4. Compare three designs as data: unchanged self-contained payloads; build-time
   internal sharing with unchanged external contracts; explicit reference-based
   packaging. The last two remain proposals. Reject any approach that requires
   altered existing app URLs, origins/CSP, installer, editable transport, save
   migration, service-worker protocol or weaker self-contained full releases.
5. Produce a per-consumer compatibility matrix and file-by-file byte accounting.
   Count overlaps once. Separate theoretical raw reductions, archive overhead,
   measured archive results and unresolved costs. No forecast reserves capacity.
6. If no design meets all contracts, report that result and the remaining dated
   target gaps. Do not silently broaden scope or invent savings.

## Output and stop boundaries

Deliver an exact-source inventory, compatibility matrix and recommended concrete
implementation design, or a documented infeasibility result. No candidate code is
executed, no runtime/build/workflow file changes, public writes, downloads of
large packages, cache changes or PR readiness changes belong to this review.
Git originals and full releases remain untouched. The five live pack bodies
totaling 56425044 bytes are retained. The first reduction batch still requires
genuine offline/restart acceptance before a second removal batch.

## Acceptance and subsequent work

Review acceptance requires complete pinned evidence, explicit unknowns and a
source freshness recheck. Independent review examines every proposed consumer
transition and rejects lost/offline/editable contracts. Actual implementation
requires a separate concrete reviewed specification and user approval; feasibility
review approval alone is not that approval. An implementation, if approved, must
pass unchanged exact-head gates, full actual archive verification and affected
live/offline behavior before any savings or 950/900 MB attainment is claimed.
