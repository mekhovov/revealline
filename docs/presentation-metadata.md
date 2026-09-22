# Bounded presentation history

A presentation workspace keeps immutable asset, theme and collection revisions. Repeated provenance text may be stored once in a versioned metadata envelope; decoding restores the exact logical records. This changes representation, not asset ownership, quality, authored content identity or simulation.

## Separate budgets

Serialized Studio metadata remains limited to 5 MiB. A reconstructed logical document has an explicit 8 MiB canonical JSON limit, 100,000 nodes, depth 18 and 8,192-character strings. The structural ceiling is 4,096 records, but byte, node and dictionary limits can reject a smaller history first. Bundle transfers remain 32 MiB and individual original files remain 4 MiB. Player-media storage budgets are separate and unchanged.

The legacy raw metadata reader retains its 5 MiB and 2,048-item limits. The compact envelope `revealline-presentation-metadata.v1` contains the document and a sorted, unique dictionary of literal provenance `source` and `prompt` strings. Only those two fields use integer dictionary indexes. Unknown fields, invalid indexes, duplicate/unused entries and oversized expansion fail before a candidate can be accepted. This is not a general reference graph.

A complete logical document must pass semantic, dependency, immutable-history and file-fact validation and must be encodable before an edit is accepted. An object that fits the expanded budget may still fail the serialized or dictionary budget. Failure must retain the prior workspace and assets. Finite limits do not promise unlimited revisions; export and capacity recovery must explain the actual limiting budget.

## Persistence and transfer

Studio loads legacy records without rewriting them. An explicit successful save stores the bounded representation and uses the existing generation comparison and atomic transaction. Decoding does not grant trust: schema and original-byte verification still run. Studio storage stays separate from player saves and managed media.

Fitting V1 and V2 `.rltheme` exports retain their exact bytes. The `RLTHM3` header carries codec metadata directly, avoiding extra wrapper bytes at the 5 MiB boundary. After metadata reconstruction and full validation, the importer derives the sorted unique payload table and verifies original sizes, hashes and file headers. Missing, corrupt or trailing bytes fail; cancellation and stale ownership remain authoritative.

The compiler emits the same `studio.json` bytes when the historical representation fits. It retains its trailing newline only when that byte also fits. Production formatting may use pretty JSON only while the final serialized file remains within 5 MiB; otherwise bounded canonical metadata is intentional. Generated metadata needs its own deterministic format and budget check, alongside complete production reproduction. Ordinary source files still follow normal formatting gates. Published Studio keeps its bounded streaming read and lazy asset loading.

Logical document hashes describe reconstructed canonical records. Encoded metadata and transfer files have their own byte hashes. Existing release archives, hash-addressed runtime files and original payloads must never be rewritten.

## Qualification

Verify exact V1/V2 exports, compact and raw V3 framing, the exact byte boundary, malformed dictionaries, expansion limits, immutable-history rejection, stale/failed atomic saves, and compiler-to-published-Studio round trips. Use the real retained production history as well as hostile fixtures. Prove that one or more complete collection replacements fit and that the next over-limit replacement fails without mutation. Compare all current production output bytes before adoption.

Source tests, native Studio upload/edit/save/export/import, generation, offline behavior and public release verification are separate evidence. No representation change by itself approves artwork or closes the full theme-framework phase.

## Reusing accepted immutable documents

Repeated inspection may reuse the exact logical object returned by the model validator after ownership, complete schema/history validation, encoded-capacity validation and recursive freezing succeed. Trust is held in a private weak identity set; an external object, proxy, clone or caller-frozen document must still cross the full validation boundary. Freezing alone never grants trust.

Calls with a previous document or expected revision retain their complete transition checks. Selection options, original-byte verification, storage generations and asynchronous operation ownership are not cached or bypassed. This prevents repeated Studio inspection of unchanged accepted history from re-encoding it on every refresh, without allowing mutable input to acquire lasting authority.

Maintainer prompt: optimize only model-owned immutable identities. Test mutable and foreign-frozen inputs, proxy wrappers, throwing/accessor options, stale revisions and rewritten history before relying on reuse. Keep all serialized/logical budgets and explicit mutation checks. Compare the actual retained-history refresh path and native Undo/Redo/token editing separately; do not introduce timing thresholds into correctness tests or cache renderer state by document revision.
