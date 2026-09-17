# First runtime iteration

Node20 complete11file cohort returned128TAPresults,121passed and7failed. All seven failed at the added helper assertion attempting to read scenario settings from the level-only JSON textarea. This was a test assertion mistake: actual sync writes current.level there, and restores current.settings.classId through class-select. Production source was not changed.

The correction keeps genuinely distinct Scout→Bomber→Fiber edits, asserts each edit changes the selected class, and verifies actual sync restores Bomber then Scout alongside focus/history and preview ownership. Invalid JSON.settings checks were removed; draft/level JSON checks remain for their proper level scope. The failed run, exact first-run test and901input hashes remain preserved. The corrected whole cohort requires rerun; no passing result is inferred from this correction.
