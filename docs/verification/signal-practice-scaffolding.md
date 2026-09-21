# Signal practice warning review

Status: technical scaffolding review completed; human acceptance remains open.
No Signal mission, learning declaration, rule or historical replay was changed.

The two remaining advisory warnings in the whole-Journey teaching review are
Dry spine (`slow-field`) and Garden refuges (`lethal-field`). Each mission declares
practice and combination for its material, immediately after that material's
introduction. The inspector requires an earlier practice before a combination;
therefore it correctly flags the declarations. It cannot determine whether a
particular encounter is sufficiently scaffolded. The warnings remain visible.

## Concrete encounter review

Dry spine starts inside a permanent five-cell-wide reclaimed spine. Its two slow
beds sit on opposite sides with clear approaches, not across the initial return.
The first Up connection can establish a border return before either bed is entered.
The optional life is not needed. Field keepers and the outer patrol are previously
introduced roles; there is no new actor, control or material rule in this mission.

Garden refuges starts above its long five-cell-wide return spine. The first Down
connection reaches that spine before either lethal row. Broad upper/lower bypasses
allow enclosure without entering a row. The changing-frontier patrol begins on a
different, disconnected refuge; it is a familiar role, not a newly mandatory rule.
The lesson is to distinguish unclaimed clear lanes from true return ground.

`signal-practice-scaffolding.test.mjs` preserves the warnings and checks180 starts:
two missions × three presets × two steering settings × five seeds × three initial
delays. Every tested departure closes below1% earned coverage, stops movement,
loses no lives and never enters either authored material rectangle. Both distinct
material regions remain a later route decision. The existing pinned Signal
optional-goal fixture suite also passes alongside these tests on Node20 and22.

## Disposition

Retain both layouts for human review rather than mechanically deleting the
combination labels or simplifying already established enemy roles. This evidence
supports a protected initial approach, not effortless completion, understandable
terrain, measured pacing or enjoyment. Human sessions must still establish that
players can predict neutralization, explain a lethal-field loss, and choose among
the two regions without tedious cleanup. If those observations fail, create an
explicit successor and requalify it as done for Rover; do not alter old editions.
