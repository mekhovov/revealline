# Original coded-silence MP3 fixture

`silence-mpeg1-layer3.mp3` is a synthetic test original, not a supplied song, music-production deliverable, or licensed third-party recording. It contains ten MPEG1 Layer III mono frames at 128 kbps and 44,100 Hz. Each frame has the header `ff fb 90 c4` followed by 413 zero bytes. The resulting 4,170 original bytes are preserved without image/audio editing or transcoding in the shipped fixture.

SHA-256: `54a1cbf7f98d7b263dae389576f50dc8507e3b3b40aec9c5793dc4480b14d913`.

Reproduction (writes a new file only when explicitly run):

```python
from pathlib import Path
Path("silence-mpeg1-layer3.mp3").write_bytes(
    (bytes.fromhex("fffb90c4") + bytes(413)) * 10
)
```

On this macOS workspace, `/usr/bin/afconvert -f WAVE -d LEI16` decoded the original successfully to 11,520 mono PCM samples at 44,100 Hz: 23,040 sample bytes, all zero, duration 0.2612244897959184 seconds. The separate decoded WAV SHA-256 was `409b898a5ee344d60f1f2b1ad1f4a14429cc162c139fbb286bb21b5f9b671b57`; it remains a cache-only diagnostic, not a required runtime asset. This confirms that this fixture decodes in CoreAudio. It does not establish browser decoding, audible music quality, physical device behavior, or support for every structurally valid frame payload.

Automated tests use the original bytes, public SHA-256/frame validation, and explicitly injected media-element/transaction models. Additional constructed MPEG2/2.5 and ID3 cases are parser cases; they are not independently decoded recordings. MPEG framing facts were checked against [LAME's decoder implementation](https://github.com/lameproject/lame/blob/master/mpglib/common.c) and [RFC 3119](https://www.rfc-editor.org/rfc/rfc3119). No decoder source is vendored here.
