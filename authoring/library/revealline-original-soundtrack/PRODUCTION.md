# Production, pilots and acceptance

**State: local candidates rendered; publication remains blocked on review.** The completed low-storage pass produced seven distinct full candidate compositions: the balanced six-pilot slate below and Steel Kolomyika. There are eight full recording attempts because Idle Frequency has two versions, both rejected in user style review. Two subsequent short direction sketches await direction review and do not count toward the 36 compositions. Zero originals have completed all review gates or been approved; `ready.json` remains empty. No hosted generator was used, no musician was contacted, and no model, sample library or reference recording was downloaded for these candidates.

## Current local-first pilot sequence

1. **90s synth:** **Idle Frequency** (menu) and **Glass Highway** (gameplay). Both full Idle Frequency versions were rejected for insufficient drive and an unsuitable palette. Preserve those files and feedback; compare the two short, newly arranged directions before another full take. The current instruments are locally synthesized FM and subtractive voices, not sampled game recordings.
2. **Metal:** **Embers at Rest** (menu) and **Furnace Heart** (gameplay). The recorded candidates use synthesized string models, bass and percussion. These are not recorded guitars or acoustic drums. Exposed riff articulation and the desired weight require listening approval; a successful render is not automatically convincing metal production.
3. **Ukrainian-inspired:** **First Light** (menu) and **Spring Circuit** (gameplay). Original melodic phrasing uses explicitly labeled plucked-string and wind-like synthesis; no acoustic bandura or sopilka performance is claimed. Cultural review remains required and Ukrainian originals stay central to this balanced slate.
4. **Fusion check:** **Steel Kolomyika**, a complete candidate using an original duple dance pulse with synthesized metal replies. Assess whether the Ukrainian-inspired phrasing remains audible and musically developed before producing the remaining fusion cues.

Retain two or more genuinely different pilot takes where the chosen tool permits it; select by full listening, not filename or generation score. Do not mass-produce 36 near-identical loops after a merely functional decode test. Approved pilot palettes guide the other compositions; their themes, harmonic movement and form remain distinct.

The current reproducible pipeline uses GPT-authored notes and local sample-free DSP with the existing NumPy/SciPy, pyloudnorm, MP3 encoder and CoreAudio tools. It renders sequentially, retains native 48 kHz/24-bit FLAC masters and 256 kb/s MP3s, and checks decoded loudness and an explicitly approximate oversampled true peak. Per-recording receipts preserve seeds, source/score hashes, audio hashes and FLAC PCM round-trip evidence. Keep active production below 650 MiB, temporary scratch below 256 MiB and at least 1 GiB free; do not overwrite rejected or pending audio to meet a storage limit. The candidate and sketch registers describe actual attempts without changing the identity or planned status of the original briefs.

## Later optional hosted AI path

Hosted production is deferred. The current plan does not depend on service access, a subscription or a model installation; the following is retained research for a separately chosen later phase.

Use an available, user-authorized music service only through its supported UI/API. Before relying on an output, preserve the exact service/model/version, generation timestamp, account plan at generation, effective prompt, any seed and edit/remix history, output hash and the applicable terms/rights receipt. Free generation or a playable preview is not a publication license; verify the actual plan permits game distribution and soundtrack export. Do not bypass login, paywalls, download restrictions or service limits. Do not purchase a subscription implicitly.

Use the full prompt from production.json, plus the delivery/mix requirements there. Prompt for musical properties and our original motif rather than an artist soundalike or a replacement for a named track. No reference recording is uploaded without rights to that input. Retain an unmodified provider output separately from the edited production master; log all arrangement, instrument-replacement and mastering steps. A lossy provider output re-encoded to WAV is not a new lossless source; disclose that provenance and obtain production approval accordingly.

If the service cannot provide an authorized export, preserve the attempt as incomplete and use the offline path for parts that can be completed. Do not fabricate an MP3 or mark its review passed. Original-production approval requires listening, rights and cultural checks even if generation succeeds.

## Later optional sample and original-performance path

New instrument libraries and sample-heavy production are deferred to a later storage-budgeted phase. These options are not installed components of the current sample-free renders.

