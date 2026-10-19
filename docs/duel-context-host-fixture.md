# Preserve the published Duel context in host assertions

This test-only correction aligns two expected strings with the already published
Duel contract. The three gentle/standard/expert opening cases still require an
exact summary: `Capture · Duel · One race · First return`. The two completed
Journey cases still require the earned mode wording, now `earned Duel originals`.
All exact board, count, other-mode exclusion, asset, checkpoint, receipt, focus,
input, artwork-failure and progression assertions remain unchanged.

The baseline is captured main `e7465da3e4b1146b492f401fbb165a5e5a4a6202`.
Its context owner was already committed by
`ee6999522b7b218d6c836a3b262dcaeb83ae855e`; its English Duel name by
`f167987b976db8c4627e1ad2b79173e555041f13`. The original host file, its
15 direct relative dependencies and the picture-gallery module are byte-identical
to that main source. Thirteen actual Couch launch/progression/context owners and
the relevant original locale values were also compared exactly.

The motivating F10 candidate's complete adjacent file produced 9 passes and
5 failures, all at these obsolete text expectations, with no skipped/cancelled
cases or protective guard. That is not an actual baseline native test result.
The corrected complete baseline file passed **14/14**, with zero skipped or
cancelled cases, on actual captured main e746 plus this two-path patch. Its exact
source manifest `b7bbfd93ce640b831ce412ff7f2dd00d48350783b6b33cb1457b52533600c470`
was unchanged before and after. TAP duration was 86,865.174 ms; sampled peak
process-group RSS was 1,220.5 MiB. The 1,536 MiB V8 / 2,048 MiB RSS / 180-second
wall protective limits did not trigger. Full output, including the intentional
artwork-failure diagnostics, was retained in the execution receipt.
No production code, helper, catalogue, timeout or package changes are included.
Full repository validation and current-main integration remain pending.
