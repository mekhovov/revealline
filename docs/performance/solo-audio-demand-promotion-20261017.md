# Optional audio demand promotion

On 17 October 2026, six deterministic existing-owner controls reproduced lost demand priority in FeedbackDirector and ReactionVoiceCache at source `267e42c26b2ac1481f5cfa28657aaee177794926`. A demand joining background preparation inherited its original priority. Starting play could therefore discard the source before decoding; the next demand read it again. ReactionVoiceCache could also discard an already-running native decode because its eligibility still captured background priority.

The effects control read the fixed 460,844-byte bell original twice and decoded once. This establishes repeated fetch/read work, not repeated network transport: a browser cache could satisfy the second fetch. The reaction control counted two library reads and two decode calls. These are source controls with modeled asynchronous boundaries, not native CPU measurements or an explanation of a retained frame hitch.

## Correction

The existing preparation queue can promote its own unsettled tasks by exact AbortSignal. Promotion preserves the original FIFO sequence, concurrency, byte reservations, eligibility, signal and deadline. Task records are removed when their promises settle; removed or cancelled work cannot be revived. Required work remains ahead of demand, and main-thread work remains deferred during play.

Both existing audio owners retain the effective priority for later stages. FeedbackDirector keeps the same Promise values in `pending`; ReactionVoiceCache uses its existing request record. Demands can reuse a live fetch or decode instead of discarding and repeating it. Original ten-second deadlines are not renewed. Muted, replaced-context, disposed and aborted owners remain ineligible; noncancelable native decodes retain their reservation until settlement. Loading never replays a past cue, and existing immediate fallback behavior is unchanged.

A demand arriving after synchronous phase cancellation but before the pending Promise finalizer deliberately receives that cancelled result. There is no queue resurrection or automatic retry; a later event may request the cue again. Published audio and other consumers retain their existing policies.

## Verification

- The original six behavior controls passed against the unchanged sources. Five subsequent positive regression controls all failed against those same unchanged runtime bytes, retaining the demonstrated defects.
- The four-file cache patch passed 133/133 checks across eight complete audio files. After guarded application to tracked source, the same complete group passed **133/133**, with no skips or cancellations, in 2.253 seconds. It includes preparation, FeedbackDirector, published cues, human reactions, classic remaster/catch and Overflight world/review audio.
- Twelve added controls cover active fetch, queued and admitted-before-work promotion, already-running decode, exact pending Promise identity, signal isolation, required/FIFO ordering, original deadlines, muted/replaced/disposed ownership, and both effects/reaction post-cancellation joins. Existing shared admission and main-scan deferral controls continue to pass.
- Scoped ESLint, Prettier and diff checks passed. Root and independent peer review found no blocking issue.

Raw evidence remains under `.cache/solo-followup/feedback-demand-priority/`. The tracked complete-suite TAP is 31,752 bytes, SHA-256 `da729f72c5df84d157bdde87b3d3050cf877d20a24e66ccbf26105fdfc777890`; the five-failure original-source TAP is 4,819 bytes, SHA-256 `562eae80c7ea3431cdccee154282510d659f93925e4b1d58e698c54302b1663d`. The existing 112-file producer and all historical native artifacts remain source-bound and unchanged. This correction requires a subsequent production package and earns no native or physical-device qualification by itself.
