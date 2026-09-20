# Legacy chapter captions and briefing — scoped native check

Exact source `734318d645c4f5eb7108a5303111834c8cb2a949`, with no overrides.
Local source preview on `localhost:18805`, fresh profile, 2026-09-20.
All 368 successful HTTP responses / 367 distinct paths were compared against
that Git source by length and SHA-256. Compressed raw request records, source
preview helper and observed outcomes are retained. No release files were changed.

The current execution register reports a stale Legacy Missions description after
changing chapter but supplies no narrow reproduction. The ordinary fresh-profile
chapter-card path **did not reproduce it**:

- Base game: First Signal selected.
- Right/Enter: Pressure Lines prepared Orchard Crossing; card, selected briefing
  title and Deploy caption agreed.
- Right/Enter: Frontier Lines prepared Copper Switchyard. Briefing described the
  alternating barriers, 80% requirement and 180-second deadline; card, briefing
  and Deploy caption agreed.
- Escape: Home focused Missions and displayed “Start · Copper Switchyard.”
- Reopened Missions. Ten native Tabs from the Frontier chapter card reached the
  Mission brief disclosure. Enter expanded the correct text. Tab/Enter activated
  Read mission brief and focused the reading region. Escape ended reading,
  returned focus to `mission-brief-read` and left Missions open. A second Escape
  returned Home with Missions focused and the same correct Start caption.

Preparation showed the existing selected name while Deploy was disabled; the new
name was present once preparation settled. No flight was launched. No error-level
browser console messages were recorded during this scoped session.

This is not a claim that every stale-description path is fixed. Existing saved
profiles, saved-flight restore, Library selection and recovery are separate paths
that this check does not qualify. No speculative production patch was made.
Physical controllers, touch, offline use, public Pages, wins and challenge quality
remain outside this evidence. The native source preview is not the production
build, and its results do not replace final release gates.
