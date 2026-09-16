# Collection picture return — source candidate

Base `87f0f49c84e2f92bceb24b0a317d5e6c79e64ac6`. When Picture Back waits for
earned-original metadata, the former completion handler could focus a recreated
Collection card after the player chose Search/Close or left and returned to the
page. Generations alone did not protect that newer intent.

The [contract](../../../operation-focus.md#returning-from-a-collection-picture)
adds a separate focus lease, admitted only from the stored original card actually
restored by native close, before rebuilding cards. It retains model, population
and picture-generation checks and the existing keyed/enabled-card/Search fallback.
An already detached native origin remains BODY without a new return claim. Pager,
render, score, Replay, image-acquisition and shared-helper implementations are
unchanged. Later pager composition must preserve its independent owner.

## Executed checks

| Runtime      | Complete files                                              | Result | Wall time |
| ------------ | ----------------------------------------------------------- | ------ | --------- |
| Node 22.22.2 | gallery-return-host, gallery-focus, collection-context-host | 60/60  | 20.261s   |
| Node 20.19.5 | same three complete files                                   | 60/60  | 21.955s   |

Thirteen new cases use actual Solo entry and Collection markup, valid stored earned
originals, a paused twenty-tick cut, and the real shared-media read path. The modeled
boundaries hold IndexedDB completion, decode a finite image, restore native dialog
focus before queued close, emit actual event ancestry and use one Window identity.
They cover success/refusal, Search/Close, focus then BODY, keyboard/pointer intent,
blur/hidden return, pagehide, choices before queued close and an already detached
origin. Closing releases the prior full-view image; profile/media records and the
paused checkpoint remain unchanged.

Forty-one existing gallery cases retain their assertions, covering stable/reordered,
removed/empty/disabled fallbacks, Replay handoff, late image release, old-close/new-view
and Collection close/reopen. Their corrected legacy adapter supplies tags, ancestry,
focus events and native-origin restoration. Direct card `onclick` means focused
keyboard activation in that adapter; close remains synchronous. Six existing actual
Collection-context cases supplement the new queued-close model. This is not a claim
that the legacy fixture is a full browser.

Lint, formatting and whitespace checks passed. Three changed source/test pins stayed
held across both successful runs. Node 20 additionally recorded all 300 finite
materialized inputs before/after, identical. Node 22 did not record a complete
before-run import graph; its exact source hold and finite admission remain available.
Documentation was updated afterward; both original tested guidance bodies are
retained separately.

## Retained diagnostics and limits

The first two-case fixture run lacked a seed-time decoder and failed before host
boot. After that fixture correction, the normal return passed and the Search-during-
metadata case failed against unchanged base runtime, reproducing the focus steal.
The first successor ran 9/13: metadata refusal with an absent pack correctly used
Search rather than a disabled card, and three tests initially included the existing
suspension autosave timestamp in the return-handler no-write baseline. Final cases
separately establish that lifecycle-only suspended-slot write while metadata is
held, then verify the return writes nothing further. Profile/media/checkpoint
assertions remain in place. Original failing logs are retained, not reclassified as
passing qualification. Historical failures do not have a complete immutable test-
source import graph.

[Verification](retained/verification.json) and the [copy map](evidence.json) bind
raw logs, inputs, source holds and exact/lossless copies. Root reviewed the complete
production/new-host scope and Parfit reviewed the adapter-only successor; both found
no blocker. The earlier verification receipt's pending adapter note is historical;
the map records its later closure. No tests were rerun for documentation alone.

No browser was driven or image inspected for this candidate. Native focus visibility,
responsive/zoom, physical controller/touch, offline/public and final-source phase
qualification remain open. No version, simulation, persistent schema or release
change is included.
