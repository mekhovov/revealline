# Team and Duel native gameplay audio — 16 October 2026

This extends C3 in the [reviewed continuation plan](team-duel-plan-continuation-2026-10-16.md).
It records normal keyboard gameplay in the Mac desktop browser with a genuine
Studio-exported candidate. It is separate from the earlier 35/102 digital probes,
the bounded actual-host suite, acoustic listening and production admission.

## Exact local candidate

The original `revealline-fpv-r107.rltheme` export is 8,818,841 bytes with SHA-256
`4f7e20a0b7936d81b8160002addfddddbc08f5ee87ab3fecd19f85a3bbd563d0`.
The ordinary compiler produced 139 files, theme `fpv` revision 107, with runtime
SHA-256 `04b79caefe1a8683d29034d03c81f885a5595556d479e1246769e3f972e20cc4`.
The selected failure is the existing project `loss.wav`; pickup is the retained
Kenney CC0 OGG; victory is the existing CC0 MP3 verification signal. Capture
remains the shipped recipe. These are retained originals, not new sound design.

Base source is `690a85f3c1fc62ea1142d635ac41d63d18b6b13b`. The local observation
candidate is `c0dc9f8b193db8effc616341521a833e3b7e54af`, tree
`6dbc820d824c7e56cddcd60c91255ee71280b2b6`. Its [binding](verification/team-duel-gameplay-audio-2026-10-16/candidate-binding.json)
pins all 146 overlaid files: actual compiler output, three development observer
files, two tiny entry loaders and the two entry HTML module references. Only 14
paths differ from the base. Normal Team/Duel host, engine and audio runtime
modules remain exact base bytes. Reviewed retained presentation runtimes remain
unchanged; revision 107 is never renamed or admitted as an approved predecessor.

The [110,696-byte Git bundle](verification/team-duel-gameplay-audio-2026-10-16/local-review-candidate.bundle)
retains every candidate object absent from the base and verifies against that
required base commit. Its SHA-256 is
`5b3bf7911c7ad7405f27c306d82b35771926731285ec09c83234e4e4dc514fd5`.
It is an observation artifact, not a release or production approval. The private
staging ref was removed after retention; no production worktree compiled output
or approval pin was edited.

The [transport binding](verification/team-duel-gameplay-audio-2026-10-16/before-fix-transport-binding.json)
and [bounded request receipts](verification/team-duel-gameplay-audio-2026-10-16/before-fix-candidate-requests.jsonl.gz)
identify offered exact-Git bytes. They do not by themselves prove browser
consumption. The helper's baseline origin was unused. No frame/load performance
comparison is claimed for this instrumented candidate.

## Team: cold fallback and ready custom failure

Team Originals `twin-landings`, Expert, FPV actors, sound on, automatic Next and
Retry off, ran through the ordinary start, keyboard and Restart controls. No
run state, event, clock, decoder result or buffer was inserted. Real trail
crossings and enemy impacts consumed the one reserve and ended each attempt.

The [cold receipt](verification/team-duel-gameplay-audio-2026-10-16/team-cold.json.gz)
retains terminal delivery `2849`: warning plus the native bank's `loss` voice,
buffer `238`. Custom failure buffer `2853`'s decoded-and-hashed identity was
recorded 97 ms later. Both buffers
have the same original SHA-256
`574ed8153f407aff77e2ad5316ac1ca8d1b6aec95ddfc6b793e76bdc8f0e4a14`.
The custom buffer starts zero times through the retained cold snapshot, 11.849
seconds after that identity record. Readiness does not replay the expired defeat.

After deliberate Restart, the [ready receipt](verification/team-duel-gameplay-audio-2026-10-16/team-ready.json.gz)
retains terminal delivery `8739`, one custom voice named `failure`, board `solo`,
native source `8741`, exact buffer `2853`. Its fallback-bank identity list is
empty; the different same-byte `loss` buffer remains `238`. The successful native
source start joins to the same delivery, owner and buffer. There is one custom
failure start through the 11.618-second follow-up. A simultaneous warning remains
separately owned. Natural earlier support/revival/capture activity is also
retained; no custom OGG pickup or MP3 victory gameplay pass is inferred.

[Input attempts](verification/team-duel-gameplay-audio-2026-10-16/team-actions.json.gz)
and a [native result image](verification/team-duel-gameplay-audio-2026-10-16/team.jpg)
accompany the raw observations. An independent read-only review verifies the
native start/voice/decode joins, snapshot prefixes and exact candidate overlays.

