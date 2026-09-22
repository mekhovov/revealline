# Complete visual references in saved flights

The v5 session envelope retains an exact full-collection reference together with the existing picture/story choices, continuation, simulation recording and authored mission identity. It does not change campaign hashes, progression, storage budgets or collision rules. Older v1-v4 sessions retain their readers and writer behavior. A caller opts into v5 by supplying `visualThemePin` to `suspendSession`; ordinary gameplay does not yet write it.

## Validation and recovery

The pin must describe Solo content with the saved content theme and the same original campaign key, level ID and revision as its chosen picture. Difficulty-specific execution identity is checked separately against the run and picture envelope, preserving Gentle's original artwork ownership. Unknown fields, missing pictures/continuation, unsupported pin metadata and conflicting identities fail before releasing inputs or writing storage. Installed restore still authenticates the picture owner against the accepted execution catalogue.

This validation does **not** approve the pin's edition or collection, authenticate its level hash, fetch a retained manifest or decode assets. The staged visual owner must perform those checks against accepted content before replacing a live attempt. Solo now stages independently owned release assets for the declared FPV/First Signal coverage before adopting a v5 flight. The shipped catalogue must match the exact saved selection, authored level hash and presentation identity. Images/fonts and selected audio bytes are verified before adoption; the saved picture is separately prepared by its existing owner. Missing coverage, invalid bytes, cancellation or picture failure keep the active checkpoint and saved bytes. Library file classification recognizes v5 so export/recovery remains possible. See [Live visual restoration](saved-visual-restoration.md).

Attempt export and coordinated backup preserve the full reference. A backup containing v5 requires the same trusted picture identity catalogue as v3/v4. Neither output embeds the referenced presentation files; do not describe this as complete media backup or offline readiness. The existing import and local-save budgets remain unchanged.

## Qualification boundary

Cover both turn policies, Standard/Gentle, still/story envelopes, continued simulation, caller mutation, forged matching owners, malformed writes, storage failure, installed/replay-only export and backup round trips. Exercise the real Solo host's unsupported-collection recovery, including checkpoint and saved-byte preservation. Historical session, picture, story, export and backup suites remain required.

The live restore path is qualified separately from this envelope. Remaining work includes fresh-attempt theme selection, the two-collection benchmark, Couch ownership, pinned offline dependencies, ordinary release gates and public journeys.
