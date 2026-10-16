# Campaign result feedback

Level/Campaign Studio and Company Studio share **Campaign result feedback** in
the discovery controls. Authors can enable one to four short result lines in
English and Ukrainian, choose a registered victory motif, preview the selected
language, audition or stop the cue, and explicitly apply the recipe. Disabling
the recipe restores the existing generic reaction and sound. Preview never
records a player win, changes progression, or writes audio preferences.

The optional `campaign.discovery.feedback` contains
`format: "revealline-campaign-feedback.v1"`, an immutable content-derived
`revision`, matching `lines.en` and `lines.uk` arrays, and `victoryMotif`.
Each line is limited to 240 characters. The registered original synth phrases
are `bright-return-v1`, `open-horizon-v1` and `shared-spark-v1`. Authors cannot
supply scripts, URLs, gain, duration, timing, simulation rules or scoring fields.
All source packets, compiler projections and retained presentation snapshots use
the existing selected campaign dependency and revision boundaries. Company
Studio updates exact localization pins and edition revisions with an applied
source edit. Published content still requires its normal retained revision and
release review.

The accepted Solo, Versus and Team campaign host supplies the current exact
recipe. Result lines use a stable mission-based variant and respond to the
selected language and existing optional-reaction preference. They remain plain
text and never move focus. Winning core events select the synth motif through
Soundscape; they do not add another result event or playback store. Losses and
unowned runs retain the fallback. Existing published audio cues, master mute,
effects volume, playback activation and duplicate-event suppression retain their
precedence. With no authored recipe, existing presentation remains unchanged.

This is presentation metadata. Editing it preserves gameplay levels and the
accepted gameplay binding identities, while the published presentation revision
changes. It does not certify knowledge or skill and cannot award mastery, rewards
or currency. Recorded audio, persistent soundtrack-playlist rewards and animated
character result reactions remain separate features.