## Duel: a witnessed semantic-cooldown gap

Both native Duel runs—the original negative observation and the corrected rerun
below—used the manually entered, unrecognized `journey=versus-expedition-v1`.
The valid route ID is `duel-expedition-v1`. Neither run adopted Duel Expedition;
both actually ran the legacy catalogue's Orchard Crossing (`orchard-crossing`).
The raw action logs retain their original mistaken Expedition labels. No
Expedition-specific native pass is inferred.

The original candidate entered ordinary Duel through its page. An initial
picture preparation exposed Retry; the existing Retry control completed and
enabled Start. The exact failure reason was not captured, so this is not labeled
a diagnosed timeout. Expert, FPV actors, sound on and deliberate continuation
remained selected, with three lives per seat and a 90-second race.

The [cold](verification/team-duel-gameplay-audio-2026-10-16/duel-cold.json.gz) and
[warm](verification/team-duel-gameplay-audio-2026-10-16/duel-warm.json.gz) receipts
show both boards delivering real batches containing `lineImpact.arrived`,
`lineImpact.cleared` and `player.failed`. The first failures start native `impact`
and `neutralized` voices. Custom failure buffer `4615`'s identity is then recorded
after native decoding and byte hashing. Despite that
readiness, subsequent failure deliveries `7581` and `7584` still contain no custom
failure voice: the generic impact has already occupied the same board/family
cooldown used by the semantic replacement.

This negative native result is retained, not reported as a Duel custom-audio
pass. The [final paused observation](verification/team-duel-gameplay-audio-2026-10-16/duel-before-fix.json.gz),
[input attempts](verification/team-duel-gameplay-audio-2026-10-16/duel-actions.json.gz)
and [image](verification/team-duel-gameplay-audio-2026-10-16/duel-before-fix.jpg)
preserve its actual scope. The diagnosed correction must retain per-board
semantic cooldowns, ordinary recording-family limits, pause/mute, native voice
budgets and the no-late-replay rule.

## Diagnosed source correction

`FeedbackDirector.play` now tracks the selected published semantic name and its
existing recording family in a separate per-board cooldown entry. An unrelated
impact does not occupy that semantic entry. A custom cue still stamps its
ordinary family entry; an actually started cold native fallback also stamps its
semantic entry. The 45 ms / 160 ms windows, native family limits, per-board voice
retirement, pause/mute and budget-denial behavior remain in place. An impact and
a failure can express their separate meanings in the same batch; repeated
failure deliveries cannot produce another cue inside their existing window.

Two Studio-restored regressions cover the actual observed batch on both boards
and the cold-fallback-to-ready transition. The former fails before correction:
four native sources appear instead of six because both custom failures are
missing. It passes after correction. The complete four-file audio cohort passes
55/55 with no skips. An additional actual-host case authors a valid 72×36 classic
line-impact arena, uses ordinary keyboard movement so a real bouncer strikes each
growing trail, then deliberately restarts and demonstrates the ready failure on
both boards. Its selected case passes. Fixture admission/route failures were
retained while this new route was prepared; no runtime event or position was
inserted to repair it.

The corrected source file SHA-256 is
`943fe7c3319348ba98f723e03a44ae57e1acbbafe8e284ef44547a3aade0d060`.
The negative native receipts above remain bound to their earlier source; they
are not promoted to an after-correction pass. Corrected native confirmation is recorded below. Final-source hosted checks
remain a separate completion condition.

## Corrected native Duel confirmation

The corrected source is `42774e835ff34c367b51c1fd83bd0664269d60ec`, with local
observation candidate `6e74a45aa5aa892fc0903b2c36c98ed49ceb6201`, tree
`a110d17713606a92aa17a3a6a39831afa9be0120`. The [new binding](verification/team-duel-gameplay-audio-2026-10-16/corrected-candidate-binding.json)
pins all 146 overlays and five actual runtime source members. The
[120,744-byte retained candidate](verification/team-duel-gameplay-audio-2026-10-16/corrected-review-candidate.bundle)
requires that source commit and has SHA-256
`6d3e22114b73718c388cc2623d1d9d2b53b870b75312dad8a015838034ce9046`.
The same genuine revision-107 compiler output and unchanged reviewed retained
assets accompany the source correction. [Transport binding](verification/team-duel-gameplay-audio-2026-10-16/corrected-transport-binding.json)
and [offered-byte receipts](verification/team-duel-gameplay-audio-2026-10-16/corrected-candidate-requests.jsonl.gz)
retain their earlier response-prepared limitation; no baseline or performance
result is inferred.

