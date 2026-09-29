import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { REWARD_AUDIO_GROUP_FORMAT } from '../rewards/audio-groups.mjs';
import { editDiscoveryAudioGroups } from '../content-design/discovery-audio-groups.mjs';
import { mountLocalRewardMediaPreview } from './reward-media-preview.mjs';

/** Shared Level/Campaign and Company authoring; group references never import
 * an asset, change requirements or manufacture a listening/completion record. */
export function createAudioGroupEditor({
  container,
  getSource,
  getRewards,
  getLocale,
  apply,
  window = globalThis.window,
}) {
  const document = container.ownerDocument,
    tr = (key) => t(`tools:studio.audioGroup.${key}`),
    node = (tag, text) => {
      const value = document.createElement(tag);
      if (text !== undefined) value.textContent = text;
      return value;
    },
    root = node('fieldset'),
    status = node('p'),
    preview = node('div'),
    controls = [],
    fields = {
      reward: node('select'),
      group: node('select'),
      id: node('input'),
      en: node('input'),
      uk: node('input'),
      available: node('select'),
      order: node('select'),
    };
  root.setAttribute('data-audio-group-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  fields.order.size = 8;
  fields.id.maxLength = 128;
  fields.en.maxLength = fields.uk.maxLength = 256;
  for (const [key, field] of Object.entries(fields)) {
    const label = node('label', tr(key));
    field.setAttribute('data-audio-group-field', key);
    label.append(field);
    root.append(label);
  }
  let context,
    ordered = [],
    viewer = null,
    disposed = false,
    busy = false;
  const identity = () => dataIdentity({ source: getSource(), rewards: getRewards() });
  const selectedReward = () => getRewards().find((item) => item.id === fields.reward.value);
  const stop = () => {
    viewer?.dispose();
    viewer = null;
    preview.replaceChildren();
  };
  const option = (value, title) => {
    const item = node('option', title);
    item.value = value;
    return item;
  };
  function renderOrder(selected = ordered[0] ?? '') {
    const reward = selectedReward();
    fields.order.replaceChildren(
      ...ordered.map((id) =>
        option(id, reward.payloads.find((p) => p.id === id).locales[getLocale()].title),
      ),
    );
    fields.order.value = selected;
    const reserved = new Set(
      (reward?.audioGroups ?? [])
        .filter((g) => g.id !== fields.group.value)
        .flatMap((g) => g.payloadIds),
    );
    const available =
      reward?.payloads.filter(
        (p) => p.type === 'audio' && !ordered.includes(p.id) && !reserved.has(p.id),
      ) ?? [];
    fields.available.replaceChildren(
      ...available.map((p) => option(p.id, p.locales[getLocale()].title)),
    );
    fields.available.value = available[0]?.id ?? '';
  }
  function loadGroup() {
    stop();
    const group = selectedReward()?.audioGroups?.find((g) => g.id === fields.group.value);
    ordered = [...(group?.payloadIds ?? [])];
    fields.id.value = group?.id ?? 'listening-playlist';
    fields.en.value = group?.locales.en.title ?? '';
    fields.uk.value = group?.locales.uk.title ?? '';
    renderOrder();
  }
  function loadReward() {
    fields.group.replaceChildren(
      option('', tr('new')),
      ...(selectedReward()?.audioGroups ?? []).map((g) =>
        option(g.id, g.locales[getLocale()].title),
      ),
    );
    fields.group.value = '';
    loadGroup();
  }
  function read(remove = false) {
    required(context === identity(), 'The draft changed. Refresh the playlist editor.');
    const reward = selectedReward();
    required(reward, 'Choose an authored reward.');
    const groups = (reward.audioGroups ?? []).filter((g) => g.id !== fields.group.value);
    if (remove) required(fields.group.value, 'Choose an existing playlist to remove.');
    else
      groups.push({
        format: REWARD_AUDIO_GROUP_FORMAT,
        id: fields.id.value,
        locales: { en: { title: fields.en.value }, uk: { title: fields.uk.value } },
        payloadIds: [...ordered],
      });
    return editDiscoveryAudioGroups(getSource(), getRewards(), reward.id, groups);
  }
  function button(key, action) {
    const value = node('button', tr(key));
    value.type = 'button';
    value.setAttribute('data-audio-group-action', key);
    value.onclick = async () => {
      if (disposed || busy) return;
      busy = true;
      try {
        await action();
      } catch (error) {
        if (!disposed) status.textContent = error.message;
      } finally {
        busy = false;
      }
    };
    controls.push(value);
    root.append(value);
  }
  button('add', () => {
    required(context === identity(), 'The draft changed. Refresh the playlist editor.');
    const id = fields.available.value;
    required(
      id && !ordered.includes(id) && ordered.length < 8,
      'Choose another available recording.',
    );
    stop();
    ordered.push(id);
    renderOrder(id);
  });
  const move = (step) => {
    const id = fields.order.value,
      index = ordered.indexOf(id),
      next = index + step;
    if (index < 0 || next < 0 || next >= ordered.length) return;
    stop();
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    renderOrder(id);
  };
  button('up', () => move(-1));
  button('down', () => move(1));
  button('removeTrack', () => {
    stop();
    ordered = ordered.filter((id) => id !== fields.order.value);
    renderOrder();
  });
  button('preview', () => {
    stop();
    const candidate = read(),
      reward = candidate.rewards.find((r) => r.id === fields.reward.value),
      group = reward.audioGroups.find((g) => g.id === fields.id.value);
    viewer = mountLocalRewardMediaPreview({
      container: preview,
      group,
      payloads: reward.payloads,
      locale: getLocale(),
      window,
    });
    status.textContent = tr('previewOnly');
  });
  const save = async (remove) => {
    const candidate = read(remove);
    if ((await apply(candidate)) === false || disposed) return;
    sync();
    status.textContent = tr('applied');
  };
  button('apply', () => save(false));
  button('remove', () => save(true));
  fields.reward.onchange = loadReward;
  fields.group.onchange = loadGroup;
  for (const key of ['id', 'en', 'uk']) fields[key].oninput = stop;
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  function sync() {
    if (disposed) return;
    context = identity();
    const previous = fields.reward.value,
      rewards = getRewards();
    fields.reward.replaceChildren(
      ...rewards.map((r) => option(r.id, r.locales[getLocale()].title)),
    );
    fields.reward.value = rewards.some((r) => r.id === previous)
      ? previous
      : (rewards[0]?.id ?? '');
    root.disabled = !rewards.length;
    loadReward();
  }
  return {
    sync,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      Object.values(fields).forEach((field) => {
        field.onchange = field.oninput = null;
      });
      controls.forEach((control) => {
        control.onclick = null;
      });
      root.remove();
    },
  };
}
