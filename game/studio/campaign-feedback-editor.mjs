import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { editCampaignFeedback } from '../content-design/campaign-feedback.mjs';
import { VICTORY_MOTIFS, campaignResultLine } from '../journey/campaign-feedback.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { acquireStudioRewardAudio } from './reward-audio.mjs';

/** One shared, explicit source editor. Preview is ephemeral and cannot emit
 * accepted engine events, write preferences, or award anything to a player. */
export function createCampaignFeedbackEditor({
  container,
  getSource,
  getCampaignId,
  getLocale,
  apply,
  window = globalThis.window,
  createSound = (options) => new Soundscape(options),
}) {
  const doc = container.ownerDocument,
    tr = (key) => t(`tools:studio.campaignFeedback.${key}`),
    node = (tag, text) => {
      const value = doc.createElement(tag);
      if (text) value.textContent = text;
      return value;
    },
    root = node('fieldset'),
    enabled = node('input'),
    en = node('textarea'),
    uk = node('textarea'),
    motif = node('select'),
    status = node('p'),
    preview = node('p');
  root.setAttribute('data-campaign-feedback-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  enabled.type = 'checkbox';
  en.rows = uk.rows = 4;
  for (const id of Object.keys(VICTORY_MOTIFS)) {
    const item = node('option', tr(id));
    item.value = id;
    motif.append(item);
  }
  for (const [id, field] of Object.entries({ enabled, en, uk, motif })) {
    const label = node('label', tr(id));
    field.setAttribute('data-campaign-feedback-field', id);
    label.append(field);
    root.append(label);
  }
  let context,
    disposed = false,
    busy = false,
    player = null,
    audioOwner = null,
    request = 0;
  const identity = () => dataIdentity({ source: getSource(), campaignId: getCampaignId() });
  function stop() {
    request++;
    player?.dispose();
    player = null;
    audioOwner?.release();
    audioOwner = null;
  }
  function read() {
    required(context === identity(), 'The draft changed. Refresh campaign feedback.');
    return editCampaignFeedback(
      getSource(),
      getCampaignId(),
      enabled.checked
        ? {
            lines: {
              en: en.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
              uk: uk.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            },
            victoryMotif: motif.value,
          }
        : null,
    );
  }
  const controls = [];
  const button = (key, action) => {
    const value = node('button', tr(key));
    value.type = 'button';
    value.setAttribute('data-campaign-feedback-action', key);
    value.onclick = async () => {
      if (disposed || (busy && key !== 'stop')) return;
      if (key === 'stop') {
        action();
        return;
      }
      busy = true;
      try {
        await action();
      } catch (error) {
        stop();
        if (!disposed) status.textContent = error.message;
      } finally {
        busy = false;
      }
    };
    controls.push(value);
    root.append(value);
  };
  button('preview', () => {
    stop();
    const source = read(),
      feedback = source.campaigns.find((item) => item.id === getCampaignId()).discovery?.feedback;
    preview.textContent = feedback
      ? campaignResultLine(
          {
            owned: true,
            mode: 'solo',
            outcome: 'won',
            missionId: source.campaigns.find((item) => item.id === getCampaignId()).missionIds[0],
            feedback,
          },
          getLocale(),
        ).text
      : tr('fallback');
    status.textContent = tr('previewOnly');
  });
  button('audition', async () => {
    stop();
    const current = request,
      source = read(),
      campaign = source.campaigns.find((item) => item.id === getCampaignId()),
      feedback = campaign.discovery?.feedback;
    audioOwner = acquireStudioRewardAudio(doc);
    player = createSound({ audioMaster: audioOwner.master });
    player.configure({ master: 0.35, music: 0, sfx: 0.7 });
    const sound = player;
    if (!(await sound.enable())) throw new Error(tr('unavailable'));
    if (disposed || request !== current || context !== identity()) {
      if (request === current) stop();
      return;
    }
    sound.event(
      { type: 'run.completed', won: true, tick: 0 },
      {},
      { owned: true, mode: 'solo', outcome: 'won', missionId: campaign.missionIds[0], feedback },
    );
    status.textContent = tr('previewOnly');
  });
  button('stop', () => {
    stop();
    status.textContent = tr('stopped');
  });
  button('apply', async () => {
    const candidate = read();
    stop();
    if ((await apply(candidate)) === false || disposed) return;
    sync();
    status.textContent = tr('applied');
  });
  const suspend = () => {
    if (doc.hidden || doc.hasFocus?.() === false) stop();
  };
  doc.addEventListener('visibilitychange', suspend);
  window?.addEventListener?.('blur', stop);
  for (const field of [enabled, en, uk, motif]) field.addEventListener('input', stop);
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  function sync() {
    if (disposed) return;
    stop();
    context = identity();
    const campaign = getSource().campaigns.find((item) => item.id === getCampaignId()),
      feedback = campaign?.discovery?.feedback;
    root.disabled = !campaign;
    enabled.checked = !!feedback;
    en.value = feedback?.lines.en.join('\n') ?? '';
    uk.value = feedback?.lines.uk.join('\n') ?? '';
    motif.value = feedback?.victoryMotif ?? Object.keys(VICTORY_MOTIFS)[0];
    preview.textContent = '';
  }
  return {
    sync,
    // Stop transient playback without rebuilding or removing draft controls.
    suspend: stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      controls.forEach((item) => (item.onclick = null));
      for (const field of [enabled, en, uk, motif]) field.removeEventListener('input', stop);
      doc.removeEventListener('visibilitychange', suspend);
      window?.removeEventListener?.('blur', stop);
      root.remove();
    },
  };
}
