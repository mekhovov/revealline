# About: visible focus on controller join

Four-path correction on `61cf9c14e8f4a97eae81e7c30d0191029adc817a`, unpublished v0.61.4 unchanged. A joined router sample now calls the existing navigation `engage()` before command handling. It visibly selects Return when no control owns focus, or marks the already focused control. Join/hold/release cannot activate that control; a fresh Confirm is required.

Actual-host red checks reproduce three failures on both Node versions: first BODY join, preservation/marking of focused Summary, and held-arrival eventual join. The unchanged regression file passes after the host correction. Complete eight-file cohorts pass **201/201 on Node20.19.5 and 201/201 on Node22.22.2**, with zero skips/cancellations. Scoped lint/format, whitespace and reverse-patch checks pass. See `qualification.json` for exact argv, all before/after source pins and preserved failed receipts.

An early Node22 red run was stopped after cyclic DOM failure formatting consumed excessive memory. Equivalent boolean reference-identity assertions retain the same checks while producing bounded failure output. Both subsequent red runs reproduce the defect before the runtime fix; the aborted run is not acceptance evidence.

No version, index, remote, browser, root-workspace or shared producer edits. Parent owns review/commit and native/public release gates. This packet proves modeled input/focus semantics, not physical-controller or viewport qualification.
