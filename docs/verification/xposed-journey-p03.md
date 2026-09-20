# Journey P03 — Signal Gardens greybox preparation

20 September 2026. Provisional **0.71.0**, isolated from P02 source `8631ee2c`.
This is candidate preparation while earlier release gates run, not an accepted
baseline, released campaign or completed phase. Merge the accepted P02 composition
and requalify exact source before promotion. Original/user worktrees are untouched.

Automatic merge `0234e8ba` subsequently incorporates P02 `9fe6276f`, including the
release owner's `014449ed` Journey/Couch music composition. The42-test focused
cohort passes again after this merge. Source composition is not phase acceptance.

## Scope and design

Seven original 72×36 maps form two three-mission learning arcs and one optional
Remix. Bands3–4 continue Border's final core band. The first arc introduces only
slow field, the second only lethal field; both provide introduction and focused
practice before combination. Familiar keeper/perimeter/frontier roles retain their
catalog speeds. No countdown, custom player handling, required pickup, extra menu
gate or new foundational engine mechanic is introduced. “Interference” means the
existing visible slow material here, not an unexplained input/ability penalty.

| Candidate | Route decision |
|---|---|
| Soft crossing | Short slow crossing versus a longer clear approach to the island. |
| Dry spine | Enclose one slow bed from an interior spine, or route around both. |
| Wide approach | Bridge a slow center or link two landings around it while shaping a frontier. |
| Cool the crossing | Neutralize a central lethal bed before crossing, or keep a broad outside route. |
| Garden refuges | Enclose the nearer lethal row, or loop around both ends to another refuge. |
| Neutral ground | Open the slow west or lethal east approach while preserving a central cross. |
| Winding channels | Choose the connection order among three refuges and two material types. |

Studio offers Inspect Signal Gardens greyboxes through its existing explicit
Inspect → Apply contract. Inspection does not replace the current draft or publish
anything. Every mission retains original design metadata, one optional practice
challenge and an explicit null background. Temporary Horizon styling is disclosed
as greybox presentation, not completed campaign art or new characters.

## Reference review

Four supplied stills were directly re-viewed at2048×853 (original6144×2560) and
independently matched to the inherited ledger's original byte length/SHA-256:

| File | SHA-256 |
|---|---|
| pack-1_level-5.png | d13314917e1961950221a182597551dbbd6241d6f9bd15818597c80865ad67e9 |
| pack-1_level-7.png | 4b31b6e97b6fca6d8dd869d47771f13937162214953d220dcf53a7dc9d4b3c0a |
| pack-2_level-1.png | a66bc59d10e8a3310aabf1d8f74ba5b1fd281241f14fce6112137c16a2673302 |
| pack-3_level-1.png | 5b55e34edb9d9e0a4d5c59c02717250defd7a9fdb6b8f0273cfd068bdff67be8 |

The retained ideas are marked central beds, gaps between terrain rows, broad bypasses
and separated refuges. Coordinates, literal lettering, actor counts and artwork are
not copied. The stills do not prove exact terrain behavior, enemy domains/speeds,
collision tolerances or fill rules. We explicitly define our slow/lethal behavior.
The three-bay reference is simplified into separated refuges; no new relay gates
are implied. A final per-reference disposition remains pending greybox comparison,
alternative-route evidence and human testing; these are not four completed imports.

## Verification

The focused candidates/terrain/routes cohort passes **42/42** in19.1seconds. This
includes42 first closures across all presets and steering policies, repeated with
every bonus removed. First returns preserve lives, stop-on-capture and10cells/s
base handling. The first slow lesson adds exactly60fixed ticks over its clear-field
counterpart; the lethal introduction has a safe-material-free opening route.
Every initial field component has a retaining keeper; no topology error is reported.

`game/test/fixtures/signal-clear-routes.json` pins **84 complete Solo routes**:
seven missions × three presets × two steering policies × authored/omitted bonuses.
Each route is replayed from a fresh seed-1 run with legal inputs, zero lost lives,
exact runtime identity/checkpoint and verified exported replay. Replaying all84
on both independent untimed race boards yields equal terminal checkpoints and
simultaneous-clear draws. Optional bonuses are unnecessary for these full clears.
No run is fabricated by mutating gameplay state. Exploration cloned states only
to evaluate route choices, then replayed the selected inputs from a fresh run.

Omniscient active-play durations are18.65–21.95s(Soft crossing),20.45–28.95s(Dry
spine),27.85–28.05s(Wide approach),18.85–30.25s(Cool the crossing),45.05–57.65s
(Garden refuges),26.65–27.95s(Neutral ground),33.75–63.45s(Remix). These are not
human duration estimates. Short candidates need pacing/distinctiveness review;
do not inflate quotas or force waits merely to meet the45–150second target.

Native Studio on the isolated8780server: Inspect retained Nearby shore until
explicit Apply; all7greyboxes then appeared in2campaigns/2packs. Expert Soft
crossing showed2lives,10cells/s,68%target and no countdown. Actual Practice
Start → Down closed on the foundation at0.6%/150points/two lives, then paused.
Elapsed0:19includes idle inspection and is not a speed benchmark. Closing preview
returned to the intact draft; Cool the crossing showed its lethal20×10bed at(25,10).
Two initial boot refusals were caused by omitted local catalog/archive-catalog
files in the sparse worktree. Restoring their exact tracked copies allowed normal
boot; their error logs remain, with no new errors after successful launch.
This is an agent opening observation, not a complete native route or human test.

## Remaining gates

Meaningful alternative routes and mastery feasibility; anti-cleanup/pacing review;
multi-seed and delayed decisions; whole-Journey host continuation; purpose-built
Team terrain qualification; original campaign art/actors/music and reactive
presentation; local assisted-tracing benchmark; native/device/accessibility and
human comprehension/enjoyment; reviewed final-source PR, immutable release,
Pages acceptance and rollback. No phase is complete merely because greyboxes pass.

Local checkout is deliberately sparse to preserve a256MiB source reserve; media/
full builds need512MiB. Changed-source lint/format checks are scoped. Full hosted
qualification must run against a complete exact-source checkout; do not describe
local greybox tests as a full release gate.
