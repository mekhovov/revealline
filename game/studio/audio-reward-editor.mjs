import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { validateStudioDraft } from '../../authoring/company-studio/model.mjs';
import { rewardAssetHandoffContext } from '../content-design/discovery-asset-handoff.mjs';
import {
  inspectDiscoveryAudioHandoff,
  editDiscoveryAudioHandoff,
} from '../content-design/discovery-audio-handoff.mjs';
import { acquireStudioRewardAudio } from './reward-audio.mjs';
import { mountRewardMedia } from '../ui/reward-media.mjs';

/** Guided existing-payload authoring. Files transfer exact originals; the
 * selected Company draft remains publication/dependency authority. */
export function createAudioRewardEditor({
  container,
  getSource,
  getRewards,
  getLocale,
  getCompanySource,
  apply,
  window = globalThis.window,
}) {
  const document = container.ownerDocument,
    tr = (key) => t('tools:studio.audioHandoff.' + key);
  const node = (tag, text) => {
    const value = document.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const root = node('fieldset'),
    status = node('p'),
    preview = node('section');
  root.setAttribute('data-audio-handoff-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  const fields = {},
    labels = {};
  for (const [id, tag] of Object.entries({
    packet: 'input',
    edition: 'select',
    reward: 'select',
    audioFile: 'input',
    enFile: 'input',
    ukFile: 'input',
    audio: 'select',
    en: 'select',
    uk: 'select',
    payloadId: 'input',
    enTitle: 'input',
    ukTitle: 'input',
  })) {
    const label = node('label', tr(id)),
      field = node(tag);
    field.setAttribute('data-audio-handoff-field', id);
    label.append(field);
    root.append(label);
    fields[id] = field;
    labels[id] = label;
  }
  for (const id of ['packet', 'audioFile', 'enFile', 'ukFile']) fields[id].type = 'file';
  fields.packet.accept = '.json,application/json';
  fields.audioFile.accept = '.mp3,audio/mpeg';
  fields.enFile.accept = fields.ukFile.accept = '.txt,text/plain';
  if (getCompanySource) labels.packet.hidden = labels.edition.hidden = true;
  let imported = null,
    inspected = null,
    inspectedDraft = null,
    disposed = false,
    busy = false,
    generation = 0,
    controller = null,
    viewer = null,
    audioOwner = null;
  const actions = new Map();
  const owner = () =>
    getCompanySource?.() ?? (imported && { ...imported, editionId: fields.edition.value });
  const identity = () => {
    const value = owner();
    return dataIdentity({
      source: getSource(),
      rewards: getRewards(),
      edition: value && {
        catalog: value.catalog,
        editionId: value.editionId,
        files: [...value.files],
      },
    });
  };
  const context = () => {
    const source = owner(),
      reward = getRewards().find((item) => item.id === fields.reward.value);
    required(source && reward, 'Choose an owning Company source draft and reward.');
    return rewardAssetHandoffContext(source, reward.campaignId);
  };
  function stopPreview() {
    viewer?.dispose();
    audioOwner?.release();
    viewer = audioOwner = null;
    preview.replaceChildren();
  }
  function refreshButtons() {
    for (const [id, button] of actions)
      button.disabled = disposed || busy || (id !== 'inspect' && !inspected);
  }
  function invalidate() {
    generation++;
    controller?.abort();
    controller = null;
    inspected = inspectedDraft = null;
    stopPreview();
    for (const id of ['audio', 'en', 'uk']) fields[id].replaceChildren();
    refreshButtons();
  }
  function options(field, values, key, title, blank = false) {
    const previous = field.value;
    const nodes = values.map((value) => {
      const option = node('option', title(value));
      option.value = key(value);
      return option;
    });
    if (blank) {
      const option = node('option', tr('choose'));
      option.value = '';
      nodes.unshift(option);
    }
    field.replaceChildren(...nodes);
    field.value = values.some((value) => key(value) === previous)
      ? previous
      : blank
        ? ''
        : values[0]
          ? key(values[0])
          : '';
  }
  function draft() {
    required(
      inspected && inspectedDraft === identity(),
      'The draft changed. Inspect these originals again.',
    );
    return editDiscoveryAudioHandoff(
      getSource(),
      getRewards(),
      fields.reward.value,
      context(),
      inspected,
      {
        audio: fields.audio.value,
        en: fields.en.value,
        uk: fields.uk.value,
        payloadId: fields.payloadId.value,
        locales: { en: { title: fields.enTitle.value }, uk: { title: fields.ukTitle.value } },
      },
    );
  }
  function action(id, callback) {
    const button = node('button', tr(id));
    button.type = 'button';
    button.setAttribute('data-audio-handoff-action', id);
    button.onclick = async () => {
      if (disposed || busy) return false;
      if (id === 'inspect') invalidate();
      busy = true;
      refreshButtons();
      const visit = generation;
      try {
        await callback();
        return true;
      } catch (error) {
        if (!disposed && visit === generation) status.textContent = error.message;
        return false;
      } finally {
        busy = false;
        refreshButtons();
      }
    };
    actions.set(id, button);
    root.append(button);
  }
  action('inspect', async () => {
    const visit = generation,
      expected = identity(),
      ctx = context();
    controller = new AbortController();
    const result = await inspectDiscoveryAudioHandoff(
      ctx,
      {
        audio: fields.audioFile.files?.[0],
        en: fields.enFile.files?.[0],
        uk: fields.ukFile.files?.[0],
      },
      { signal: controller.signal },
    );
    if (disposed || visit !== generation || expected !== identity()) return;
    inspected = result;
    inspectedDraft = expected;
    for (const role of ['audio', 'en', 'uk'])
      options(
        fields[role],
        result[role].matches,
        (item) => item.id,
        (item) => item.id,
        true,
      );
    status.textContent = tr('verified');
  });
  action('preview', async () => {
    const candidate = draft(),
      evidence = inspected;
    const reward = candidate.rewards.find((item) => item.id === fields.reward.value);
    const payload = reward.payloads.find((item) => item.id === fields.payloadId.value);
    stopPreview();
    audioOwner = acquireStudioRewardAudio(document);
    viewer = mountRewardMedia({
      container: preview,
      document,
      window,
      URLImpl: window.URL,
      payload,
      locale: getLocale(),
      audioMaster: audioOwner.master,
      musicDucker: { acquire: () => () => {} },
      readLocalAsset: async (reference, { signal }) => {
        signal.throwIfAborted();
        for (const role of ['audio', 'en', 'uk']) {
          const asset = evidence[role].matches.find(
            (item) => item.id === reference.assetId && item.sha256 === reference.sha256,
          );
          if (asset) return { asset, bytes: evidence[role].bytes };
        }
        throw new Error('This preview needs its inspected original.');
      },
    });
    status.textContent = tr('previewOnly');
  });
  action('apply', async () => {
    const candidate = draft();
    if ((await apply(candidate)) === false || disposed) return;
    sync();
    status.textContent = tr('applied');
  });
  fields.packet.onchange = async () => {
    invalidate();
    const visit = generation;
    try {
      const file = fields.packet.files?.[0];
      required(
        file && file.size <= 16 * 1024 * 1024,
        'Choose a bounded Company Studio source draft.',
      );
      const value = validateStudioDraft(await file.text());
      if (disposed || visit !== generation) return;
      imported = value;
      options(
        fields.edition,
        value.catalog.editions,
        (item) => item.id,
        (item) => item.name,
      );
      sync();
    } catch (error) {
      if (!disposed && visit === generation) status.textContent = error.message;
    }
  };
  fields.edition.onchange = () => sync();
  for (const key of ['reward', 'audioFile', 'enFile', 'ukFile']) fields[key].onchange = invalidate;
  for (const key of ['audio', 'en', 'uk', 'payloadId', 'enTitle', 'ukTitle'])
    fields[key].oninput = fields[key].onchange = stopPreview;
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  function sync() {
    if (disposed) return;
    invalidate();
    const source = owner();
    options(
      fields.reward,
      getRewards().filter(
        (item) =>
          !source ||
          source.catalog.editions
            .find((edition) => edition.id === source.editionId)
            ?.campaignIds.includes(item.campaignId),
      ),
      (item) => item.id,
      (item) => item.locales[getLocale()].title,
    );
  }
  return {
    sync,
    dispose() {
      if (disposed) return;
      disposed = true;
      invalidate();
      Object.values(fields).forEach((field) => {
        field.onchange = field.oninput = null;
      });
      actions.forEach((button) => {
        button.onclick = null;
      });
      root.remove();
    },
  };
}
