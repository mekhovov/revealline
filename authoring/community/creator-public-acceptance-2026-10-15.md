# Public creator acceptance and cold intake — 15 October 2026

## Source and delivery identity

Continued from reviewed main `d452bda9e22acf705751f11584cdcd5b0a0d4640` on
`codex/creator-team-continuation-20261015`, preserving the shared checkout. The public
`main-deployment.json` initially reported `b5b114c815506a60c8f91d0e0220abd6611a6425`, an ancestor
of current main that contains PRs #1491, #1498 and #1505. During acceptance it advanced to
`4ed8d0557fe54f2c541cf0cd03de8e69e3222a76`. These are rolling main deployments, not new
immutable release archives.

Public templates, Studio, media review and Team media module bodies matched the initial deployed
source byte-for-byte. A raw comparison of media intake differed because the normal build explicitly
projects that allowlisted module's whitespace. Applying the repository's existing projection to
the deployed source matched its public **18,619 bytes**, SHA-256
`ca2f6ff00c82dfc666618f1431a224b7be6e9ad51455743a29cb2ad8cc336336`.
The two observed deployment revisions have identical creator sources and projection code.

## Reproduced cold-start defect and correction

On the public creator's first render, the file picker was usable before Studio initialized
multi-file intake. Selecting twelve files at that point was refused by the native chooser as a
single-file input. After initialization, repeating the chooser worked. The initial source HTML
also allowed edits to fields before their input listeners and defaults were ready.

The source HTML now starts media input, pack import, the video example and editable preparation
fields disabled. The existing Studio busy owner enables them when initialization finishes.
The media input declares its multiple-file shape in the initial markup. This adds no parallel
startup owner or gameplay/storage changes.

In the corrected local browser, the first accessibility state reported disabled intake, example,
name/title/description and fitting controls. After normal initialization, the same input and name
field enabled; the chooser accepted two files, both levels generated, and the entered collection
name remained `Cold intake recovery acceptance`. The first-frame interaction check is separate
from successful warm-load creation.

## Public twelve-image campaign

Used the ordinary built-in browser at `https://mekhovov.github.io/revealline/game/creator/`,
normal existing access, and owned synthetic images. Media processing stayed local. No creator
account, hosted submission or server upload was involved.

- Selected twelve PNGs after intake initialized; generated all twelve with enemies and walls.
- Review and actual downloaded manifest contain all six families and both bounded variants.
- Approved and downloaded **1,752,512 bytes**, SHA-256
  `4bd0478f6c99762bac9a04347c6853d78c927bcf24374afe4736d47c3206b34e`.
- Installed edition `38fd008a953fcdd14acb4b3d0832b045a8e2472e07e02fa808df3c7ae73f4b6c`.
- Started through the ordinary public player and completed picture01 on Standard: 50%, three
  lives, 11,250 points. The exact poster remained in the earned result.
- Continue offered Next for picture02. Next opened that mission; Pause and reload restored a
  visible Continue action for the same edition and second mission, without awarding its picture.

## Public video intake

Selected the owned six-second 640×360 H.264/AAC MP4 through the deployed creator. Native inspection
prepared 0.6-, 3- and 5.4-second candidate posters. Changed the poster to 1.2 seconds and playback
range to 0.5–4 seconds, then applied the choices. The rebuilt review retained all choices and the
same First crossing layout, one enemy, two walls and verified routes. The package review explicitly
retained the complete six-second video; this is playback-range selection, not physical trimming.

Approved, downloaded and installed edition
`76bdd6e85293e5bb469354e7b856dc4c3e4365489990fe825868cbbb0c2eea55`.
The downloaded pack is **247,993 bytes**, SHA-256
`dff85edf7d23426686bf77b65018e02e1ef8bb9bb61b6167b9dffd64b6b27794`.
Its manifest retains requested/observed/playhead poster time 1.2 seconds, that exact PNG hash,
the 0.5–4-second playback range and the complete 172,550-byte runtime video.

Completed the installed mission on Standard: 50%, three lives, 11,620 points. The victory story
ended with the poster unchanged. Replay was observed playing at 0.632 seconds, then paused at
4.013 seconds with a six-second duration and no native decode error. A second Replay followed
by immediate Skip returned to the same poster; Continue stayed available. No physical listening
or autoplay-refusal qualification is claimed.

## Automated checks and limits

The existing media-review, batch UI, Team creator host and template cohort passed **34 tests**,
zero failures/skips. HTML formatting, diff checks and full `npm run validate` passed
(exit zero), including the industrial-environment byte checks. The startup correction is verified locally and awaits its own PR
and deployment; the public journeys above exercise the prior merged creator fixes.

Keep Team ordinary victory/reward/Next, real quota failures, peak browser memory, clean physical
profiles, named desktop-browser versions, physical audio and broad human balance review open.
Live community publication still needs a backend, mail/operator configuration and restore target;
GitHub Pages remains the static host. Desktop-first scope does not qualify mobile hardware.
