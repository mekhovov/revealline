# Time Attack medal goals

F23a extends the existing Raid Time Attack results. The native result already
contains flight time, damage penalty, medal time and authored medal thresholds;
the result panel now names flight time before the penalty and explains the next
medal. It reuses the existing full-width result-detail row and EN/UK copy owner.

The comparison reads `overflightTimeAttackResult` and the accepted compiled
mission's medal budgets. Legacy missions retain the native fallback budgets.
The exact native `<=` comparison remains authoritative: no display rounding or
new tolerance can award a medal. A completed unranked sortie targets Bronze,
Bronze targets Silver, Silver targets Gold, and Gold reports the highest medal.
An incomplete sortie requires completion; invalid comparison facts are explicitly
unavailable. Score, native result values, recording/record identity and retry
actions do not change.

Targets in the goal sentence retain their authored seconds, including fractional
seconds. Displayed flight, penalty and medal times use hundredths. A positive
shortfall below one hundredth is described explicitly; larger shortfalls round
up to the next hundredth with that qualification. Thus identical displayed
times never imply that an exact miss earned the medal. Ukrainian uses decimal
commas and its localized seconds unit.

## Verification boundary

The focused test uses the actual native result renderer and legal policy, with
explicit terminal-value fixtures for thresholds, penalties and tiny misses. A
separate ordinary-input pilot reaches a real native completion; EN/UK rendering
must preserve its complete serialized state, native result and variant record,
and the existing result owner must write only once. These are source/model tests,
not browser, physical-device, player-comprehension or pacing qualification.

Browser review should inspect a real completed Time Attack at compact width,
its distinct flight/penalty/medal values and the next-medal row; switch EN/UK,
check the existing result actions remain reachable, and retain the exact source
and earned-result facts. A visible fixture may separately demonstrate a tiny
miss but must be identified as a presentation fixture rather than an earned
player result. Capture's time/clean-lives medal explanation and other hosts are
separate remaining F23 coverage.
