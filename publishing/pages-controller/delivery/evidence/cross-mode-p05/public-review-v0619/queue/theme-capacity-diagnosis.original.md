# Collection capacity: measured blocker and proposed P04 dependency

The unversioned HUD integration on exact actor source `17e0a455f76c3f4a72f2e596397a0e73463335a5` is still blocked by the existing whole-collection capacity contract. This is a design recommendation, not a schema approval or implementation. The 16 sealed candidate bodies, legacy format, historical records, payloads, failed tests and preview remain unchanged.

The next bounded P04 change should evaluate **explicitly versioned shared prompt/provenance references for new revisions** before introducing history parts. Repeated provenance accounts for most of the immediate growth, so references address the measured cause with less storage and transfer complexity. Immutable history parts remain the larger follow-up when unique history itself reaches the same finite budget. Neither option permits unlimited history inside a fixed-size artifact.

## Measured costs

The diagnostic runs the supported authoring operation on in-memory copies and logs just before the unchanged validator. It catches the rejection without bypassing it or writing a candidate into game source. Field totals include JSON keys, colons and serialized values; nested prompt costs are already part of provenance.

| Added serialized bytes | Full review, revision 33 | Full replacement, revision 34 |
| --- | ---: | ---: |
| Provenance | 416,947 | 416,954 |
| Of which prompt fields | 350,665 | 350,665 |
| Quality evidence | 50,052 | 50,052 |
| Geometry | 29,103 | 29,103 |
| File descriptors | 19,956 | 19,956 |
| Description | 14,508 | 22,850 |
| Other asset fields and separators | 25,475 | 25,475 |
| Theme successor | 14,401 | 14,401 |
| Total increment | **570,442** | **578,791** |

Each step appends 194 complete asset revisions. Prompt fields account for about 61.5% of the first increment; provenance as a whole accounts for about 73.1%. The second step changes descriptions, while repeating the same prompts and nearly all provenance. File payloads are already hash-deduplicated: the candidate retains 127 original payloads totaling 4,007,816 bytes. The pressure here is immutable JSON metadata.

The current revision 32 document occupies 3,113,455 bytes, leaving 1,080,849 below the 4,194,304-byte document guard. Its actual transfer manifest includes the payload table and occupies 3,125,013 bytes, leaving 1,069,291. The whole-review operation reaches 3,683,897 document bytes; the following replacement reaches 4,262,688 and is rejected **68,384 bytes over** the document guard, before export. The transfer wrapper would impose its own unchanged 4 MiB check afterward.

A supported edit of the largest selected required asset adds 6,779 document bytes and leaves 1,074,070. This demonstrates remaining ordinary-edit headroom, not whole-collection readiness. There are 1,217 asset revisions out of 2,048; the two proposed collection operations would use 1,605. Record count and the 32 MiB transfer ceiling are not the first blocker in this specimen. These serialized-byte limits are not a claim about JavaScript heap use.

For scale only, all current prompt strings occupy 1,234,922 serialized bytes while their 372 distinct values occupy 429,267. The current 31 newly reviewed quality objects total only 44,975 bytes: even deleting them entirely could not cover the document overrun and would destroy evidence. No trimming was performed. Deduplicating existing historical rows is also not authorized.

## Option A: versioned shared provenance for new records

Keep every existing v1 record and retained original export exact. Introduce an explicit new document/asset representation whose **new revisions** may carry typed shared prompt or provenance references. A reference must identify immutable content and its canonical SHA-256; it must never be a URL, executable expression or arbitrary property path. A prompt-only form is the narrower first experiment. Sharing creator/source/license/prompt together can save more, but derivative parent identity must remain specific to each asset revision.

The resolver can reference an existing inline historical value, or a flat content-addressed block included once in the same closed transfer. An existing-record reference avoids first copying the same prompt into a new dictionary, at the cost of stricter dependency resolution. A flat block table simplifies resolution but its initial content and every reference must count toward the same 4 MiB manifest ceiling. Measure the actual proposed encoding and full export before choosing; the table above is not an achieved savings claim.

Resolve the effective string and provenance exactly for prompt generation, review display and compiled output. Preserve canonical equality of all old asset records; compare new records through their explicitly defined resolved semantics. Reject missing targets, wrong hashes, conflicting identities, reference cycles, excessive depth and expansion work. Prefer writers that point directly to a verified inline anchor or flat block, rather than growing reference chains. Validation must bound total encoded input and reference traversal, and must not simply materialize an over-budget legacy object and call it a valid v1 document.

This requires an explicit new reader/writer path. Existing strict v1 readers must continue rejecting unsupported versions, and their 4 MiB guard stays unchanged. New readers must import and re-export retained old v1 artifacts exactly under the original format contract. New larger logical histories need the new format; they cannot promise export to an over-budget v1 document or compatibility with old clients. Keep original historical export bytes/source pins available independently of migration.

