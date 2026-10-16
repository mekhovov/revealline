// Test-only qualification: only shared pad commands edit the actual workshop.
// Read-only source inspection and PNG decoding authenticate exported outcomes.
import { canonicalJSON } from '../../data-json.mjs';
import { prepareStillAsset } from '../../media-still.mjs';
import { openVideoPosterSource } from '../../video-poster.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
async function fingerprint(blob) {
  return {
    bytes: blob.size,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export const videoPosterCurrent = [
  'Current Video Poster: cancel, validate times, capture, export and reopen source',
  '/authoring/video-poster/',
  async (p) => {
    const win = p.doc.defaultView,
      selector = (id) => `#video-poster-${id}`,
      $ = (id) => p.doc.querySelector(selector(id));
    assert(
      win.location.port === '8990' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated local qualification origin on port 8990.',
    );
    await p.wait(() => !$('controls').disabled, 30000);
    assert(
      p.doc.documentElement.lang.startsWith('en'),
      'This bounded capture-evidence parser currently qualifies English.',
    );
    const originalLocal = snapshot(win.localStorage),
      originalSession = snapshot(win.sessionStorage),
      downloadClicks = [];
    const observeDownload = (event) => {
      if (event.target?.closest?.('a') !== $('download')) return;
      const row = { href: $('download').href, name: $('download').download };
      // Observe the completed native DOM dispatch; do not activate or cancel it.
      queueMicrotask(() => downloadClicks.push({ ...row, prevented: event.defaultPrevented }));
    };
    p.doc.addEventListener('click', observeDownload, true);
    const replaceNumber = async (id, text) => {
      await p.choose(selector(id));
      await p.choose('[data-editor-action="all"]');
      await p.choose('[data-editor-action="backspace"]');
      for (const key of text) await p.choose(`[data-editor-action="${key}"]`);
      await p.choose('[data-editor-action="done"]');
    };
    const chooseVideo = async () => {
      await p.choose(selector('file'));
      await p.choose('.authoring-source-dialog button', 'Dawn Signal video');
      await p.wait(() => !$('capture').disabled && $('cancel').disabled, 30000);
      assert(
        p.doc.activeElement.id === 'video-poster-time',
        'Inspection lost requested-time focus',
      );
      return $('file').files[0];
    };
    try {
      await p.choose(selector('file'));
      await p.pulse('back');
      assert(!$('file').files.length && $('capture').disabled, 'Canceled source enabled capture');
      const originalFile = await chooseVideo(),
        sourceReceipt = await fingerprint(originalFile),
        inspected = await openVideoPosterSource(originalFile);
      let sourceInfo;
      try {
        sourceInfo = inspected.info;
        assert(
          sourceInfo.sha256 === sourceReceipt.sha256 && sourceInfo.bytes === sourceReceipt.bytes,
          'Native source inspection differs from the selected video bytes',
        );
      } finally {
        inspected.dispose();
      }
      assert($('metadata').textContent.includes(sourceInfo.sha256), 'Visible source hash is wrong');
      const initialTime = $('time').value,
        initialRange = $('range').value,
        initialTransform = $('transform').value;
      await p.choose(selector('time'));
      await p.choose('[data-editor-action="+1"]');
      await p.pulse('back');
      assert($('time').value === initialTime, 'Canceled numeric draft changed capture time');
      await p.choose(selector('range'));
      await p.pulse('right');
      await p.pulse('back');
      assert(
        $('range').value === initialRange && $('time').value === initialTime,
        'Canceled slider draft changed requested time',
      );
      await p.choose(selector('transform'));
      await p.pulse('down');
      await p.pulse('back');
      assert($('transform').value === initialTransform, 'Canceled output plan changed transform');
      await replaceNumber('time', '');
      const beforeInvalid = p.downloads.length;
      await p.choose(selector('capture'));
      assert(p.doc.activeElement.id === 'video-poster-time', 'Invalid time lost correction focus');
      assert($('download').hidden && $('preview').hidden, 'Empty requested time produced a poster');
      assert(p.downloads.length === beforeInvalid, 'Invalid time allocated an exported image');
      assert($('file').files[0] === originalFile, 'Invalid time replaced the inspected source');
      const priorPlaybackEvidence = $('playback-evidence').textContent,
        originalEnd = $('playback-end').value;
      await replaceNumber('playback-end', '0');
      await p.choose(selector('apply-range'));
      assert(
        $('playback-evidence').textContent === priorPlaybackEvidence &&
          p.doc.activeElement.id === 'video-poster-playback-start',
        'Invalid empty playback range replaced the previous range or lost correction focus',
      );
      await replaceNumber('playback-end', originalEnd);
      await p.choose(selector('apply-range'));
      const requested = Math.min(1, Math.floor(sourceInfo.durationSeconds * 500) / 1000);
      assert(requested > 0, 'Bundled fixture video needs a positive bounded capture time');
      await replaceNumber('time', String(requested));
      assert(Number($('time').value) === requested, 'Requested time did not commit through editor');
      p.record(
        'Canceled source, numeric, slider and output-plan drafts retained values. Empty requested time and playback segment were rejected without a poster or source replacement; corrected values remain an unsaved local preview',
        selector('status'),
        { source: sourceInfo, requested },
      );

      const capture = async () => {
        await p.choose(selector('capture'));
        await p.wait(
          () =>
            p.visible($('download')) &&
            $('cancel').disabled &&
            $('image').complete &&
            $('image').naturalWidth > 0,
          30000,
        );
        assert(
          p.doc.activeElement.id === 'video-poster-download',
          'Capture lost PNG download focus',
        );
        const href = $('download').href,
          observed = p.downloads.find((row) => row.url === href),
          evidence = $('evidence').textContent,
          expectedSeek = evidence.match(/Requested seek: ([\d,.]+) s/),
          presented = evidence.match(
            /Observed frame timestamp: ([\d,.]+) s · playhead: ([\d,.]+) s/,
          ),
          approximate = evidence.match(
            /Frame timestamp unavailable\. Approximate playhead: ([\d,.]+) s/,
          ),
          numeric = (value) => Number(value.replaceAll(',', ''));
        assert(
          observed?.blob.type === 'image/png',
          'Download does not reference the captured PNG Blob',
        );
        assert(
          expectedSeek && numeric(expectedSeek[1]) === requested,
          'Visible requested seek differs from input',
        );
        assert(
          Boolean(presented) !== Boolean(approximate),
          'Frame timing evidence is absent or contradictory',
        );
        const playhead = numeric(presented?.[2] ?? approximate[1]),
          observedTime = presented ? numeric(presented[1]) : null;
        for (const time of [playhead, ...(observedTime === null ? [] : [observedTime])])
          assert(
            Number.isFinite(time) && time >= 0 && time <= sourceInfo.durationSeconds,
            'Frame timing evidence falls outside the source',
          );
        assert(
          $('step-back').disabled === !presented && $('step-forward').disabled === !presented,
          'Frame-step availability disagrees with the presented-frame evidence',
        );
        const prepared = await prepareStillAsset(observed.blob, {
          id: 'video-poster-qualification',
          provenance: {
            kind: 'user-supplied',
            credit: 'Local qualification',
            source: `Video ${sourceInfo.sha256}; requested ${requested} seconds`,
          },
        });
        assert(
          prepared.asset.width === sourceInfo.width &&
            prepared.asset.height === sourceInfo.height &&
            $('image').naturalWidth === sourceInfo.width &&
            $('image').naturalHeight === sourceInfo.height,
          'PNG or visible preview dimensions differ from the inspected source',
        );
        assert(
          evidence.includes(`PNG SHA-256: ${prepared.asset.sha256}`),
          'Visible PNG hash differs from the decoded export',
        );
        assert(
          evidence.includes(`Original SHA-256: ${sourceInfo.sha256}`),
          'Captured evidence references a different original',
        );
        const artifact = {
          name: $('download').download,
          ...(await fingerprint(observed.blob)),
          width: prepared.asset.width,
          height: prepared.asset.height,
        };
        assert(
          artifact.sha256 === prepared.asset.sha256 && artifact.bytes === prepared.asset.bytes,
          'Production PNG validation changed exact bytes',
        );
        return {
          href,
          blob: observed.blob,
          artifact,
          timing: {
            requested,
            observedTime,
            playhead,
            evidence: presented ? 'presented-frame' : 'playhead-estimate',
          },
          visibleEvidence: evidence,
        };
      };
      const first = await capture();
      await p.choose(selector('download'));
      await p.choose(selector('download'));
      await p.wait(() => downloadClicks.length === 2);
      assert(
        downloadClicks.every((row) => row.href === first.href && !row.prevented),
        'Repeated export did not activate the same captured PNG',
      );
      assert(
        same(await fingerprint(first.blob), {
          bytes: first.artifact.bytes,
          sha256: first.artifact.sha256,
        }),
        'Repeated download changed prepared PNG bytes',
      );
      await p.choose(selector('file'));
      await p.pulse('back');
      assert(
        $('file').files[0] === originalFile && $('download').href === first.href,
        'Canceled replacement changed the source or captured PNG',
      );
      p.record(
        'Actual captured PNG fully decoded through production still-asset validation; source hash, dimensions and requested/reported timing agree with visible evidence. Two explicit download activations reference the exact same PNG; canceled replacement retained it',
        selector('evidence'),
        {
          artifact: first.artifact,
          timing: first.timing,
          downloadActivations: downloadClicks.length,
        },
      );

      await p.choose(selector('clear'));
      assert(
        !$('file').files.length &&
          $('capture').disabled &&
          $('download').hidden &&
          $('preview').hidden,
        'Clear retained an inspected source or usable poster',
      );
      assert(p.doc.activeElement.id === 'video-poster-file', 'Clear lost source-entry focus');
      const reopenedFile = await chooseVideo();
      assert(
        same(await fingerprint(reopenedFile), sourceReceipt),
        'Reselection reopened different video bytes',
      );
      assert(
        $('download').hidden && $('time').value === '0',
        'Reselection falsely restored a saved project or poster',
      );
      await replaceNumber('time', String(requested));
      const reopened = await capture();
      await p.choose(selector('download'));
      await p.wait(() => downloadClicks.length === 3);
      assert(
        !downloadClicks[2].prevented && downloadClicks[2].href === reopened.href,
        'Reopened capture export was not activated',
      );
      assert(same(snapshot(win.localStorage), originalLocal), 'Local browser storage changed');
      assert(
        same(snapshot(win.sessionStorage), originalSession),
        'Session browser storage changed',
      );
      p.record(
        'Clear returned to source entry; selecting the same bundled video and requesting the same time produced another validated PNG. No project Save/reload exists, and no browser storage was changed',
        selector('evidence'),
        {
          first: { artifact: first.artifact, timing: first.timing },
          reopened: { artifact: reopened.artifact, timing: reopened.timing },
          identicalRecapture: first.artifact.sha256 === reopened.artifact.sha256,
          retainedStorageKeys: { local: originalLocal.length, session: originalSession.length },
          boundary:
            'Real shared virtual-pad edits, browser frame capture and full PNG decoding. JSON is this test receipt, not a product evidence export. Same-capture downloads must be identical; a new seek may produce different pixels/timing. No editable provenance/text, persistent project, full-video playback, physical trim/conversion, timed operation cancellation, OS file-picker import, physical controller or native-platform qualification is claimed. Explicit download activation is separate from actual OS file receipts. The fixture never opens or mutates IndexedDB.',
        },
      );
    } finally {
      p.doc.removeEventListener('click', observeDownload, true);
    }
  },
];
