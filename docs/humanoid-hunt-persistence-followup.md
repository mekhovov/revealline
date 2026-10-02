# Hunt persistence follow-up

Worktree: `codex/humanoid-hunting`, after merging main `e48adf318`.
Automated suites remain waived by `publishing/test-policy.json`; none were run for this follow-up.

## Concrete gaps closed

- Normal Team Journey hunts and encounter variants previously had no reachable durable attempt. The installed Creator Team recorder required an installed edition, while the Hunt lesson chapter has no such edition. Team now has a separate bounded save slot and visible **Continue saved Team hunt** controls in its lobby.
- Input release was outside the installed Team command journal. Pause cancels rescue, clears held support/directions, and requires neutral input; replaying only movement ticks could diverge after a pause. Both Team Hunt and installed Team journals now record explicit release entries. Installed journals containing releases use `revealline-installed-team-attempt.v3`; the existing v1/v2 readers and unchanged legacy serialization remain available.
- Team's existing departure confirmation described these hunts as unsaved. Localized Hunt copy now explains that leaving/changing setup preserves the checkpoint, while explicit Retry replaces its own checkpoint after the accepted restart begins. A separate saved attempt cannot be overwritten by merely starting another hunt.
- Cross-store Continue now transfers the complete verified journal between installed Team and the separate Hunt slot. Advanced restores never start a new empty journal. Recipe identity comes from the immutable tuned source, because Team initializes and later mutates actor fields inside `run.level`.
- A browser follow-up found a checkpoint created by the earlier development code, before the immutable identity fix. Continue now also recognizes the initialized-level identity derived from the same exact trusted recipe, but only normalizes it after the full replay checkpoint verifies. Unknown identities and mismatched checkpoints still fail closed. The UI distinguishes source, recipe, rules-version, ended-input and replay-verification failures in English/Ukrainian instead of hiding every cause behind a generic failure.
- During arena publication, both journals collect input releases but remain unable to write until every rollback-capable acceptance check has passed and the preparation observer has detached. Normalizing an accepted save therefore cannot invalidate its own saved-byte ownership guard. Unexpected Continue cancellation now reports whether the save changed, the game lost foreground, or activation was interrupted; cancellation is no longer silently swallowed.

## Save and Continue contract

`game/coop/hunt-attempts.mjs` stores the exact source pack/level identities, accepted variant identity, tuning, seed, difficulty, cooperation flags, ruleset, and both seats' compressed inputs. It checkpoints the full authoritative JSON state, including actor RNG/decision clocks, fixed guard aim and warning clocks, projectiles, bonuses, cells, rescue/support state, shared quota/score, per-attempt downs and elimination contributors.

The save slot is `revealline.team-hunt-attempt.v1`. It is bounded to 1 MiB, 8,192 journal segments and 240,000 ticks. Writes occur at most every 600 simulation ticks (five seconds), plus pause/exit lifecycle boundaries. Saving does not replay the attempt. Continue reconstructs from the current owned source and replays with cancellation/yields every 600 ticks, then requires an exact full-state checkpoint match before publication. It does not accept a stored win, manufacture a campaign award, or bypass picture ownership.

Storage updates compare the exact previously owned bytes. Competing tab changes, unreadable data and unknown formats are retained. Storage failures leave the previous checkpoint untouched and show a visible message during play. The slot has an explicit two-step discard, export, and bounded import. Imported inputs are verified at Continue; an imported file alone cannot earn progress. Unknown raw bytes can be exported in a recovery envelope before explicit discard.

Retry pins the existing accepted recipe, seed and configuration. Only its explicitly authorized prior attempt may be replaced. New/changed hunts preserve any other saved attempt; the player can continue or discard that slot in the lobby. Completing a hunt clears only its own unchanged checkpoint. Campaign profiles, installed-edition progress and artwork ownership remain separate.

## Direct runtime observations

These were direct Node runtime inspections, not an automated suite or a qualification claim.

