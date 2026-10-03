# Living Routes: six-pilot review packet

These six authored pilots are structurally admitted. A level being selectable, a working preview, or a successful package import does not demonstrate completion or release qualification. This packet supplies exact review identities and native editable sources; it does not generate play inputs or completion evidence.

## Prepare the packet

From the repository root:

```sh
node scripts/qualify-pursuit-pilots.mjs prepare /tmp/pursuit-pilot-packet
```

The command uses the production compilers, validators and package readers. It does not step gameplay or run an automated suite. The result contains:

- `capture-solo.json`: dedicated Crossing Post pilot source, supporting Solo and Versus.
- `capture-team.json`: dedicated Pincer Yard and Relay Rendezvous pilot source.
- `snake-pilots.rlsnake.json`: the two exact Classic Snake source layouts.
- `low-pass-depot.zip`: editable FPV World Studio project.
- `low-pass-depot.rlpack`: the same native World project in the portable package format.
- `manifest.json`: six pilots, 32 mode/pace cases, accepted recipe identities, native format, exact seed, launch path, source revision, artifact bytes/SHA-256 and outstanding gates.

Preparation round-trips Capture JSON through its compiler, Snake through its package reader/exporter, and FPV through its editable ZIP and package readers. These are programmatic format checks, not browser round-trips. The manifest records the source Git commit and whether the checkout was dirty. Regenerate from the final committed source before archiving qualification evidence. Imported Studio copies remain separate editions; community copies cannot qualify or unlock an official mission merely by retaining its title.

The dedicated Team pilot and the full campaign's Relay Rendezvous are different accepted editions. Do not substitute the chapter recipe for the pilot recording.

## Launch the actual pilots

Use the running game's origin; the local examples below use `http://127.0.0.1:8779`. Capture links open the campaign entry, not a pinned mission or difficulty. Select the named mission and difficulty in the native menu before Start, choose authored encounters, and avoid continuing a different saved attempt. SIM links select the course; choose the specified flight mode separately. Each manifest case includes `launchKind` and `beforeStart` instructions. Capture modes use Gentle, Standard and Expert; Snake uses Slow, Normal and Fast; SIM uses its native Self-level and Acro flight modes.

| Pilot                                                      | Modes                      | Pinned seed | Entry                                                                                                                                          |
| ---------------------------------------------------------- | -------------------------- | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Crossing Post (`crossing-post`)                            | Capture Solo               |           1 | `/game/?journey=pursuit-pilots-v1&lang=en`                                                                                                     |
| Crossing Post (`crossing-post`)                            | Capture Versus             |           1 | `/game/couch/?journey=pursuit-pilots-v1&lang=en`                                                                                               |
| Pincer Yard (`pincer-yard`)                                | Capture Team               |          17 | `/game/couch/relay-rescue.html?journey=pursuit-pilots-v1&lang=en`                                                                              |
| Relay Rendezvous (`relay-rendezvous`)                      | Capture Team               |          17 | Same Team entry; choose Relay Rendezvous                                                                                                       |
| Cable Cutoff (`classic-living-cable-cutoff`)               | Snake Solo / Versus / Team |          17 | `/game/snake/play.html?mode=solo&level=classic-living-cable-cutoff&activity=campaign&targets=authored&board=retro&pace=normal&seed=17&lang=en` |
| Shield Window (`classic-living-shield-window`)             | Snake Solo / Versus / Team |          17 | Replace the preceding level ID with `classic-living-shield-window`                                                                             |
| Low Pass Depot (`snake-hunt-ground-routes-low-pass-depot`) | SIM Self-level / Acro      |        9601 | `/optional-practice/civilian-fpv/worlds.html?snake-course=snake-hunt-ground-routes-low-pass-depot&lang=en`                                     |

The last URL is the repository's source preview. In a packaged installation use the Snake hub's FPV SIM courses and its optional-package launcher; the installed Worlds entry is `/optional-practice/fpv-worlds/index.html` with the same `snake-course` query. Change Snake `mode` and `pace` explicitly; all accepted combinations have an exact URL in the manifest.

Capture's normal launchers do not accept a generic seed query. Their initial Solo/Versus seed is 1, and Team uses 17. The older `expressive-content-inventory.json` proposed seed 17 for Capture review; it did not guarantee that seed was available from every launcher. This packet follows the actual launchers and does not modify historical rules. Capture Solo recording cases pin Scout, immediate turns and the native class recipes; other class/control qualification needs a separately declared case. Do not use “New route” or a remembered different seed when gathering this evidence.

## Authoring and preview access

Open `/game/studio/?lang=en`, then **Browse bundled candidates**:

