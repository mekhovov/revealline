# Independent Collection recovery review

Candidate patch `35c3fcd50b06c66d7837b8049154189e92bc612785bf8c8b4c6c0f450064d382`
was reviewed independently against its frozen P06 pack-review foundation on
`8cffb36b`. It is not yet adopted into the device branch or public release.

The unchanged Library implementation reproduces the real keyboard failure:
`card.disabled === true` for a legally earned unavailable legacy picture.
The same host test expects an actionable recovery entry and fails at that
assertion. This is a product-behavior failure, not a missing fixture/module.

The candidate passes both complete test files: six actual-host cases plus
52 existing gallery-focus cases, **58/58 on Node 20.19.5 and Node 22.22.2**.
Source reads are independently checked against the copied candidate or exact
base Git bytes; each receipt retains the full TAP, SHA-256 and unique input list.

The reviewed runtime delta makes unavailable legacy cards actionable, opens
existing pack recovery tools, states which historical identity fields are
unknown, and retains the actual opener/page/query through guarded close and
repopulation. The six host cases check keyboard and modeled controller use,
paused checkpoint preservation, stale close versus newer Search focus, Library
tab changes and a missing source-pack identity. Existing managed-still recovery
remains separate. No image or score is invented by opening recovery details.

This does not establish original historical image identity or repair ambiguous
old receipts. It does not independently certify the owner's later native import
journey, physical device use, the complete P06/P16 phases or a public release.
Integrate the required pack-review foundation and reviewed successor hunks;
append skills instead of overwriting later guidance. Requalify final source and
native/public journeys after integration. Keep the device release independent.
