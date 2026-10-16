# Catalogue Play — 14 October 2026

The normal Explore browser now exposes downloadable world cards, with local
EN/UK title search, installation labels and download size. Opening Explore or
Library requests bounded catalogue metadata. Initial SIM entry and Flight School
do not request metadata or world assets. The same catalogue view moves between
Explore and Library, retaining search and loaded pages.

**Play** reuses an exact installed revision or downloads, validates and installs
that revision through the existing transactional installation boundary before
opening a paused flight. It never arms. Cancel, navigation away and disposal
invalidate pending launch intent; saving already committed data remains safe.
World storage and offline simulator preparation are still distinct and the UI
states that explicitly.

The continuation uses the coordinator's versioned page reader: each page remains
bounded, continuation bytes match declared size/hash, cross-page IDs must be
unique, repeated pages are refused and a session stops at 1,024 entries. Failed
continuations retain previously displayed entries. No production package or asset
limit changes.

## Verification and remaining work

- Scoped source lint, syntax and whitespace checks pass.
- 27 existing world-content, radio-controls, entry and mission-library projection
  checks pass. An initial sparse-checkout run could not import the omitted
  publishing policy; restoring that tracked policy resolved those two failures.
- A browser-only controlled-worker fixture is served from the ignored
  `dist/fpv-catalogue-review/` directory. It exercises metadata-only entry,
  install-and-launch, exact reuse, page append/integrity, search, EN/UK,
  cancellation, navigation and failed saving. The coordinator observed **15/15**
  passing checks in the actual in-app browser. An initial fixture-only encoding
  error was corrected with an explicit UTF-8 declaration. This is a UI contract fixture;
  native worker network/storage qualification remains separate.
- Canonical reaction/worker projections pass. Integrated host renders the catalogue;
  the new v2 feed becomes reachable after merge. 23 parser/worker probes pass.
  Exact-player package checks and protected publication remain required.
- Broader installation/offline checks: 33 passed; one existing installed-host
  fixture rejects a presentation/runtime.json request. This is recorded, not
  reported as passing or bypassed.
- New assets, larger flyable regions, preview art, environment/activity filters,
  offline pinning and the regional runtime remain subsequent plan items.
