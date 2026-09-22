# Unified mission library — Release B

Local implementation began on 22 September 2026 from Release A candidate
`70836db6ac7559791ef61ecfbf31c0785604ffc0`, in `codex/unified-mission-library`.
The user approved concurrent local development while A is promoted. B promotion,
not B implementation, waits for A's public acceptance. The sole publisher retains
merge/tag/Pages ownership; A receives only blocking fixes. Before B qualification,
reconcile its base with the accepted A commit and rerun affected checks.

## Scope and sequence

1. Shared provenance-qualified browsing model and lightweight retained index.
2. Extend the existing selector with All/Journey/Classic/Custom, campaign and mode
   filters, textual tags, readiness, search and return-state preservation.
3. Mount it in Solo, Versus and Team Journey and Classic hosts; use their existing
   validated launch/preparation paths. Direct handoffs select the exact mission.
4. Wire download/cancel/retry without losing filters, selection or the old attempt.
5. Verify catalogue reconciliation, custom ownership, original Next sequences,
   empty-profile late Classic access, input navigation and lazy browsing.
6. Review, version, PR, merged-source qualification, immutable release, Pages and
   repeat affected journeys publicly. No completion claim at merge alone.

All retained levels stay. Classic uses its actual rules, not invented Journey
bands. A metadata row grants neither runtime ownership nor a clear. The browser
does not define progression: each content owner retains its original sequence.
Exact official installations update readiness; modified imports remain Custom.
Player settings, installed packs, uploaded media and Studio projects are retained.

## Acceptance inventory

The retained Classic catalogue has 110 missions: Base 12, active packs 23,
archived packs 12, optional embedded chapters 15, trusted external chapters 48.
The current Solo/Versus Journey has 91 missions. Team has 12 current missions
plus two legacy arenas; difficulty variants are not extra missions. Nine Classic
Lab practice demonstrations remain separately accounted for. Custom content is
device-specific and must not be deduplicated by names or map geometry.

## Delivery and evidence

The earlier 7–11-hour B estimate is a target from implementation start, not a
guarantee or permission to skip gates. Report implementation, local verification,
CI, release and public verification separately. Heavy release jobs remain
serialized; bounded local tests can run concurrently. Do not introduce new enemy
systems, artwork, music, balance changes or unrelated recovery work into B.

Current state: implementation in progress; no B release or public acceptance yet.

### First local checkpoint

- Implemented shared provenance registry, Journey and Classic metadata adapters,
  and the extended selector surface with collection/campaign/mode filters,
  textual tags, inline preparation/cancel/retry and return-state restoration.
- Generated and reconciled all110 Classic rows: 169,581 bytes, no artwork or
  collision geometry. Build verification reuses accepted external distribution
  bodies and rejects stale or changed metadata.
- Local Node20 checks: 31 registry/adapter/chooser and prior-chooser regressions
  pass; seven independent full-source index/determinism/tamper checks pass.
- Corrected a focus-restoration gap found by the first DOM test run; all eight
  original chooser cases pass. Independent review additionally found and corrected
  focus after exact owner replacement, stale reentrant readiness/launch ownership,
  and Solo preparation state leaking into otherwise-ready Versus. Dedicated
  regressions cover each. This is modeled DOM evidence, not native hardware.
- Local distribution assembly passed with1060 files, including the source-checked
  lightweight index. It was a moving development checkout with sourceRevision
  null and inherited A version0.83.0, not an immutable B release. Final source
  qualification and the B version bump remain required after host integration.
- Still required: actual Solo/Versus/Team host adapters, installed Custom sources,
  exact launch handoffs, native/browser verification, final version and release.
  The new selector is not enabled in gameplay hosts yet. No public UI change is
  claimed by this checkpoint.

### Parallel integration checkpoint

- Added fixed same-game Solo/Versus/Team mission handoff URLs. Requests retain the
  release prefix, carry an opaque exact display identity, and reject malformed or
  duplicate intent. They grant no installation or runtime authority.
- Added release-independent, per-host session storage for selector search, filters,
  focus and scroll, with an in-memory fallback when storage fails.
- Fixed a reviewed asynchronous status leak: a download completing after a mode,
  campaign or search change no longer overwrites the new view's status.
- All39 fast registry, chooser, adapter, handoff and existing-chooser checks pass.
  Host mounting, exact receiving-host lookup and public acceptance remain pending.

### Exact targets and installed editions

- Solo's guarded chapter launcher now accepts an exact campaign, mission and
  revision. Explicit selections cannot silently become the first or remembered
  mission, and late selections are not clamped to earned unlocks. Omitted targets
  preserve existing chapter Continue behavior. This is launch-path support; the
  unified selector is still not mounted in gameplay hosts.
- Added Custom adapters preserving original installed pack, entry and level
  references, host-declared mode support, authored order and actual rule text.
  Only positively verified originals are excluded from Custom. Names and matching
  IDs do not combine editions.
- Added full prepared-pack canonical SHA-256/byte identities to the trusted index
  and a shared immutable-object verification cache. This distinguishes modified
  artwork editions without fetching every official pack or decoding its pictures.
  Managed original-picture readiness remains a separate host check. The110-row
  index is now183,555 bytes.
- Local verification:56 fast tests, all16 existing Solo chapter-launch host
  regressions, and eight full-source index/determinism/tamper/pack-identity tests
  pass (seven index cases plus the separate all-prepared-pack case). Independent
  read-only review found no blocker in this slice and repeated21 helper/adapter
  cases plus two actual Solo host regressions. These are finite test boundaries,
  not native/controller/public verification.

Next: mount the library in Solo Journey and Classic hosts, resolve incoming opaque
selection through the exact registered owner, wire preparation/readiness and
device Custom content, then repeat for Versus and Team. Retain atomic artwork
adoption, replacement/departure guards and each owner's separate Next sequence.