1. The authored standard Team first-contact lesson, seed 47, reached a natural touch kill using seat 0's downward boosted input at tick 163. Save/Continue retained 100 points, one touch kill, the `near-runner` elimination, contributor `[0]`, runner RNG and `nextTurnTick: 180`. Paused Continue retained the neutral-input gate; replay after resume and five more neutral ticks matched at tick 168 with the same score.
2. A two-target capture-quota fixture derived from that accepted lesson restored at one kill out of two, 100 points, status `running`. It did not mistake the partial quota for completion.
3. In the authored standard break-the-aim lesson, seed 47, seat 0 moved right for 30 ticks then stopped. The guard entered warning at tick 480. Save/Continue preserved target seat 0, aim `(27.710000000000036, 17.5)`, `warningUntil: 660`, RNG `4236636447`, and its exact movement state.
4. Checkpoint tampering was rejected by exact replay verification. An already-aborted Continue returned `AbortError`. A competing attempt's write was rejected, and an unknown `future.v99` slot remained byte-for-byte unchanged.
5. A synthetic same-instant contact transaction gave two surviving seats one shared 100-point elimination with contributors `[0, 1]`. Adding a simultaneous fatal projectile at seat 0 downed that seat and credited only surviving seat 1. Advancing another tick retained exactly one elimination and 100 points in both cases.
6. The installed snapshot validator accepted an unchanged v1 snapshot. A journal containing pause release serialized as v3 and passed its strict validator. Full IndexedDB install/restore was not exercised in this follow-up.
7. An advanced installed snapshot at tick 163, seed 17, transferred both movement and release segments into the Hunt slot, then passed exact replay with the same 100 points and attempt ID. A fresh snapshot also matched the host's immutable gameplay identity. Code review closed a stale-slot race during asynchronous picture preparation and ensured explicit same-attempt discard does not immediately recreate its save.
8. An old-style development snapshot at tick 163/100 points with initialized identity `7a32c2ded5a43296` exactly replayed and returned immutable identity `27504839a7c91af3`; the supplied source remained unchanged. An unrelated identity returned `rulesChanged`, and a damaged checkpoint returned `verificationFailed`.

Scoped syntax checks, ESLint and Prettier passed for the changed persistence modules and Team host. Focused regression cases were added in `game/test/team-hunt-attempts.test.mjs` and intentionally left unrun under the waiver.

The parent agent also exercised the actual Team host in the browser: a four-second first-lesson checkpoint survived reload, Continue restored zero of two targets and zero points, and the continued attempt reached 25 seconds before pausing without browser errors. After the final review fixes, a fresh foreground Team tab recovered that preserved 25-second checkpoint without discarding it, reached 32 seconds with zero of two targets/zero points, and paused at 38 seconds without browser errors. The intervening cancellation was the existing background-tab focus guard; the checkpoint remained intact. Screenshot: `docs/evidence/humanoid-hunt-team-continue.jpg`. This is bounded UI evidence for ordinary reload/Continue and the early-identity compatibility read, not proof of every variant, quota state, native host, or storage failure.

The browser's Export button reported that export was requested, but observation of the download event timed out. Download/share completion and export/import round-trip acceptance are therefore not qualified by this run.

## Remaining evidence limits

- Downloaded-backup import, two real tabs, IndexedDB restore and constrained native storage still need host acceptance checks. The browser observation above covers one ordinary reload/Continue path; direct runtime verification establishes additional core/journal fidelity without claiming those other UI behaviors.
- Continue requires the exact mission source and difficulty to be available in the current Team host. A different Journey route or a user-imported pack must be reopened before Continue; source images are not copied into the save. Missing or changed sources leave the checkpoint intact and explain the required action.
- The attempt slot is separate from campaign backup and personal Hunt records. Its own export/import controls are the supported portable path. No complete-backup integration is claimed.
- The last successful checkpoint remains recoverable if an attempt reaches the bounded journal limit. Unlimited attempts and recovery across changed simulation/variant definitions are not promised.
- Existing v1/v2 saves that were already produced with an unrecorded pause may fail their existing exact verifier. They are preserved; there is no invented migration for missing authoritative input releases.
