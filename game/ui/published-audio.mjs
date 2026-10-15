import { attachMenuAudioSettings } from './menu-audio.mjs';
import { t } from '../i18n/index.mjs';
import { createPublishedCues } from './published-cues.mjs';
export { createPublishedCues } from './published-cues.mjs';

/** The page supplies only its accepted release host. No playlist, preferences,
 * imported asset or progress database is read or written by this adapter. */
export function attachPublishedAudio({
  sound,
  ready,
  getHost,
  allowMusic = () => true,
  cues = true,
  document: doc = globalThis.document,
}) {
  let closed = false,
    snapshot = null,
    explicitPresentation = false,
    player = null;
  const readAudio = (slot, options) => {
    if (closed || !snapshot || snapshot.resolved.assets[slot]?.kind !== 'audio') return null;
    return getHost()?.readAudio(slot, { ...options, snapshot }) ?? null;
  };
  const syncPlayer = () => {
    const accepted = snapshot,
      host = !closed && accepted ? getHost() : null;
    const asset = accepted?.resolved.assets['audio.music'];
    player?.setPublishedTrack?.(
      !closed && asset?.kind === 'audio'
        ? {
            id: `published.${asset.file.sha256}`,
            title: asset.description,
            allowed: allowMusic,
            readBlob: async (options) => {
              if (closed || snapshot !== accepted)
                throw new DOMException(t('interface:publishedThemeChanged'), 'AbortError');
              const result = await host?.readAudio('audio.music', {
                ...options,
                snapshot: accepted,
              });
              if (closed || snapshot !== accepted)
                throw new DOMException(t('interface:publishedThemeChanged'), 'AbortError');
              return result?.blob;
            },
          }
        : null,
    );
  };
  const loaded = Promise.resolve(ready)
    .then((value) => {
      if (closed || explicitPresentation) return;
      snapshot = value;
      if (snapshot && cues) sound.setPublishedAudio(readAudio);
      syncPlayer();
    })
    .catch(() => {});
  const detachMenuSettings = attachMenuAudioSettings(sound, doc);
  let keyboardFocus = false;
  const onKey = (event) => {
    keyboardFocus = event.key === 'Tab' || event.key.startsWith('Arrow');
  };
  const onPointer = () => {
    keyboardFocus = false;
  };
  const onFocus = (event) => {
    if (!keyboardFocus) return;
    if (event.target?.closest?.('button, a[href], input, select, textarea'))
      sound.publishedCue('focus');
  };
  const onClick = (event) => {
    const control = event.target?.closest?.('button, a[href]');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    const cancel = control.matches?.(
      '[data-close], [data-shell-back], [data-dismiss], [id$="-cancel"], [id$="-close"], [id$="-back"]',
    );
    sound.publishedCue(cancel ? 'cancel' : 'confirm');
  };
  const onChange = (event) => {
    if (
      event.target?.matches?.('select, input[type=checkbox], input[type=radio], input[type=range]')
    )
      sound.publishedCue('confirm');
  };
  if (cues) {
    doc?.addEventListener?.('change', onChange);
    doc?.addEventListener?.('keydown', onKey);
    doc?.addEventListener?.('pointerdown', onPointer);
    doc?.addEventListener?.('focusin', onFocus);
    doc?.addEventListener?.('click', onClick);
  }
  return Object.freeze({
    ready: loaded,
    setPresentation(value) {
      if (closed || (explicitPresentation && snapshot === value)) return;
      explicitPresentation = true;
      snapshot = value;
      if (cues) sound.setPublishedAudio(snapshot ? readAudio : null);
      syncPlayer();
    },
    setPlayer(value) {
      player = value;
      syncPlayer();
    },
    close() {
      if (closed) return;
      closed = true;
      syncPlayer();
      if (cues) sound.setPublishedAudio(null);
      detachMenuSettings();
      doc?.removeEventListener?.('change', onChange);
      doc?.removeEventListener?.('keydown', onKey);
      doc?.removeEventListener?.('pointerdown', onPointer);
      doc?.removeEventListener?.('focusin', onFocus);
      doc?.removeEventListener?.('click', onClick);
    },
  });
}