[Waveform Free](https://www.tracktion.com/products/waveform-free) supplies MIDI, recording and mixing; [Decent Sampler](https://www.decentsamples.com/product/decent-sampler-plugin/) and [sfizz](https://sfz.tools/sfizz/) supply sample playback. [VSCO 2 CE](https://versilian-studios.com/vsco-community/), [VCSL](https://github.com/sgossner/VCSL) and the [Karoryfer free catalog](https://shop.karoryfer.com/pages/free-samples) provide usable CC0 supporting instruments; Karoryfer explicitly excepts Marie Ork. Check individual retained packages and save the source/license record. No free authentic bandura or sopilka multisample library was verified during this research.

Write original MIDI/notation and assemble the acoustic/electronic support parts offline. For exposed Ukrainian instruments, use owned recordings, a documented authorized volunteer/session performance, or an explicitly approved licensed library. A volunteer is a possible no-cost route, not a resource already secured. [Precisionsound Ukrainian Bandura](https://store.precisionsound.net/shop/ukrainian-bandura/) is a verified paid alternative and is not part of the free-tool promise. A general harp, hammered dulcimer or recorder is not relabeled as bandura, tsymbaly or sopilka.

For performers prepare the original score, BPM/meter, count-in, full backing demo and written use permission covering the game and exported soundtrack. For newly recorded sessions request dry 48 kHz/24-bit takes; retain provider outputs at their actual native resolution, with no forced conversion, natural ornaments/breaths, alternate phrasing and clearly identified instruments. Prefer complete expressive musical phrases to a tiny single-note bank. Archive the original takes privately if redistribution is not authorized; ship the completed music only. Do not contact performers without a separate user instruction to send messages.

## Review record and publishing gate

Every cue requires all eight ledger gates: composition, originality, fullListening, technical, inGameMix, transitions, culturalAccuracy and publicationRights. A named reviewer and timestamp must identify the exact master/MP3 hashes. A non-Ukrainian cue can pass culturalAccuracy with a documented review that it makes no unsupported cultural claim; it cannot omit the gate.

Listen to the whole song twice in sequence and within a mixed-style queue. Check distinctive A/B themes, recognizable hook after one listening, meaningful contrast, absence of obvious copied phrases, convincing instrument articulation and fatigue over a 20-minute gameplay session. Check mono, headphones and small speakers. Listen to alerts/capture/loss cues against the densest passage at normal music/effects settings. Test endings across keys/styles, next-track continuity and repeat-all wrap; a filename containing “loop” is insufficient.

Measure full decoding, integrated loudness, true peak and duration separately from listening. Chosen targets: 120–180 seconds for menus and 180–300 seconds for gameplay/finales, -17 to -15 LUFS integrated (aim -16), true peak no higher than -1 dBTP. Preserve the native-resolution stereo production master (44.1/48 kHz, PCM16/24/32 or float32) and encode runtime MP3 at 256 kb/s. Never upsample a lower-resolution source to imply higher fidelity. These are project mix choices, not claims of standards certification. Keep source and derived hashes, encoder version, and render settings. MP3 frame duration and PCM/master duration may differ by encoder padding; compiler tolerance is 150 ms.

Current local production: [seven distinct full candidate compositions](local-production/README.md), eight full attempts and two short sketches use GPT-authored notes and local sample-free DSP. Both full Idle Frequency attempts were rejected; the subsequent sketches remain unapproved. No hosted generator, model or instrument library was downloaded. The alternatives above are retained research, not how these candidates were made. Native 24-bit FLAC masters have exact PCM round-trip evidence; they are accepted alongside WAV by the compiler. No recording has completed the full listening, cultural and publication review gates.

`ready.json` accepts only entries with the following structure (all placeholder values must be replaced by actual evidence; this example is not ready metadata). The policy must bind the exact catalogue ID and MP3 hash; permitted values for each capability are `allowed`, `denied` or `unknown`. Web playback must explicitly be `allowed` for promotion. `contentId` is `registered`, `not-registered` or `unknown`. Never turn unknown permissions into allowed defaults:

```json
{
  "id": "original.glass-highway",
  "artist": "Actual credited composer and performers",
  "master": { "path": "masters/glass-highway.flac", "bytes": 1, "sha256": "actual SHA-256" },
  "mp3": { "path": "runtime/glass-highway.mp3", "bytes": 1, "sha256": "actual SHA-256" },
  "rights": {
    "kind": "original",
    "credit": "Actual credits",
    "license": "Documented permission for game and soundtrack publication",
    "source": "https://publisher.example/provenance/glass-highway"
  },
  "review": { "path": "reviews/glass-highway.json", "bytes": 1, "sha256": "actual SHA-256" },
  "policy": {
    "id": "builtin.catalog.original.glass-highway",
    "sha256": "actual MP3 SHA-256",
    "webPlayback": "unknown",
    "offlineCache": "unknown",
    "redistribute": "unknown",
    "modify": "unknown",
    "gameplayVideo": "unknown",
    "contentId": "unknown"
  }
}
```

The pinned review JSON uses format `revealline-original-approval.v1`, matching `id`, `reviewer`, ISO `reviewedAt`, `masterSha256`, `mp3Sha256`, `gates` (all eight exact gate names mapped to `true`), `measurements: {durationSeconds, integratedLUFS, truePeakDbTP, fullDecode:true, method}`, and `production: {method, tool, version, promptId, rightsEvidence, sessionEvidence}`. `rightsEvidence` and `sessionEvidence` are bounded local file pins. The session evidence preserves the effective prompt, tool/account/generation facts, source lineage and edit history. Compiler acceptance checks the evidence’s presence and identity, not whether human judgment is correct.

Promotion sequence: retain actual source/master/MP3 → record completed review and pin its evidence → add ready entry → compile to a fresh cache directory → inspect the exact result → update the committed runtime catalogue with generated metadata → stage only approved MP3s as optional assets → verify real browser decoding, playback and transition behavior. Planned briefs and production samples remain outside game payloads.
