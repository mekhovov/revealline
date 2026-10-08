/** Optional, silent battlefield-only capture. No DOM/HUD or microphone capture. */
export function createOverflightReviewRecorder({ window, onState = () => {} }) {
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
    window.clearTimeout(record.timer);
    for (const track of record.stream.getTracks()) track.stop();
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
    publish({ phase: 'ready', url, mimeType: blob.type, bytes: blob.size });
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
      let stream = null;
      try {
        stream = canvas.captureStream(30);
        const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(
          (type) => window.MediaRecorder.isTypeSupported(type),
        );
        const recorder = new window.MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: 2000000,
        });
        const record = {
          recorder,
          stream,
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
        publish({ phase: 'recording' });
        return true;
      } catch {
        if (active) cancel();
        else for (const track of stream?.getTracks() ?? []) track.stop();
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
