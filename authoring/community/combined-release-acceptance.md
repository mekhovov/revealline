# Combined creator feature acceptance

This record qualifies the media-to-campaign implementation as one source feature. It combines
the previously stacked image, batch, video, publishing, store, Versus, Team, and bounded media
editing candidates. The earlier phase records remain detailed provenance; they are not separate
release claims.

## Candidate identity

- Merged framework source: PR #465, merged 25 September 2026.
- Rebased hardening base: `e11bf150fa7b6201a17ca6e4e51a0623b4eb88b4` (`main`, source version
  `0.131.0`).
- Hardening checkpoint before this acceptance refresh:
  `93c82eff2e2367803b943c9256f0477de21f1c97`.
- Release version: unassigned. The follow-up preserves `0.131.0` while under review and must not
  create or downgrade a release identity.

The candidate contains no uploaded creator image or video fixtures and no generated distribution
output. Its largest new source asset is the pinned, licensed Mediabunny browser module.

## Included behavior

- One or many images generate deterministic missions and campaigns from six layout families and
  twelve bounded variants. Every current variant has collision obstacles and one supported moving
  enemy. Review cards show the generated enemy and obstacle counts.
- Actual compiled mission identity, difficulty, steering policy, and runtime seed are replayed
  before approval. Gameplay changes invalidate that evidence.
- Paired image/video and video-only missions retain exact poster and story dependencies. Victory
  keeps the earned poster and offers Play, Skip, and Replay without blocking Next.
- `.rlpack` export, import, immutable installation, unfinished-attempt recovery, earned pictures,
  exact updates, and recovery-package removal preserve edition identity.
- Account sessions, tus upload, isolated validation, catalog publication, browsing, reporting,
  unlisting, download, update, and offline recovery are implemented across the static client and
  self-hosted community service. PostgreSQL-backed admission limits work across API replicas;
  tus request locks and leased expiry cleanup coordinate across replicas; creator email
  verification and password reset use bounded, injected mail delivery and revoke old sessions;
  concurrent duplicate reports resolve idempotently; report triage is paged and audited. Exact
  blob hashes are authenticated again at download, and database/blob snapshots support verify and
  journal-backed restore.
- All current generated layouts are qualified for equal-board Versus. Purpose-built Team layouts
  support direct verified Couch file launch, immutable SHA-256 installation, fresh-session library
  discovery, replay-verified launch, exact unfinished-attempt recovery, stale-tab rejection and
  edition-scoped legal-clear progress. The bounded binary Team media format binds one exact picture
  per level and an optional inspected victory video to the complete installed edition identity.
- Playback ranges and decoded-frame stepping stay separate from physical editing. Physical
  trim/conversion is enabled only for one silent browser-decodable MP4 or WebM video track, exports
  AVC/H.264 MP4, and re-verifies changed bytes, duration, reviewed dimensions, MIME, hash,
  zero-audio inventories, and aligned decoded start/end pictures. Bounded Balanced and Compact
  profiles add no-upscale resizing, reviewed bitrate evidence and explicit display-orientation
  checks. The built-in browser has exact landscape and rotated-portrait Compact evidence.

## Integrated evidence

- `npm run test:creator-feature`: **516/516** creator/runtime checks and **43/43** community-service
  checks passed from the current combined source.
- Community Fastify, Better Auth, tus, validation-worker, storage, admission, moderation, recovery,
  account mail, report-race, exact-blob, and store-client coverage is included in that **43/43**
  service result. The decoder-failure regression also proves its opened package stream is closed.
- Installed Team/media/import/library focused integration cohort: **23/23 passed**; the strict Team
  media contract passes its own **7/7** package, install, intake and picture-lease cases.
- Rotated-orientation and physical-transform focused cohort: **50/50 passed**, with **114/114**
  across the expanded video/editor/intake/bundle group.
- `npm run validate`: passed for 1,229 files; exact whole-spatial snapshot SHA-256
  `e62ef45089df1bbaea04cceb932949fbe8d29377a4eeefcac8280125006495b3`.
- Root and community-service ESLint and Prettier checks: passed.
- Native formatting, Motion Lab syntax, Field Kit producer check, and Field Kit readiness: passed.
- Root and community dependency audits: zero reported vulnerabilities.
- `npm run build`: passed for **1,277 files** at source version `0.131.0`; distribution SHA-256
  `e8b7eee0805d85c4f2198fa29d5f44f7ab42dcaa84a09a78b9f59e43ffb3e608`.
  Publication still requires an assigned release identity and a fresh immutable freeze.
- Built-in-browser evidence in the phase records covers single-image completion, 12- and 50-image
  batches, cancel/resume and splitting, video-only victory playback, and verified silent-AVC trim.
  On the current combined source, a fresh picture generated a visible moving enemy and two collision
  walls, installed under its immutable edition, launched through ordinary Custom play, and exposed
  the saved-attempt Resume action after reload.
- A real 223,097-byte rotated portrait AVC upload was inspected as 360 × 640 and produced three
  poster candidates. The selected midpoint generated a 72 × 36 Twin corridors level with one
  moving enemy, two collision walls and verified Solo/Versus routes; its 0.33 MiB package retained
  one exact PNG plus the complete four-second video. Approval and installation created immutable
  edition `1ba2f4b1430e3a1f27118ccf71c4ad3d1433a7cdaee9d56e1e98b0fb9c948a52`, ordinary Custom play
  started successfully, wrote an unfinished-attempt checkpoint, and emitted no browser warnings or
  errors.

## Publication boundary

The static release can ship local creation, portable packages, installed Custom play, offline
behavior, and the community client. GitHub Pages cannot run Fastify or PostgreSQL. Accounts,
uploads, validation jobs, and the public catalog become live only after deploying the included
community service and completing its PostgreSQL/container restart, real database/blob restore,
two-account browser, proxy interruption, TLS/domain/secrets, exact trusted-proxy configuration,
Better Auth mail and account recovery, shared tus locking/cleanup, and isolated media-worker
acceptance.

Verified Team gameplay or media bytes install under the SHA-256 of the complete portable payload.
Fresh Team library visits discover each immutable edition, replay its qualification before launch,
restore exact unfinished attempts, reject stale writers, and retain exact picture identities in
legal-clear receipts. Media editions revalidate every dependency before launch and offer optional
Play, Skip and Replay after a win without blocking Next. The strict package API and playable intake
are included; an end-user Team media assembly UI and aggregate accounting with the separate shared
media database remain follow-ups.

Bounded silent MP4/WebM input can now be physically trimmed or converted to AVC MP4, with optional
Balanced or Compact resize/compression profiles and exact output verification. Audio trimming,
codecs outside each browser's successful decode probe, and broader conversion remain unsupported.
Firefox, Safari, Balanced portrait and physical mobile media qualification remain unclaimed.

PR #465 is merged. Ten later hardening commits plus this exact-head compatibility update are rebased onto current
protected `main` in draft PR #564. Hosted preflight passed, while the release-ready gate correctly
placed the PR on `release-train-hold`: v0.132.0–v0.138.0 are already reserved and this product change
has no immutable slot. The branch preserves the current `0.131.0` source identity; the release owner
assigns the next version only after queue and dependency review. Publication still requires
an immutable freeze, artifact hashes, public online/offline verification, and a separately reviewed
Pages selector update where applicable.
