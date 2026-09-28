import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { editDiscoveryTeaser } from '../content-design/discovery-teaser.mjs';
import { mountLocalRewardTeaserPreview } from './reward-teaser-preview.mjs';

/** Shared Level/Campaign and Company Studio teaser authoring. Asset approval
 * and publication remain the existing edition compiler's authority. */
export function createTeaserRewardEditor({
  container,
  getSource,
  getRewards,
  getLocale,
  apply,
  window = globalThis.window,
}) {
  const doc = container.ownerDocument,
    tr = (key) => t(`tools:studio.teaser.${key}`);
  const node = (tag, text) => {
    const item = doc.createElement(tag);
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const root = node('fieldset'),
    status = node('p'),
    preview = node('section');
  root.setAttribute('data-teaser-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  const fields = {
    reward: node('select'),
    assetId: node('input'),
    sha256: node('input'),
    enAlt: node('input'),
    ukAlt: node('input'),
  };
  for (const [name, field] of Object.entries(fields)) {
    const label = node('label', tr(name));
    field.setAttribute('data-teaser-field', name);
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
  function selected() {
    stop();
    const image = getRewards().find((item) => item.id === fields.reward.value)?.teaserImage;
    fields.assetId.value = image?.asset.assetId ?? '';
    fields.sha256.value = image?.asset.sha256 ?? '';
    for (const locale of ['en', 'uk'])
      fields[locale + 'Alt'].value = image?.locales[locale].alt ?? '';
  }
  function candidate(remove = false) {
    required(context === identity(), 'The draft changed. Refresh the teaser editor.');
    return editDiscoveryTeaser(
      getSource(),
      getRewards(),
      fields.reward.value,
      remove
        ? null
        : {
            asset: { assetId: fields.assetId.value, sha256: fields.sha256.value },
            locales: { en: { alt: fields.enAlt.value }, uk: { alt: fields.ukAlt.value } },
          },
    );
  }
  const controls = [];
  function button(key, action) {
    const value = node('button', tr(key));
    value.type = 'button';
    value.setAttribute('data-teaser-action', key);
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
  button('preview', () => {
    const draft = candidate();
    stop();
    viewer = mountLocalRewardTeaserPreview({
      container: preview,
      teaserImage: draft.rewards.find((item) => item.id === fields.reward.value).teaserImage,
      locale: getLocale(),
      window,
    });
    status.textContent = tr('previewOnly');
  });
  async function save(remove) {
    if ((await apply(candidate(remove))) === false || disposed) return;
    sync();
    status.textContent = tr(remove ? 'removed' : 'applied');
  }
  button('apply', () => save(false));
  button('remove', () => save(true));
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  fields.reward.onchange = selected;
  function sync() {
    if (disposed) return;
    context = identity();
    const previous = fields.reward.value,
      definitions = getRewards();
    fields.reward.replaceChildren(
      ...definitions.map((item) => {
        const option = node('option', item.locales[getLocale()].title);
        option.value = item.id;
        return option;
      }),
    );
    fields.reward.value = definitions.some((item) => item.id === previous)
      ? previous
      : (definitions[0]?.id ?? '');
    root.disabled = !definitions.length;
    selected();
  }
  return {
    sync,
    dispose() {
      disposed = true;
      stop();
      fields.reward.onchange = null;
      controls.forEach((item) => (item.onclick = null));
      root.remove();
    },
  };
}