1. Search **crossing post** and choose **Inspect Living Routes pilot · Solo / Versus**. Inspecting only stages Source; use **Apply** to adopt it into the current draft.
2. Choose Crossing Post and **Play exact Solo preview ↗**. Its scenario transport now preserves the actual pursuit rules. **Enter preview** transfers input ownership. The child's **Return to editor** returns focus while retaining the preview; the parent's **Close preview** disposes it and focuses the launch button.
3. Search **pincer yard** and choose **Inspect Living Routes pilots · Team**. Apply, then use the existing Team mission/campaign export and native Team launch. A Team map preview is not substituted with a Solo run.
4. **Inspect Living Routes chapters** exposes the complete Solo/Versus and Team source programmes through the same inspection/apply gate. It does not replace a draft automatically.

Export and re-import the corresponding packet JSON to review preservation of the Capture source. The original draft remains subject to the existing unsaved-source guard.

Open the existing Snake Studio (`/game/studio/snake.html`) and import `snake-pilots.rlsnake.json` to inspect/export both source layouts. Installing or playing that package creates community identities; gather official pilot recording evidence from the official catalogue links above.

For Low Pass Depot, open FPV Worlds → Workshop / World Studio, import `low-pass-depot.zip`, and inspect the Hunt targets, routes and per-mode objectives. The `.rlpack` is available for native package installation. Use the normal export/import/preview controls; the packet cannot claim that a human completed those browser steps.

## Verify actual exported completion recordings

Keep the original exported file and archive the receipt alongside it:

```sh
node scripts/qualify-pursuit-pilots.mjs verify crossing-post solo standard /path/to/solo-replay.json > /tmp/crossing-post-receipt.json
node scripts/qualify-pursuit-pilots.mjs verify crossing-post versus standard /path/to/versus-round.json > /tmp/crossing-post-versus-receipt.json
node scripts/qualify-pursuit-pilots.mjs verify pincer-yard team standard /path/to/team-recording.json > /tmp/pincer-yard-team-receipt.json
node scripts/qualify-pursuit-pilots.mjs verify classic-living-cable-cutoff team normal /path/to/snake-session.json > /tmp/cable-cutoff-team-receipt.json
node scripts/qualify-pursuit-pilots.mjs verify snake-hunt-ground-routes-low-pass-depot self-level native /path/to/world-recording.json > /tmp/low-pass-depot-receipt.json
```

- **Capture Solo:** finish the mission and use **Export replay** from the result. Raw native replay and the existing presentation wrapper are supported. The verifier pins the complete accepted level, seed, class recipes and turn policy, then uses `verifyReplay`; it requires the reconstructed result to be won. A Studio greybox preview has its own ownership and is not assumed to be the tuned official candidate attempt.
- **Snake:** finish the attempt, open **Workshop**, and use the native session export. The verifier reconstructs the entire match through `restoreClassicSnakeMatch`, including Team and paired Versus. It rejects a wrong seed, pace, remix or recipe. A Versus win caused only by the opponent colliding is not a completion route: at least one board must actually clear the mission. The receipt lists exactly which boards completed.
- **SIM:** export the individual World proof or an archive part containing exactly one matching Low Pass Depot recording for the chosen flight mode. Archive integrity is checked before native replay. `replayWorldFlight` verifies the exact accepted course, world, rules, response and final state; an unfinished recording cannot qualify a clear. Export different matching attempts separately to avoid ambiguity.
- **Local Capture Versus and Team:** finish the attempt, then use **Export recording of this round** in Versus or **Export Team recording** in Team. The export contains the native accepted recipe, bounded paired input history and release markers, plus SHA-256 pins for the recipe and complete native terminal state. The CLI reconstructs `createDuel`/`stepDuel` or `createCoop`/`stepCoop`; it requires at least one actual Versus board clear or a won Team mission. Timer and collision wins do not establish a completion route. The Versus pilot uses its native untimed authored race, Scout, immediate turns and seed 1; Team uses Full cooperation and seed 17. An export covers **one Versus round**, including normal coverage/lives/score tiebreaks, rather than a first-to-two series. A verified Team Continue retains its earlier journal. Paused unfinished attempts cannot be exported as terminal recordings. Imported recordings do not update progress or rewards.

The historical checked-in packet retains its original source pin and reports the export availability at that revision. Use `prepare` to obtain current admission metadata; this does not supply new completion evidence or replace the historical receipt.

The verifier resolves expected recipes from the current native catalogue; it never trusts a packet's imported identities or actor positions. Input files are bounded before parsing, and native validators retain their own stricter limits. A valid replay establishes reproducible simulation completion, not an author signature or proof that a human supplied the controls.

## Qualification still required

Record real review evidence for each supported mode/pace and pinned seed: completion route, readable movement/vulnerability, useful Team roles, paired-board fairness, clean/brutal equivalence, touch/gamepad ownership, EN/UK, 320/360/390px layouts, performance and browser Studio round-trips. Derived seeds require separate review. This tool never marks human understanding, accessibility, device performance or public release as passed.

Automated suites remain waived. Regression sources for the preview transport, startup picture ownership, locale-before-draft behavior and packet verifier are authored but are not a claim that those suites were executed.
