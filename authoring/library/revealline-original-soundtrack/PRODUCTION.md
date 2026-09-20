# Production, pilots and acceptance

**State: planned. No hosted generation was performed, no musician was contacted, and no new recording was created.** The local production tools researched here are options, not installed software. No model download is required to finish the software and the production handoff.

## Pilot sequence

1. Produce **Glass Highway** (`soundtrack-glass-highway`) to establish a rich 90s synth palette: FM, tracker-inspired sampling and analog voices have distinct jobs. Deliver one complete 3–4 minute composition with developed themes.
2. Produce **Furnace Heart** (`soundtrack-furnace-heart`) to establish playable heavy guitars, clear bass, convincing drums and contrast. Exposed guitar phrasing must survive solo listening; a distorted oscillator mockup is not automatically approved metal production.
3. Produce **Spring Circuit** (`soundtrack-spring-circuit`) to establish Ukrainian articulation and an original memorable hook. Use actual identified instruments or explicitly labeled approximation while working; cultural review is still required.
4. Validate the crossover direction with **Steel Kolomyika** before producing all six fusion cues. Assess whether the Ukrainian phrasing remains audible and the metal part develops it musically.

Retain two or more genuinely different pilot takes where the chosen tool permits it; select by full listening, not filename or generation score. Do not mass-produce 36 near-identical loops after a merely functional decode test. Approved pilot palettes guide the other compositions; their themes, harmonic movement and form remain distinct.

## Hosted AI path

Use an available, user-authorized music service only through its supported UI/API. Before relying on an output, preserve the exact service/model/version, generation timestamp, account plan at generation, effective prompt, any seed and edit/remix history, output hash and the applicable terms/rights receipt. Free generation or a playable preview is not a publication license; verify the actual plan permits game distribution and soundtrack export. Do not bypass login, paywalls, download restrictions or service limits. Do not purchase a subscription implicitly.

Use the full prompt from production.json, plus the delivery/mix requirements there. Prompt for musical properties and our original motif rather than an artist soundalike or a replacement for a named track. No reference recording is uploaded without rights to that input. Retain an unmodified provider output separately from the edited production master; log all arrangement, instrument-replacement and mastering steps. A lossy provider output re-encoded to WAV is not a new lossless source; disclose that provenance and obtain production approval accordingly.

If the service cannot provide an authorized export, preserve the attempt as incomplete and use the offline path for parts that can be completed. Do not fabricate an MP3 or mark its review passed. Original-production approval requires listening, rights and cultural checks even if generation succeeds.

## Offline and original-performance path

[Waveform Free](https://www.tracktion.com/products/waveform-free) supplies MIDI, recording and mixing; [Decent Sampler](https://www.decentsamples.com/product/decent-sampler-plugin/) and [sfizz](https://sfz.tools/sfizz/) supply sample playback. [VSCO 2 CE](https://versilian-studios.com/vsco-community/), [VCSL](https://github.com/sgossner/VCSL) and the [Karoryfer free catalog](https://shop.karoryfer.com/pages/free-samples) provide usable CC0 supporting instruments; Karoryfer explicitly excepts Marie Ork. Check individual retained packages and save the source/license record. No free authentic bandura or sopilka multisample library was verified during this research.

Write original MIDI/notation and assemble the acoustic/electronic support parts offline. For exposed Ukrainian instruments, use owned recordings, a documented authorized volunteer/session performance, or an explicitly approved licensed library. A volunteer is a possible no-cost route, not a resource already secured. [Precisionsound Ukrainian Bandura](https://store.precisionsound.net/shop/ukrainian-bandura/) is a verified paid alternative and is not part of the free-tool promise. A general harp, hammered dulcimer or recorder is not relabeled as bandura, tsymbaly or sopilka.

For performers prepare the original score, BPM/meter, count-in, full backing demo and written use permission covering the game and exported soundtrack. For newly recorded sessions request dry 48 kHz/24-bit takes; retain provider outputs at their actual native resolution, with no forced conversion, natural ornaments/breaths, alternate phrasing and clearly identified instruments. Prefer complete expressive musical phrases to a tiny single-note bank. Archive the original takes privately if redistribution is not authorized; ship the completed music only. Do not contact performers without a separate user instruction to send messages.

## Review record and publishing gate

Every cue requires all eight ledger gates: composition, originality, fullListening, technical, inGameMix, transitions, culturalAccuracy and publicationRights. A named reviewer and timestamp must identify the exact master/MP3 hashes. A non-Ukrainian cue can pass culturalAccuracy with a documented review that it makes no unsupported cultural claim; it cannot omit the gate.

Listen to the whole song twice in sequence and within a mixed-style queue. Check distinctive A/B themes, recognizable hook after one listening, meaningful contrast, absence of obvious copied phrases, convincing instrument articulation and fatigue over a 20-minute gameplay session. Check mono, headphones and small speakers. Listen to alerts/capture/loss cues against the densest passage at normal music/effects settings. Test endings across keys/styles, next-track continuity and repeat-all wrap; a filename containing “loop” is insufficient.

Measure full decoding, integrated loudness, true peak and duration separately from listening. Chosen targets: 120–180 seconds for menus and 180–300 seconds for gameplay/finales, -17 to -15 LUFS integrated (aim -16), true peak no higher than -1 dBTP. Preserve the native-resolution stereo production master (44.1/48 kHz, PCM16/24/32 or float32) and encode runtime MP3 at 256 kb/s. Never upsample a lower-resolution source to imply higher fidelity. These are project mix choices, not claims of standards certification. Keep source and derived hashes, encoder version, and render settings. MP3 frame duration and PCM/master duration may differ by encoder padding; compiler tolerance is 150 ms.

`ready.json` accepts only entries with the following structure (all placeholder values must be replaced by actual evidence; this example is not ready metadata):

```json
{
  "id": "original.glass-highway",
  "artist": "Actual credited composer and performers",
  "master": { "path": "masters/glass-highway.wav", "bytes": 1, "sha256": "actual SHA-256" },
  "mp3": { "path": "runtime/glass-highway.mp3", "bytes": 1, "sha256": "actual SHA-256" },
  "rights": {
    "kind": "original",
    "credit": "Actual credits",
    "license": "Documented permission for game and soundtrack publication",
    "source": "https://publisher.example/provenance/glass-highway"
  },
  "review": { "path": "reviews/glass-highway.json", "bytes": 1, "sha256": "actual SHA-256" }
}
```

The pinned review JSON uses format `revealline-original-approval.v1`, matching `id`, `reviewer`, ISO `reviewedAt`, `masterSha256`, `mp3Sha256`, `gates` (all eight exact gate names mapped to `true`), `measurements: {durationSeconds, integratedLUFS, truePeakDbTP, fullDecode:true, method}`, and `production: {method, tool, version, promptId, rightsEvidence, sessionEvidence}`. `rightsEvidence` and `sessionEvidence` are bounded local file pins. The session evidence preserves the effective prompt, tool/account/generation facts, source lineage and edit history. Compiler acceptance checks the evidence’s presence and identity, not whether human judgment is correct.

Promotion sequence: retain actual source/master/MP3 → record completed review and pin its evidence → add ready entry → compile to a fresh cache directory → inspect the exact result → update the committed runtime catalogue with generated metadata → stage only approved MP3s as optional assets → verify real browser decoding, playback and transition behavior. Planned briefs and production samples remain outside game payloads.