The corrected rerun used the same unrecognized manually entered journey query
and again ran the legacy Orchard Crossing arena through ordinary Duel controls:
Expert, FPV actors, sound on, automatic Next/Retry off. The [cold checkpoint](verification/team-duel-gameplay-audio-2026-10-16/duel-corrected-cold.json.gz)
has zero custom starts through 9.339 seconds after custom buffer `4639`'s
decoded-and-hashed identity record. Same-byte bank `loss` is the different native
buffer `38`. Both retain the exact 38,444-byte original SHA above and native
48 kHz, mono, 28,800-frame, 0.6-second buffer facts. These timestamps include
hashing and do not measure decoder completion latency alone.

In the [ready checkpoint](verification/team-duel-gameplay-audio-2026-10-16/duel-corrected-warm.json.gz),
the actual impact/clear/failure batches now produce custom voice `failure` for
board 0, delivery `7494` / source `7497`, and board 1, delivery `7531` / source
`7534`. Both native starts use exact custom buffer `4639`; neither is a
fallback-bank buffer. The previously witnessed suppression is corrected in
ordinary gameplay on each seat.

The [paused checkpoint](verification/team-duel-gameplay-audio-2026-10-16/duel-corrected-paused.json.gz)
keeps the same 33 deliveries and 109 native starts after native movement while
Resume is focused. Both pause flags are true and the context is suspended. A
post-click locator timeout is retained; fresh UI confirms that Pause actually
succeeded. A later DOM-focused Resume loses native focus and safely pauses
again. Native Shift+Tab/Return and temporary browser visibility restore ordinary
focus; no focus, clock or pause guard is bypassed.

The [actual drawn result](verification/team-duel-gameplay-audio-2026-10-16/duel-corrected-result.json.gz)
ends both boards at zero lives and zero territory. The later board-1 failure is
delivery `8885` / source `8888`; board 0 is `9070` / `9072`. Exactly one separate
match-result owner, `duel-result`, is delivery `9073` / source `9074`. All use the
same ready custom buffer. Board 0's terminal failure and the match-result cue
share audio time `166.192`: one result owner does not mean one total failure
playback across that settlement. The [later follow-up](verification/team-duel-gameplay-audio-2026-10-16/duel-corrected-followup.json.gz)
still has 44 deliveries, five total custom failure starts and one match-result
delivery. All cumulative record prefixes and candidate byte pins pass independent
read-only review, with zero dropped records or observer errors.

[Ordinary input/focus attempts](verification/team-duel-gameplay-audio-2026-10-16/duel-corrected-actions.json.gz)
and the [native result image](verification/team-duel-gameplay-audio-2026-10-16/duel-corrected-result.jpg)
retain successful and unsuccessful actions. The complete actual-host cohort
passes all seven cases, without skips; its [retained result](verification/team-duel-gameplay-audio-2026-10-16/actual-host-final-seven.tap.gz)
also covers capture, victory, cancellation and the legacy admission guard. The
native run completes the WAV failure/recovery subtask. Ready OGG/MP3 gameplay,
acoustic listening and production/public/frozen acceptance remain separate.

## Earlier MP3 attempt: cold victory with unsuccessful replays

A further bounded attempt uses the same corrected candidate `6e74a45`, genuine
revision-107 compiler output and normal Team Originals `twin-landings` route.
Standard, full teamwork, FPV actors and sound are selected; automatic Next and
Retry remain off. Ordinary keyboard steering reaches a real **71.1% victory in
0:22**, with two reserves. This is a gameplay result, not a balance or pressure
qualification.

The [cold receipt](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-cold.json.gz)
retains delivery `2813`, containing `support.recharged`, `cells.claimed`,
`cut.closed` and `run.completed` with status `won`. Its only recorded buffer-source
start is bank pickup `2814`, buffer `17`. The observer does not wrap oscillator
starts, so this does not establish silence or the absence of a procedural
victory phrase. The custom MP3 buffer `2830`'s decoded-and-hashed identity is
recorded 151 ms after that delivery: **32,600 original bytes**, SHA-256
`cdee5b2980749d03f6c622c4438bbf068f7f24f2d7f4214835152929834ae891`,
48 kHz, mono, 97,802 frames / 2.0375417 seconds. That interval includes hashing;
it is not isolated native decoder latency.

