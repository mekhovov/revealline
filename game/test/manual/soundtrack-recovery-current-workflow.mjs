// Test-only qualification. UI changes and downloads use the real shared pad;
// production readers and importers observe outcomes without writing domains.
import { canonicalJSON } from '../../data-json.mjs';
import { createManagedMediaStore } from '../../managed-media-store.mjs';
import { importSoundtrackBundle, exportSoundtrackBundle } from '../../soundtrack-bundle.mjs';
import { SOUNDTRACK_CATALOGUE } from '../../content/soundtrack-catalogue.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
async function fingerprint(blob) {
  return {
    bytes: blob.size,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export const soundtrackRecoveryCurrent = [
  'Current soundtrack recovery: owned focus, explicit download and unchanged media domains',
  '/authoring/still-media/',
  async (p) => {
    const win = p.doc.defaultView,
      $ = (id) => p.doc.getElementById(id);
    assert(
      win.location.port === '8989' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the preserved picture/story qualification origin on port 8989.',
    );
    await p.wait(() => !$('still-host-open').disabled);
    await p.choose('#still-host-open');
    await p.wait(() => !$('still-media-reload').disabled, 30000);
    await p.choose('#still-media-close');
    assert(p.doc.activeElement.id === 'still-host-open', 'Panel close lost its page opener');
    const downloadClicks = [];
    const observeDownload = (event) => {
      if (event.target?.closest?.('a') !== $('still-host-download-audio')) return;
      const href = $('still-host-download-audio').href;
      queueMicrotask(() => downloadClicks.push({ href, prevented: event.defaultPrevented }));
    };
    p.doc.addEventListener('click', observeDownload, true);
    const manager = createManagedMediaStore({ storyMedia: true, soundtrackCatalogue: true }),
      snapshot = async () =>
        Promise.all(
          ['audio', 'media', 'story'].map((domain) => manager.readDomainMetadata(domain)),
        );
    try {
      const before = await snapshot(),
        exports = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        const prior = p.downloads.length;
        await p.choose('#still-host-export-audio');
        await p.wait(
          () => !$('still-host-download-audio').hidden && !$('still-host-export-audio').disabled,
          30000,
        );
        assert(
          p.doc.activeElement.id === 'still-host-download-audio',
          'Soundtrack preparation did not restore its owned download focus',
        );
        const url = $('still-host-download-audio').href,
          observed = p.downloads.slice(prior).find((item) => item.url === url);
        assert(observed, 'Prepared soundtrack Blob was not observed');
        await p.choose('#still-host-download-audio');
        await p.wait(() => downloadClicks.length === attempt + 1);
        assert(
          downloadClicks[attempt].href === url && !downloadClicks[attempt].prevented,
          'Explicit download did not activate the prepared soundtrack backup',
        );
        const imported = await importSoundtrackBundle(observed.blob, {
            catalogue: SOUNDTRACK_CATALOGUE,
          }),
          canonical = await exportSoundtrackBundle(imported.library, imported.assets, {
            catalogue: SOUNDTRACK_CATALOGUE,
          }),
          artifact = await fingerprint(observed.blob);
        assert(
          canonicalJSON(artifact) === canonicalJSON(await fingerprint(canonical)),
          'Soundtrack production round-trip changed exported bytes',
        );
        exports.push({
          ...artifact,
          name: $('still-host-download-audio').download,
          audioOriginals: imported.assets.length,
          format: imported.library.format,
        });
      }
      assert(canonicalJSON(exports[0]) === canonicalJSON(exports[1]), 'Repeated backup differs');
      assert(canonicalJSON(before) === canonicalJSON(await snapshot()), 'Backup changed a domain');
      p.record(
        'Explicit soundtrack Prepare/Download repeated with owned focus; production import and canonical export reproduce exact bytes and all three media domains remain unchanged',
        '#still-host-status',
        {
          exports,
          generations: before.map(({ generation }) => generation),
          boundary:
            'This origin has retained picture/story data but no imported audio recordings. Empty-library recovery and exclusion of picture/video data are qualified here. Nonempty, restricted and missing-original recovery cases have separate automated evidence; physical-pad and OS file-picker restore remain separate.',
        },
      );
      await p.choose('#still-host-close');
      assert(p.doc.activeElement.id === 'still-host-open', 'Close connections lost page focus');
    } finally {
      p.doc.removeEventListener('click', observeDownload, true);
      manager.close();
    }
  },
];