## Option B: immutable history parts plus a bounded active document

A versioned descriptor could retain hash-pinned immutable history parts and an active selection/delta. Parts must be closed over their dependencies or carry a fully verified, bounded dependency graph. Old canonical records and original exports remain recoverable exactly; moving them outside the active selection cannot discard them. Export/import/adoption must carry the required closure without network access and preserve the existing aggregate 32 MiB transfer limit. Import must verify all parts before publishing a new storage generation.

This option separates active rendering from growing history more directly, but it touches storage transactions, compiler output, offline distribution and portable adoption. It also needs explicit aggregate metadata, part-count, depth and resource limits; merely moving arbitrary JSON into payload sections would evade the current guard. It is a larger P04 design than the immediate provenance duplication fix. Once unique retained content exhausts a finite transfer, authoring must fail before mutation with a clear capacity outcome; no format can guarantee unbounded growth.

## Existing implementation boundaries

All paths below are relative to the sealed worktree `.cache/worktrees/p05-narrow-hud-on-actor622-r5`.

- `game/presentation/model.mjs:14`: existing 4 MiB manifest and 32 MiB transfer limits. `:102` owns and bounds the complete JSON value. `:304` and `:315` define exact asset/provenance keys; `:543` validates the complete v1 bundle. `:584` and `:606` require local parent closure and reject cycles; `:626` preserves exact prior records.
- `game/presentation/studio-session.mjs:18` and `:43`: full immutable revision/collection append. `:71` adopts complete history and resolves parents before namespacing conflicts. `:139` generates prompts from effective current provenance. These operations need representation-aware resolution, not truncated prompts.
- `scripts/presentation-production-history.mjs:17`: already reuses unchanged or matching revisions. Its new revisions copy complete metadata at `:51`; eliminating unnecessary successor creation is not the missing fix here.
- `game/presentation/bundle.mjs:140` and `:156`: deterministic export, manifest/transfer guards, complete payload verification and strict import. These are the explicit version boundary and closed-transfer integrity gate.
- `game/presentation/studio-store.mjs:9`, `:127` and `:137`: exact saved history, load validation, pre-transaction byte verification and generation compare-and-swap. A migration must not let an older tab overwrite a new representation, partially install history, or alter player-media databases.
- `scripts/compile-presentation.mjs:33` and `:84`: compile resolved runtime plus complete studio history. A new history layout must retain authoritative source/asset inventory and runtime equivalence. `scripts/produce-field-kit-theme.mjs:313` reads the prior ledger before supported production succession; `:326` exports it and `:335` compiles it.
- `game/test/presentation-production-history.test.mjs:509`: the failing test requires review, whole replacement, exact old-record preservation, export/import and adoption. Preserve these behaviors and existing v1 tests; a new representation needs an equivalent complete sequence, not a reduced fixture.

## Minimum proof before integrating HUD

1. Keep retained old exports, canonical records, all 127 payloads and exact resolved prompts unchanged through old-format import/re-export and explicit migration. Exercise same-ID conflicts and parent chains during adoption. Demonstrate deterministic new-format round trips with complete history and current runtime equivalence.
2. Reproduce the exact current 194-asset review plus replacement sequence under the unchanged manifest/transfer ceilings using the proposed representation. Measure remaining headroom, encoded reference overhead and bounded expansion work. Keep a real capacity-exhaustion case that refuses before source/storage mutation.
3. Reject missing/hash-mismatched/cyclic references and malformed/oversized parts before acceptance. Test interrupted migration/import and stale generation writes across old/new tabs; preserve saved originals on every failure.

Only after that independent P04 capacity change is reviewed should the frozen HUD runtime be adopted onto the resulting exact actor-based source. Regenerate source-stage/reviewed production successors through the existing producer, update actual current-theme consumers, then run the affected history/readiness/actor/HUD checks and full source qualification. Combined gameplay/native/public gates remain separate.

Root's later `root-inline-practice-note.md` is a limited mixed-input actual-practice observation: outer viewport 320, embedded viewport 290, real 8.6% cut and score 02040, visible complete arena and inset Pause ring. Screenshots were inline only. It does not establish the full native matrix, long/fractional gameplay, physical input, save integrity or capacity readiness. The server remains available; no sealed source or evidence was rewritten to add this note.

Measured originals and pins: `capacity-field-analysis.json`, `capacity-field-diagnosis/{stdout,stderr,receipt.json}`, `diagnose-fields.mjs`. This diagnosis is cache-only and makes no version, commit, remote, schema or acceptance change.