Ordinary Restart initially leaves the terminal screen unchanged under several
pointer actions; keyboard Enter on the visible control starts the next attempt.
Three later route attempts encounter the roaming enemy. The
[intermediate](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-attempts.json.gz)
and [final paused receipt](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-final.json.gz)
contain no second victory and zero starts from custom buffer `2830`. They cannot
qualify ready MP3 playback or diagnose ready-victory suppression. All cumulative
event, start and identity prefixes match. The final receipt retains **30
deliveries, 145 buffer starts and 68 decoded-and-hashed identities**. Its owner
is paused with both pause flags true and a suspended context, not disposed or
closed. The bounded hash queue drops **12 hashes** during the native bank burst;
event/start/decode record drops and observer errors remain zero. The directly
retained MP3 identity is unaffected, but this is not a complete hashed bank
inventory. [Input attempts](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-actions.json.gz)
and a [paused image](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-attempts.jpg)
preserve the unsuccessful routes and focus attempts.

For this audio-only attempt, exact regular Git members of the same candidate
were materialized into a temporary development site. The
[lossless member binding](verification/team-duel-gameplay-audio-2026-10-16/mp3-materialized-binding.json.gz)
and [postflight verification](verification/team-duel-gameplay-audio-2026-10-16/mp3-materialized-postflight.json)
verify the unchanged file set, byte lengths, SHA-256 and Git blob SHA-1 of all
**2,179 members / 214,677,185 bytes**. This selected preview is not a complete
site, release, production admission or performance transport. Its
[HTTP log](verification/team-duel-gameplay-audio-2026-10-16/mp3-materialized-http.log.gz)
has 716 requests; the only non-200 response is an unrelated `/favicon.ico` 404.
Served-member identity alone does not prove browser consumption. The owned tab
and server were closed/stopped afterward and browser visibility returned to
false; no native context-closure receipt is inferred.

That checkpoint leaves ready MP3 victory and actual OGG pickup gameplay open.
The later observations below complete those targeted event cases; acoustic
listening remains separate. The earlier unsuccessful attempts stay retained.

## Native MP3: deliberate Restart and a ready victory

A fresh same-candidate page initially remembers the next Shared returns mission.
Its Stepping exchange picture is absent from this selected development preview;
four ordinary preparation attempts return 404. These failures are retained in
the [HTTP log](verification/team-duel-gameplay-audio-2026-10-16/mp3-gentle-http.log.gz)
and [postflight](verification/team-duel-gameplay-audio-2026-10-16/mp3-gentle-postflight.json),
not attributed to the complete game. Normal Settings selects Gentle and mission
discovery returns to Twin landings, whose picture is present. All 2,179 preview
members retain their exact bytes. No missing-artwork guard is bypassed.

The route now preserves its real idle intervals rather than combining idle with
outward steering, which changes the craft's position. The existing legal route
guides ordinary keyboard commands; elapsed time and native enemy phases remain
real. The first run reaches **74.2% / 0:20 / four reserves**. The
[cold receipt](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-gentle-cold.json.gz)
contains victory delivery `4881`; the selected MP3's native buffer is now `4898`,
with the same original identity and native format above. It starts zero times
through 13.394 seconds after the decoded-and-hashed identity record.

After ordinary Restart, a second run reaches **73.8% / 0:20 / four reserves**.
The [ready receipt](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-gentle-ready.json.gz)
joins actual victory delivery `7421` to voice `victory`, board `solo`, source
`7423` and exact custom buffer `4898`, with no fallback-bank identity. A separately
owned support pickup remains in that batch. Exactly one custom MP3 source starts;
the [29.882-second follow-up](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-gentle-followup.json.gz)
adds no event or buffer start. There are two genuine victories and no downings.
Prefixes match; the final receipt has **11 deliveries, 64 starts and 61
decoded-and-hashed identities**. It explicitly retains **19 dropped hashes**;
other record drops and observer errors are zero. This proves the targeted ready
MP3 victory owner, without a complete bank or acoustic claim.

[Input attempts](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-gentle-actions.json.gz)
and the [second native victory image](verification/team-duel-gameplay-audio-2026-10-16/team-mp3-gentle-result.jpg)
accompany the independent read-only source/buffer/prefix audit.

