# Campaign browser return — later integration candidate

Six-file correction on exact41d0b908. Back from More chapters restores Missions
and its opener, retaining the original Home/field return and paused attempt.
Normal Play still closes directly into the selected mission. No game rules,
content identities, artwork, save format or public release is changed by this packet.

Verification: original two-path regression fails2/2 as expected; the final ten
cases pass10/10 on Node20.19.5 and10/10 on Node22.22.2. The complete existing
four-file cohort passes99/100 initially. Its one failure was an old fixture
clicking hidden More chapters directly from Home. Correcting that fixture to enter
Missions first gives1PASS/99filtered. Thus100distinct existing cases pass across
the initial and corrected runs, not in one clean combined rerun. All assertions
about conflicting artwork, retained checkpoints, late responses and saves remain.

Native1280×720 keyboard: Home→Missions→catalogue→Escape returns More chapters;
secondEscape returns Home/Missions opener. Paused First Signal0:02/0%/3lives/0score
returns through the same catalogue route to field/Missions focus and stays paused.
Actual Download & play→explicit Replace & play starts Orchard Crossing without
reopening Missions; its subsequently opened Missions labels are correct. Both
modified runtime files were served at their exact pinned bytes. No physical
controller/touch, responsive/offline or public-release acceptance is claimed.

Reproduction from repository root:

```sh
node .cache/p03-worlds-return-41d-r2/verify-source.mjs
node --experimental-loader ./.cache/p03-worlds-return-41d-r2/loader.mjs --test .cache/p03-worlds-return-41d-r2/suite.test.mjs
node --experimental-loader ./.cache/p03-worlds-return-41d-r2/loader.mjs --test .cache/p03-worlds-return-41d-r2/existing.test.mjs
```

Retain current v070 release ownership/cutoff. This is a separate later proposal;
final integrated full gates, synchronized version, freeze and public verification
remain required before acceptance. Merge only related hunks, preserving intervening
app navigation, music and skill guidance. No version is reserved by this packet.
