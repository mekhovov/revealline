# Creator plan review and portable-sharing delivery — 16 October 2026

## Scope and source

This is the current execution plan. It supersedes the execution order in
[15 October's record](delivery-plan-2026-10-15.md), retaining its dated evidence.
The user explicitly chose **“Defer public accounts/uploads; keep portable-file sharing”** on
16 October. GitHub Pages remains the static game host. Production community deployment,
accounts, submissions, public moderation/restore and AWS acceptance are deferred, not completed.
No backend choice or operating expense is needed to finish the portable workflow.

Implementation starts from reviewed fetched main `2169552a0571b9d62bce116054f1e21aabd10fa1`,
in the isolated `codex/creator-retention-review-20261016` branch. Unrelated primary-checkout work
is preserved. Public main deployment `741948b14a09a816e49054c443511186bb99eb41` contains the
cold-intake correction [#1519](https://github.com/mekhovov/revealline/pull/1519) and Team Next media
correction [#1527](https://github.com/mekhovov/revealline/pull/1527). Public adoption is now verified
at the source/byte boundary; the new retention work still needs its own merge and deployment.
The existing publisher subsequently delivered main `2169552a0`; its public build identity was
checked and cold creator intake stayed disabled until initialization, then exposed enabled media
and name controls. This is rolling Pages delivery, not a newly frozen release archive.

## What is already delivered

The existing guide/compiler/Studio remain the framework; a replacement editor or generation
service is unnecessary. The local feature is implemented: select images/videos, generate bounded
levels with enemies and obstacles, inspect/edit, approve, install, export/import, play and recover.
Packages contain selected gameplay/media, with private originals backed up separately.

| Original phase         | Current result                                                                                                                                                                          | Remaining qualification                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0 — Guides             | Beginner guides, examples, format and maintainer documentation exist.                                                                                                                   | Keep the current guide's exact content pin aligned with edits.                                                      |
| 1 — One image          | Actual downloaded pack, installation, Solo wins, exact reward and unfinished recovery passed.                                                                                           | Physical clean-profile evidence is distinct from separate-origin storage.                                           |
| 2 — Batches            | 1/12/50-image preparation; six families/twelve variants; ordering, exclusion, cancellation and 24-image capacity splitting passed.                                                      | Peak browser memory and broader human variety review.                                                               |
| 3 — Video              | Paired/video-only creation, custom frame/range, actual export/install, Solo win, Replay/Skip and exact poster passed.                                                                   | Physical audio, additional codecs and Team video end-to-end.                                                        |
| 4–5 — Hosted community | Service/client and acceptance tooling remain available in source.                                                                                                                       | Explicitly deferred by the user; no public launch is claimed.                                                       |
| 6 — Versus             | Both seats/rematch, exact installed editions, progression and continuation have browser/host evidence.                                                                                  | Wider desktop/device qualification only.                                                                            |
| 7 — Team               | Generation/review/download/install/start/recovery passed; current Standard/Full host tests cover legal wins, exact rewards, Next and saved-attempt identity. Next media loss was fixed. | Native browser win/Next/story and other settings; historical boosted proofs do not establish current host coverage. |
| 8 — Optional editor    | Bounded physical trim/conversion/resizing paths and earlier built-in-browser acceptance exist.                                                                                          | Broader codec/browser/audio claims remain unqualified. Playback range never means physical trim.                    |

Sources: the five dated browser receipts linked from the previous execution plan and the
[Team results receipt](creator-team-results-acceptance-2026-10-15.md). These are scoped observations,
not a universal guarantee about arbitrary edits, enjoyment or every browser.

## Research review and improvements

1. **Keep independent campaign packs.** Godot's documented resource-pack workflow shows that content
   can ship separately from the engine. Retain `.rlpack` dependency closure and exact editions;
   unlike general engine mods, accept data/media only, never imported scripts. A new framework or
   executable mod loader would add compatibility and trust problems without simplifying this task.
   [Godot packs/mods](https://docs.godotengine.org/en/stable/tutorials/export/exporting_pcks.html)
2. **Reuse rules/templates instead of unconstrained geometry.** Tiled templates and automapping are
   useful examples of repeatable authoring from reusable objects/rules. Keep the game's bounded,
   versioned variants and legal replay checks; do not add Tiled as a required user tool or claim that
   pattern placement alone proves playability.
   [Tiled templates](https://doc.mapeditor.org/en/stable/manual/using-templates/),
   [Tiled automapping](https://doc.mapeditor.org/en/stable/manual/automapping/)
3. **Make retention optional and truthful.** Browser data is best-effort by default and persistence
   requests can be refused. Reuse the existing `attachStorageRetention` owner in both creators,
   behind a collapsed Download retention section. Opening checks status only; an explicit button
   requests protection. Keep backups, existing budgets, approval and installation independent.
   [MDN eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria),
   [MDN persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
4. **Keep estimates separate from failures.** Available-space estimates do not guarantee a later
   write. Keep actual transactional rejection/recovery checks, explicit splitting and exportable
   drafts. Never fill the user's disk or remove unrelated data to manufacture a quota result.
   [MDN storage estimates](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)
5. **Keep broad conversion optional.** Mediabunny still documents transcoding both tracks when a
   nondefault trim start is used. Preserve the explicit playback-range versus physically trimmed
   file distinction and qualify output bytes/decoded timing. Do not promise wider codecs from an
   extension or capability hint.
   [Mediabunny conversion/trimming](https://mediabunny.dev/guide/converting-media-files#trimming)
6. **Use Pages for static delivery only.** The new portable-first scope fits its documented static
   hosting model. Community-service activation becomes a future product decision, rather than an
   artificial blocker for creating or sharing packs.
   [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

These are adaptations to the existing contracts, not recommendations to migrate engines, add
another storage authority or rewrite the package format.

## Remaining work, ordered for delivery

Estimates are hands-on effort, not calendar promises; CI/Pages waiting and newly found defects are
additional. A test or environment limitation stays visible instead of becoming a completion claim.

| Priority / item                             | Why it is needed and benefit                                                                                                                                                           | If deferred                                                                          | Exit condition / effort                                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 — Complete current creator cohort        | Exercises integrated creation, imports, approval, recovery and exact ownership together. Bounds test-file concurrency at two to reduce simultaneous test-process load.                 | Focused green tests can miss integration drift.                                      | Entire bounded runtime cohort passes; retain any failed predecessor and repair exact document pins. Roughly 10–30 minutes per run on this machine, fixes separate.                                             |
| P0 — Optional creator retention             | Helps users request protection for local drafts/installed media without needing to find game Settings.                                                                                 | Portable backups still work, but storage protection is less discoverable.            | Both creator surfaces, explicit request, denial/error/unsupported states, stale-close/departure guards, unchanged campaign approval, native keyboard/status check, source checks and release. About 1–2 hours. |
| P1 — Native Team continuation/story         | Confirms that the actual browser paints and plays the approved content after ordinary cooperative wins and Next.                                                                       | Automated host proof does not establish a browser victory or video/audio acceptance. | Legal two-contributor win, exact poster, Play/Skip/Replay/Next and reload; no core-state injection. Roughly 2–6 hours for a bounded run and defect repairs.                                                    |
| P1 — Current public delivery                | Confirms users receive the tested source rather than merely a merged branch.                                                                                                           | New local corrections are not yet available publicly.                                | Existing protected main publisher, declared identity, exact scoped bytes and public creator check. Queue-dependent.                                                                                            |
| Qualification — Storage/memory/profile      | Distinguishes rollback logic from real browser quotas and peak memory, and separate-origin testing from a fresh physical profile.                                                      | Capacity/performance limits remain unmeasured; no broad robustness claim.            | A controllable disposable browser profile and attributable memory/quota tooling, then 0.5–1 day. Preserve current user data.                                                                                   |
| Qualification — Wider desktop/audio/balance | Establishes each browser/codec and real listening/human-play statement independently. The user selected built-in-browser delivery; other browsers are not silently declared supported. | Support statement remains narrow.                                                    | Available Firefox/Safari sessions and physical audio/human review; 1–2 days after environments exist. Mobile stays deferred.                                                                                   |
| Deferred — Hosted pilot, operations, AWS    | Enables future public publishing rather than portable-file sharing.                                                                                                                    | Accounts/uploads/public store remain unavailable; file sharing remains usable.       | Resume only after the user requests hosted publishing and chooses its deployment inputs. Not in the current delivery estimate.                                                                                 |

Do not add more layout families, new codecs, OPFS, server infrastructure or optional editor tools
merely because qualification is pending. Fix witnessed defects, finish the portable path and keep
unaccepted support claims separate from software implementation.

## Current batch evidence

Detailed browser observations, fixture-repair boundaries and the retained screenshot are in the
[16 October receipt](../../docs/verification/creator-retention-2026-10-16/README.md).

- Creator retention implementation reuses the shared owner and existing translated messages.
  Its control sits outside Team's busy form, so it cannot approve/invalidate campaign media or
  become a second campaign-operation owner.
- Focused retention/Team creator coverage passed **25/25** with no failures/skips. The real built-in
  browser showed truthful not-enabled status, keyboard reachability, close/reopen and unchanged
  collection text. No permission grant or denial is claimed from that browser check.
- The first full bounded run completed with **827 passing / 3 failing**, no skips. The guide's
  exact descriptor was stale after editing; refreshing it passed **35/35** guide/retention checks.
  The Custom metadata comparison needed an explicit Node image decoder for real raster headers;
  the workshop distribution test needed the finite Neon artwork inventory already admitted on
  main. Those two fixture repairs passed **12/12**. Production decoding and distribution admission
  were not relaxed. The complete rerun is in progress; it must finish separately before release.
- Source/compiler validation passed. Full repository validation is running separately.
- Native Team intake used two repository-owned images and the owned six-second AVC/AAC fixture.
  Two reviewed levels and three exact media assets produced an actual 2,119,165-byte download,
  edition `821a5152f7faef3296ef54a68ec348f2956eadeb1af35da7213b3c4c5396fa01`.
  Approval, installation and ordinary mission selection succeeded. Retention remained separate
  and available while preparation disabled the campaign form.
- The native timed two-pilot crossing was caught by a Hunter, consuming one reserve. Recovery
  restored both craft; the attempt is paused and preserved. This is **not** a native victory,
  Team story or Next acceptance. Reloading and selecting that same edition did restore its
  saved attempt with two reserves and zero captured anchors; it was paused again. The
  successful deterministic host proofs remain separately
  scoped. No core state, route evidence or difficulty was changed to manufacture a result.
- Public creator HTML body matches source `741948b14` exactly: 15,763 bytes, SHA-256
  `e2159d5af93e79a59c90601b037d2304aee2fb562fa8434e87163631cd0d0ed8`.
  The build's normal install metadata injection in the HTML head is excluded from that comparison.
  The public Team module matches raw source exactly: 289,250 bytes, SHA-256
  `e974ebd1ca83790ab7a8028e4ca5bc477e6ccf3c33cb19457d0b864e7b270342`.
  An initial whole-HTML comparison found the expected build injection; a subsequent local
  comparison mixed UTF-8 byte offsets with text offsets and was corrected before the successful
  byte comparisons. Neither failed comparison is evidence of a product regression.