## Native OGG: actual timed collection and a ready pickup

The recognized historical `team-timed-originals` route selects Window exchange,
Gentle, full teamwork, FPV actors and sound, with automatic Next/Retry off.
Only after the MP3 phases, the development preview adds **13 exact same-candidate
picture originals**. Its [member binding](verification/team-duel-gameplay-audio-2026-10-16/ogg-materialized-binding.json.gz)
and [postflight](verification/team-duel-gameplay-audio-2026-10-16/ogg-materialized-postflight.json)
verify all **2,192 regular members / 249,837,752 bytes**, including every earlier
member, by length, SHA-256 and Git blob SHA-1. The
[693-request log](verification/team-duel-gameplay-audio-2026-10-16/ogg-materialized-http.log.gz)
has only 200/304 responses. No compiled output, gameplay code or approval changes.
This remains a selected development preview, not a production or offline claim.

Ordinary steering, screenshots and explicit pause/resume guide the craft onto the
solid enemies-slow symbol. The [cold receipt](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-cold.json.gz)
records actual `powerup.collected` delivery `1733`, native bank `pickup-2` source
`1734`. The selected custom OGG buffer `1736`'s decoded-and-hashed identity is
recorded 14.8 ms later: **6,941 bytes**, SHA-256
`c977fe249ff42d1c93a552b33abc13a8399df3879fa510475426e5c4bbac1da9`,
48 kHz, stereo, 7,759 frames / 0.1616458333 seconds. No custom start occurs
through the cold checkpoint, 16.530 seconds after that identity record. A later
self-cross downs Player 1 and produces a warning, not terminal failure.

After ordinary Restart, native route timing differs from the reference model;
the visible safe ledge and solid symbol guide fresh keyboard directions. The
[ready receipt](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-ready.json.gz)
joins the second actual `powerup.collected`, delivery `3378`, to custom `pickup`,
board `solo`, source `3379`, exact buffer `1736` and an empty fallback-bank list.
This is the only custom OGG start. `support.recharged` is not counted as collection.

The ready snapshot has `gameplayPaused: true` while its general pause/context
snapshot is still false/running. The later explicit observer refresh while the
game remains visibly paused records both pause flags true and a suspended
context. This [25.400-second follow-up](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-followup.json.gz)
adds no event or start: **20 deliveries, 101 starts and 35 decoded-and-hashed
identities**. All prefixes match; **45 dropped hashes** remain explicit, with
other record drops/errors zero. No instantaneous context-suspension inference
is made from the earlier snapshot.

[Input attempts](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-actions.json.gz),
the [cold approach](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-cold-approach.jpg),
[cold correction](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-cold-near.jpg),
[warm safe ledge](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-warm-start.jpg),
[warm approach](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-warm-near.jpg)
and [paused collection image](verification/team-duel-gameplay-audio-2026-10-16/team-ogg-result.jpg)
retain the actual route adjustments. Independent review confirms the joins,
unique start and unchanged follow-up. This closes the shared Team OGG collection
sample, not native OGG for each seat or every codec/cue combination.

## Observation boundaries

The raw native JSON reports and input-attempt receipts are retained as lossless
gzip files. [Original-byte pins](verification/team-duel-gameplay-audio-2026-10-16/raw-observation-pins.json)
record each original name, byte count and SHA-256; all 25 round-trip to the exact
captured bytes. Compression changes no observation or source-admission claim.

The development hook installs in the game's own realm before the ordinary host
import. Wrappers preserve receivers, arguments, original return promises and
errors. It observes actual host deliveries, native decoder bytes and successful
buffer starts; it never drives inputs, gameplay, clocks or audio preparation.
Records, source identities, byte hashing and publication are bounded. Same-origin
source checks protect the outer observer. Nine adapter regressions and all 61
combined observer/routing cases pass, without skips.

The earlier WAV runs have zero dropped records, hashes or observer errors. The
later MP3/OGG phases explicitly retain their 12/19/45 dropped bank hashes above;
their event, start and decode records and observer errors have no drops. The
selected custom originals all have exact native identity receipts. The temporary
tabs and all owned helper attempts were closed/stopped; visibility returned to false.
There is no native context-closure receipt; source lifecycle tests retain that
separate coverage. No acoustic clarity, mono/headphone, all-codec gameplay,
controller, sustained-pressure, public installation or frozen-release acceptance
is claimed here.
