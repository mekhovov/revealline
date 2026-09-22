# Optional Journey character reactions

## Authored scope

Guide, Engineer, Rival and Sentinel now have original short caption copy in one
frozen, versioned reaction catalog. The result presenter is shared by Solo,
paired-board Versus and Team. Captions are deliberately limited to successful
result screens, not active cuts or recovery. They never replace field warnings,
capture teaching, failure explanations, earned percentages or objective facts.
There are no portraits, voice tracks, animation, timers, new dialogs, focus calls,
input gates, rewards or prompts to keep playing. This does not complete the separate
campaign-character artwork, materials or soundtrack work.

The Guide responds to ordinary Solo clears, Engineer to relay/Team clears, Rival
to successful Versus outcomes (including both-board clears), and Sentinel to a
completed Solo encounter. Names identify speakers without color dependence. Copy
selection is stable from the mission ID and contains no imported text. An unowned
mission, active/paused/failed attempt, invalid mode or draw outside Versus produces
no reaction. A finished race in which neither board cleared has no victory caption.

## Player choice and storage

Appearance & accessibility includes Character reactions in all three modes,
after the existing appearance controls. Captions are on by default and can be
disabled without changing a result or requiring another confirmation. They remain
static and silent with reduced effects or muted audio. Next stays available.

`revealline.journey-reactions.v1` stores only the versioned boolean choice,
independent of release versions, difficulty, Legacy saves and Journey progress.
Loading never writes. Invalid/future records are preserved and default to quiet
session behavior. Refused writes/readback mismatches warn in Settings and provide
explicit Retry; gameplay is never blocked. Cross-tab changes require matching
current storage bytes; persisted pageshow refreshes the choice. Terminal disposal
removes observers and retires the presenter.

## Technical evidence

Ten dedicated catalog/preference/presenter tests cover fixed speakers and copy,
ownership/result guards, strict JSON and accessor rejection, damaged/future bytes,
quota/readback failure, retry, stale cross-tab events, bfcache refresh, disposal,
all three markup prefixes, text-only rendering and unchanged focus.

Actual host tests complete an opening Solo mission, an equal two-board Versus race,
a Team mission and a Sentinel encounter through public input. They verify all four
speakers, no live-play caption, retained completion facts, independent settings,
unchanged authoritative checkpoints and ordinary Next. The Sentinel route compares
the entire resulting checkpoint with the same authored simulation without UI.

Source checkpoint `2abf624ea2e2f0e5e32a6007490f85b614ba5158` passes80 unique
relevant checks on each of Node20.19.5 and22.22.2: ten dedicated tests, four actual
host tests,35 shared-settings/restoration checks and31 shell/display/course-pause
regressions. Node20 ran the Sentinel host case separately after the48-case cohort;
Node22 ran the combined49-case cohort. Repeated cohort executions are not counted
twice. Three selected Node20 preset boot-smoke cases also pass; ten unrelated cases
were explicitly filtered. Scoped ESLint, Prettier and diff checks pass.

Native in-app-browser sampling served that exact commit read-only on port8814.
Through normal chooser and keyboard input, First return completed at34.3%,8,160
points,three lives and0:10. The Guide caption appeared below the existing result
actions, with Next already available. Appearance & accessibility → Character
reactions disabled it immediately; returning to the result retained all those
facts and the same Next action. One click entered the next mission without a
caption or intermediate screen. The next attempt was paused and the preference
restored to its original enabled choice. The normal-viewport result screenshot
was visually inspected. No game state or browser storage was injected.

Native Team/Sentinel/Versus result sampling, small-screen/device qualification,
independent accepted-tree review, human response and public deployment are not
claimed by these checks. All four speakers are covered by actual automated hosts,
not four native playthroughs. This source is not a public release or human
validation claim.
