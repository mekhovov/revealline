# Creator follow-up acceptance — 15 October 2026

## Baseline and delivered correction

Rebased the clean media worktree onto current reviewed main
`859d5cfc927daff2a350318b2325486a58959648` without conflicts. The shared Team/Duel checkout was
not changed. Continued on `codex/creator-remaining-acceptance-20261015`.

Before opening the PR, fetched main again and rebased without conflicts onto `e5e5562ff`.
The intervening changes do not alter the creator modules, changed tests or dependency lockfile.

Real large-video testing found that applying a different poster time reset it to the midpoint.
Repeated mobile preparation can change the MP4 output hash. Review choices were keyed to that
output hash, so custom frame time, image pairing and playback range could be lost. It could also
change the generated template when only media choices were edited.

Intake now carries the selected source's SHA-256 separately from the runtime asset's SHA-256.
Review choices and generation selection use the stable source identity. Exported story bindings,
media verification and edition identity continue to use the exact runtime bytes. No installed
edition is rewritten. Older intake results without a separate source hash retain the prior fallback.

## Ordinary desktop browser checks

Used the built-in browser with a temporary 1280×900 viewport. These checks do not qualify named
Safari/Firefox versions or physical audio. The normal access form was used; no credential is retained
in this record.

- **Single image:** selected the owned first-frame PNG, generated First crossing with one enemy
  and two walls, approved, installed and completed Solo on Standard: 50%, three lives, 11,620 points.
  Edition: `9955036518afd1aa0fe013fd7e66a88211bbad0391ca42c730baad3c10366824`.
- **Duel:** the installed campaign link selected that exact Custom mission. Started both boards,
  completed as Sunflower, used Rematch, then completed as Skyline. Each winning board earned
  50%, three lives and 11,620 points. This is one representative mission, not full multiplayer
  continuation or balance acceptance.
- **Studio:** opened the image draft in the advanced editor, renamed its mission through the
  structure controls and saved checkpoint 2. Browser Back/Forward restored the saved rename.
  Return to picture creator → Load saved Studio edits imported it; Generate verified the source
  again and required a new approval. The original installed edition remained separate.
- **Large video:** selected the owned 51,893,544-byte, 30-second, 1920×1080 AVC/AAC fixture.
  Native inspection captured 3-, 15- and 27-second candidates. Changed to a 12-second poster and
  playback from 3 to 20 seconds, cancelled active inspection, and retried. The corrected build
  retained all three choices. The output video identity changed from `c773c6fc3caa…` to
  `03da4aab57a5…`, while Island chain remained one enemy, two walls and two safe islands.
- **Large pack:** downloaded the actual 52,391,815-byte `.rlpack`, SHA-256
  `838dcc4b0b8901abd7c2e1e03eb7d94006edc72d720529913ec3a6310f4af1d4`.
  Its manifest contains requested/observed poster time 12, playback range 3–20, and the complete
  30-second, 51,887,276-byte runtime video. Playback range is not physical trimming.
  Installed edition `b18296ece94f1aa17fe226cf1b99e5b2c9c8f7a5afd55e99782b058b50a68345` completed
  Solo on Standard: 50%, three lives, 11,250 points. The poster remained after the victory story;
  Replay began at the reviewed three-second start and paused at 20.023 seconds with no decoding
  error; the UI reported the story ended and the exact picture was unchanged.

The existing port-8793 origin retained old module code across a soft reload. Final corrected-media
verification used a fresh port-8794 origin served with no-store headers; server observations confirm
fresh requests for all three changed modules. A separate origin is not a separate physical profile.
The fresh origin initially had no installed campaigns. This test did not deliberately exhaust quota
or measure browser peak memory.

## Automated evidence

- Navigation, Studio link contracts and installed Versus/Team hosts: **48 passed**.
- Intake/review/media-campaign cohort: **26 passed**, followed by the expanded campaign file:
  **7 passed**, including the new stable-gameplay regression (six overlap the earlier cohort).
- Video conversion, portable video bundles and victory-story host: **14 passed**.
- Changed JavaScript lint, formatting and diff checks passed.
- Full `npm run validate` passed on the tested baseline with this correction.

The new regressions cover distinct source/runtime identities, changing converted bytes, retained
pairing/frame/range choices after cancellation, stable generated gameplay, and exact runtime story
hashes. They do not replace the real browser checks above.

## Publication and remaining gates

The original fix's Pages run failed at the former 950,000,000-byte guard with a 963,159,483-byte
snapshot. Main independently updated that guard. Run
[38775357641](https://github.com/mekhovov/revealline/actions/runs/38775357641) succeeded, and the
public `main-deployment.json` reported `9b416b2c0e27f40cf5adfa3b93a1477382ecef4f`, which contains
PR #1347. This confirms deployed source identity, not a fresh public-site upload journey.
The new correction in this record still needs its own protected PR/publication checks.

Remaining: current-build Team browser play and multi-mission continuation; named desktop-browser
and physical-audio coverage; 12/50-image browser batches, quota/failure recovery and memory evidence;
playtesting across the six layout families; public upload verification after deployment; and a
backend/mail/operator/recovery environment for the public-store pilot. GitHub Pages remains the
chosen static host. Mobile and AWS-specific testing remain deferred.
