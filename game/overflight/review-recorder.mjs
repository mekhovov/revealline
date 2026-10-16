/** Tap the existing post-master mix without replacing its audible destination.
 * Only this capture branch is owned here; never suspend/close the game context.
 * HTMLMediaElement playlists are absent unless already routed through this bus.
 */
export function createOverflightReviewAudioTap(sound) {
  const context = sound?.context;
  const output = sound?.compressor ?? sound?.master;
  if (
    !context ||
    context.state === 'closed' ||
    !context.createMediaStreamDestination ||
    !output?.connect ||
    !output?.disconnect
  )
    return null;
  let destination = null;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (destination) {
      try {
        output.disconnect(destination);
      } catch {
        /* The sound owner may have already disposed its graph. */
      }
      for (const track of destination.stream?.getTracks() ?? []) track.stop();
    }
  };
  try {
    destination = context.createMediaStreamDestination();
    output.connect(destination);
    return { tracks: destination.stream.getAudioTracks(), dispose };
  } catch {
    dispose();
    return null;
  }
}

/** Bounded battlefield capture, optionally including an injected game-mix tap.
 * No DOM/HUD, microphone, user-media request or independent sound owner.
 * getAudio returns a newly owned { tracks, dispose } tap or null for silent video.
 */
export function createOverflightReviewRecorder({
  window,
  onState = () => {},
  getAudio = () => null,
}) {
  const maximumBytes = 16 * 1024 * 1024;
  let active = null,
    url = null,
    disposed = false,
    state = { phase: 'idle' };
  const publish = (next) => {
    state = next;
    if (!disposed) onState({ ...state });
  };
  const releaseURL = () => {
    if (url) window.URL.revokeObjectURL(url);
    url = null;
  };
  const release = (record) => {
    if (record.released) return;
    record.released = true;
    window.clearTimeout(record.timer);
    for (const track of new Set([...record.stream.getTracks(), ...record.audioClones]))
      track.stop();
    record.audioTap?.dispose();
  };
  const cancel = () => {
    const record = active;
    active = null;
    if (record) {
      record.recorder.ondataavailable = null;
      record.recorder.onstop = null;
      record.recorder.onerror = null;
      try {
        if (record.recorder.state !== 'inactive') record.recorder.stop();
      } catch {
        // Tracks and retained chunks are released even after recorder failure.
      }
      release(record);
      record.chunks = [];
    }
    releaseURL();
    publish({ phase: 'idle' });
  };
  const finish = (record, failure = null) => {
    if (active !== record) return;
    active = null;
    release(record);
    record.recorder.ondataavailable = null;
    record.recorder.onstop = null;
    record.recorder.onerror = null;
    if (failure || record.tooLarge || !record.bytes) {
      record.chunks = [];
      publish({ phase: failure ?? (record.tooLarge ? 'tooLarge' : 'failed') });
      return;
    }
    const blob = new window.Blob(record.chunks, {
      type: record.recorder.mimeType || record.chunks[0]?.type || 'video/webm',
    });
    record.chunks = [];
    url = window.URL.createObjectURL(blob);
    publish({
      phase: 'ready',
      url,
      mimeType: blob.type,
      bytes: blob.size,
      audio: record.audioClones.length > 0,
    });
  };
  const stop = () => {
    const record = active;
    if (!record || record.stopping) return;
    record.stopping = true;
    window.clearTimeout(record.timer);
    try {
      record.recorder.stop();
      release(record);
    } catch {
      finish(record, 'failed');
    }
  };
  return {
    supported: (canvas) => !!window.MediaRecorder && typeof canvas?.captureStream === 'function',
    snapshot: () => ({ ...state }),
    record(canvas) {
      if (disposed || active) return false;
      cancel();
      if (!window.MediaRecorder || typeof canvas?.captureStream !== 'function') {
        publish({ phase: 'unsupported' });
        return false;
      }
      let stream = null,
        audioTap = null;
      const audioClones = [];
      try {
        stream = canvas.captureStream(30);
        audioTap = getAudio();
        for (const track of audioTap?.tracks ?? []) {
          const clone = track.clone();
          audioClones.push(clone);
          stream.addTrack(clone);
        }
        const formats = audioClones.length
          ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
          : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'];
        const mimeType = formats.find((type) => window.MediaRecorder.isTypeSupported(type));
        const recorder = new window.MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: 2000000,
        });
        const record = {
          recorder,
          stream,
          audioTap,
          audioClones,
          released: false,
          chunks: [],
          bytes: 0,
          timer: null,
          tooLarge: false,
          stopping: false,
        };
        active = record;
        recorder.ondataavailable = ({ data }) => {
          if (active !== record || !data?.size || record.tooLarge) return;
          if (record.bytes + data.size > maximumBytes) {
            record.tooLarge = true;
            record.chunks = [];
            stop();
          } else {
            record.chunks.push(data);
            record.bytes += data.size;
          }
        };
        recorder.onstop = () => finish(record);
        recorder.onerror = () => finish(record, 'failed');
        recorder.start(250);
        record.timer = window.setTimeout(stop, 20000);
        publish({ phase: 'recording', audio: audioClones.length > 0 });
        return true;
      } catch {
        if (active) cancel();
        else {
          for (const track of new Set([...(stream?.getTracks() ?? []), ...audioClones]))
            track.stop();
          audioTap?.dispose();
        }
        publish({ phase: 'failed' });
        return false;
      }
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
