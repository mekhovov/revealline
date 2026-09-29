import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { validateStudioDraft } from '../../authoring/company-studio/model.mjs';
import {
  discoveryCosmeticContext,
  editDiscoveryCosmetic,
} from '../content-design/discovery-cosmetics.mjs';
import { mountLocalRewardCosmeticPreview } from './reward-cosmetic-preview.mjs';

/** Shared explicit character binding. The existing Company source draft is the
 * only registry import, and preview has no profile/receipt/appearance authority. */
export function createCosmeticRewardEditor({
  container,
  getSource,
  getRewards,
  getLocale,
  getCosmeticSource,
  apply,
  window = globalThis.window,
}) {
  const doc = container.ownerDocument,
    tr = (key) => t('tools:studio.cosmetic.' + key);
  const node = (tag, text) => {
    const item = doc.createElement(tag);
    if (text) item.textContent = text;
    return item;
  };
  const root = node('fieldset'),
    status = node('p'),
    preview = node('section');
  root.setAttribute('data-cosmetic-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  const fields = {
    packet: node('input'),
    edition: node('select'),
    reward: node('select'),
    payload: node('input'),
    character: node('select'),
    enTitle: node('input'),
    ukTitle: node('input'),
  };
  fields.packet.type = 'file';
  fields.packet.accept = '.json,application/json';
  for (const [key, field] of Object.entries(fields)) {
    const label = node('label', tr(key));
    field.setAttribute('data-cosmetic-field', key);
    label.append(field);
    root.append(label);
    if (getCosmeticSource && ['packet', 'edition'].includes(key)) label.hidden = true;
  }
  fields.payload.value = 'character';
  let imported,
    context,
    draftIdentity,
    viewer,
    disposed = false,
    busy = false,
    generation = 0;
  const sourceContext = () =>
    getCosmeticSource?.() ?? (imported && { ...imported, editionId: fields.edition.value });
  const identity = () => {
    const source = sourceContext();
    return dataIdentity({
      source: getSource(),
      rewards: getRewards(),
      edition: source
        ? { catalog: source.catalog, editionId: source.editionId, files: [...source.files] }
        : null,
    });
  };
  const stop = () => {
    viewer?.dispose();
    viewer = null;
    preview.replaceChildren();
  };
  function options(field, values, key, label) {
    const previous = field.value;
    field.replaceChildren(
      ...values.map((value) => {
        const option = node('option', label(value));
        option.value = key(value);
        return option;
      }),
    );
    field.value = values.some((value) => key(value) === previous)
      ? previous
      : ((values[0] && key(values[0])) ?? '');
  }
  function selected() {
    stop();
    const reward = getRewards().find((item) => item.id === fields.reward.value),
      prior = reward?.payloads.find((item) => item.type === 'cosmetic');
    fields.payload.value = prior?.id ?? 'character';
    if (prior && context?.registry.some((item) => item.recipeId === prior.recipeId))
      fields.character.value = prior.recipeId;
    for (const locale of ['en', 'uk'])
      fields[locale + 'Title'].value = prior?.locales[locale].title ?? '';
  }
  function candidate() {
    required(
      context && draftIdentity === identity(),
      'The selected edition or draft changed. Refresh cosmetic bindings.',
    );
    const recipe = context.registry.find((item) => item.recipeId === fields.character.value);
    required(recipe, 'Select an explicitly admitted reward character.');
    return editDiscoveryCosmetic(
      getSource(),
      getRewards(),
      fields.reward.value,
      {
        id: fields.payload.value,
        type: 'cosmetic',
        recipeId: recipe.recipeId,
        recipeRevision: recipe.recipeRevision,
        locales: { en: { title: fields.enTitle.value }, uk: { title: fields.ukTitle.value } },
      },
      context,
    );
  }
  const actions = [];
  function button(key, callback) {
    const button = node('button', tr(key));
    button.type = 'button';
    button.setAttribute('data-cosmetic-action', key);
    button.onclick = async () => {
      if (disposed || busy) return;
      busy = true;
      try {
        await callback();
      } catch (error) {
        if (!disposed) status.textContent = error.message;
      } finally {
        busy = false;
      }
    };
    actions.push(button);
    root.append(button);
  }
  button('preview', () => {
    const draft = candidate(),
      payload = draft.rewards
        .find((item) => item.id === fields.reward.value)
        .payloads.find((item) => item.id === fields.payload.value);
    stop();
    viewer = mountLocalRewardCosmeticPreview({
      container: preview,
      payload,
      context,
      locale: getLocale(),
      window,
    });
    status.textContent = tr('previewOnly');
  });
  button('apply', async () => {
    const draft = candidate();
    if ((await apply(draft)) === false || disposed) return;
    sync();
    status.textContent = tr('applied');
  });
  fields.packet.onchange = async () => {
    const current = ++generation;
    stop();
    try {
      const file = fields.packet.files?.[0];
      required(
        file && file.size <= 16 * 1024 * 1024,
        'Choose a bounded Company Studio source draft.',
      );
      const checked = validateStudioDraft(await file.text());
      if (disposed || current !== generation) return;
      imported = checked;
      options(
        fields.edition,
        checked.catalog.editions,
        (item) => item.id,
        (item) => item.name,
      );
      sync();
    } catch (error) {
      if (!disposed && current === generation) status.textContent = error.message;
    }
  };
  fields.edition.onchange = () => sync();
  fields.reward.onchange = selected;
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  function sync() {
    if (disposed) return;
    stop();
    try {
      const source = sourceContext();
      context = source ? discoveryCosmeticContext(source) : null;
      draftIdentity = identity();
      const eligible = getRewards().filter(
        (reward) =>
          context &&
          reward.brandId === context.selection.brand.id &&
          context.selection.edition.campaignIds.includes(reward.campaignId),
      );
      options(
        fields.reward,
        eligible,
        (item) => item.id,
        (item) => item.locales[getLocale()].title,
      );
      options(
        fields.character,
        context?.registry ?? [],
        (item) => item.recipeId,
        (item) => item.body.label,
      );
      actions.forEach(
        (button) => (button.disabled = !eligible.length || !context?.registry.length),
      );
      status.textContent = context?.registry.length ? '' : tr('empty');
      selected();
    } catch (error) {
      context = null;
      actions.forEach((button) => (button.disabled = true));
      status.textContent = error.message;
    }
  }
  return {
    sync,
    suspend() {
      generation++;
      stop();
    },
    preview(payload, container) {
      required(context, 'Select an exact Company Studio source draft for this character.');
      return mountLocalRewardCosmeticPreview({
        container,
        payload,
        context,
        locale: getLocale(),
        window,
      });
    },
    dispose() {
      disposed = true;
      generation++;
      stop();
      Object.values(fields).forEach((field) => (field.onchange = null));
      actions.forEach((button) => (button.onclick = null));
      root.remove();
    },
  };
}
