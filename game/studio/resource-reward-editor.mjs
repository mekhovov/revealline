import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { editDiscoveryResource } from '../content-design/discovery.mjs';
import { mountRewardQr } from '../ui/reward-qr.mjs';

/** Resource authoring shares the existing sidecar, revisions and export path. */
export function createResourceRewardEditor({ container, getSource, getRewards, apply, getLocale }) {
  const document = container.ownerDocument;
  const tr = (key) => t(`tools:studio.resource.${key}`);
  const node = (tag, text) => {
    const value = document.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const root = node('fieldset'),
    reward = node('select'),
    payload = node('select'),
    id = node('input'),
    address = node('input'),
    en = node('input'),
    uk = node('input'),
    qr = node('input'),
    status = node('p'),
    preview = node('section');
  root.setAttribute('data-resource-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  address.type = 'url';
  qr.type = 'checkbox';
  const fields = { reward, payload, id, address, en, uk, qr };
  for (const [name, field] of Object.entries(fields)) {
    const label = node('label', tr(name));
    field.setAttribute('data-resource-field', name);
    label.append(field);
    root.append(label);
  }
  let context,
    viewer,
    disposed = false,
    busy = false;
  const identity = () => dataIdentity({ source: getSource(), rewards: getRewards() });
  const stop = () => {
    viewer?.dispose();
    viewer = null;
    preview.replaceChildren();
  };
  function loadPayload() {
    stop();
    const value = getRewards()
      .find((item) => item.id === reward.value)
      ?.payloads.find((item) => item.id === payload.value);
    id.value = value?.id ?? 'resource';
    address.value = value?.url ?? '';
    en.value = value?.locales.en.title ?? '';
    uk.value = value?.locales.uk.title ?? '';
    qr.checked = value?.qr ?? false;
  }
  function loadReward() {
    const option = node('option', tr('new'));
    option.value = '';
    const urls =
      getRewards()
        .find((item) => item.id === reward.value)
        ?.payloads.filter((item) => item.type === 'url') ?? [];
    payload.replaceChildren(
      option,
      ...urls.map((item) => {
        const value = node('option', item.locales[getLocale()].title);
        value.value = item.id;
        return value;
      }),
    );
    payload.value = '';
    loadPayload();
  }
  function read() {
    required(context === identity(), 'The draft changed. Refresh the resource editor.');
    return {
      id: id.value,
      type: 'url',
      url: address.value,
      qr: qr.checked,
      locales: { en: { title: en.value }, uk: { title: uk.value } },
    };
  }
  const controls = [];
  function button(key, action) {
    const value = node('button', tr(key));
    value.type = 'button';
    value.setAttribute('data-resource-action', key);
    value.onclick = async () => {
      if (disposed || busy) return;
      busy = true;
      try {
        await action();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
      }
    };
    controls.push(value);
    root.append(value);
  }
  button('preview', () => {
    stop();
    const value = read();
    // The same authoring validator checks URL, locale and bounded QR capacity.
    editDiscoveryResource(getSource(), getRewards(), reward.value, value);
    preview.append(node('p', value.url));
    if (value.qr)
      viewer = mountRewardQr({ container: preview, payload: value, locale: getLocale() });
    status.textContent = tr('previewOnly');
  });
  button('apply', async () => {
    const candidate = editDiscoveryResource(getSource(), getRewards(), reward.value, read());
    if ((await apply(candidate)) === false || disposed) return;
    sync();
    status.textContent = tr('applied');
  });
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  reward.onchange = loadReward;
  payload.onchange = loadPayload;
  function sync() {
    if (disposed) return;
    context = identity();
    const previous = reward.value,
      definitions = getRewards();
    reward.replaceChildren(
      ...definitions.map((item) => {
        const value = node('option', item.locales[getLocale()].title);
        value.value = item.id;
        return value;
      }),
    );
    reward.value = definitions.some((item) => item.id === previous)
      ? previous
      : (definitions[0]?.id ?? '');
    root.disabled = !definitions.length;
    loadReward();
  }
  return {
    sync,
    dispose() {
      disposed = true;
      stop();
      reward.onchange = payload.onchange = null;
      controls.forEach((value) => {
        value.onclick = null;
      });
      root.remove();
    },
  };
}
