# Actor reaction recording edition

The authoring manifest `game/hunt/actor-voice-manifest.mjs` contains 48 generation
jobs: two stable line IDs for each of twelve families, each in EN and UK. Each job
pins the exact transcript, locale, filename, local draft voice and performance
direction. The generated plan adds a SHA-256 of each transcript. These are
**generation inputs, not recordings**. No audio was generated for this change.

Prepare an edition without invoking speech or a network provider:

```sh
node scripts/generate-actor-reaction-voices.mjs --output /tmp/actor-voices-review
```

Inspect `generation-plan.json`, then explicitly generate real local preview audio
with installed macOS voices in the same directory:

```sh
node scripts/generate-actor-reaction-voices.mjs --output /tmp/actor-voices-review --synthesize
```

Use `--locale en` or `--locale uk` to prepare/generate one locale. Keep an edition's
locale selection and scripts unchanged; use a new output directory for changed
scripts or another take. Existing generated files and different script editions
are never overwritten. Generation is outside gameplay. A missing system voice or
failed encoder is an error; the adapter does not substitute synthetic metadata.

`generateActorReactionVoices({outputDirectory, locale, generate, synthesize})`
accepts a replacement provider. It receives `{job, output, scratch}` and must write
actual mono/stereo PCM WAV or AAC-LC M4A media and return its real provider/voice
provenance. Text cannot be silently rewritten. Every resulting container is
inspected, bounded to 15 seconds/2 MiB and hashed. Draft takes retain
`listening-review-required` status; scripts, pronunciation, emotional delivery,
volume and interruption still need listening review.

Generated `humanoid-reactions-en-v1.json` and `humanoid-reactions-uk-v1.json` use the
existing `ReactionVoiceBundleV1` format, bounded to 32 MiB each. In Capture Studio,
open **Character voice recordings → Import voice bundle**. Each take imports as
an original for its stable line and locale. Existing differing originals are
retained by the library's merge validation. Human replacements use the same exact
transcript, retain up to eight revisions, and **Restore original** returns to the
imported generated take. Export preserves originals and replacements. Until an
actual take is installed, the game continues to use captions.

The generated output is a local authoring edition. It is not automatically added
to public optional packages or release media; publishing requires the existing
media admission, ownership and release qualification workflow.
