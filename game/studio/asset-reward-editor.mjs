import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { validateStudioDraft } from '../../authoring/company-studio/model.mjs';
import {
  rewardAssetHandoffContext,
  inspectDiscoveryAssetHandoff,
  editDiscoveryAssetHandoff,
} from '../content-design/discovery-asset-handoff.mjs';
import { discoveryCosmeticContext } from '../content-design/discovery-cosmetics.mjs';
import { loadRewardImage } from '../ui/reward-image.mjs';
import { mountRewardCosmetic } from '../ui/reward-cosmetic.mjs';

/** A file + existing Company source packet handoff. No asset approval, asset
 * store, network fetch, receipt or player appearance authority is introduced. */
export function createAssetRewardEditor({
  container,
  getSource,
  getRewards,
  getLocale,
  getCosmeticSource,
  apply,
  window = globalThis.window,
}) {
  const doc = container.ownerDocument,
    tr = (key) => t('tools:studio.assetHandoff.' + key);
  const node = (tag, text) => {
    const n = doc.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const root = node('fieldset'),
    status = node('p'),
    preview = node('section');
  root.setAttribute('data-asset-handoff-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  const fields = {
    packet: node('input'),
    edition: node('select'),
    reward: node('select'),
    purpose: node('select'),
    file: node('input'),
    asset: node('select'),
    recipe: node('select'),
    payloadId: node('input'),
    enTitle: node('input'),
    ukTitle: node('input'),
    enAlt: node('input'),
    ukAlt: node('input'),
  };
  const labels = {};
  for (const [key, field] of Object.entries(fields)) {
    const label = node('label', tr(key));
    labels[key] = label;
    field.setAttribute('data-asset-handoff-field', key);
    label.append(field);
    root.append(label);
  }
  fields.packet.type = fields.file.type = 'file';
  fields.packet.accept = '.json,application/json';
  fields.file.accept = '.png,.jpg,.jpeg,.webp';
  if (getCosmeticSource) labels.packet.hidden = labels.edition.hidden = true;
  for (const id of ['teaser', 'image', 'cosmetic']) {
    const option = node('option', tr(id));
    option.value = id;
    fields.purpose.append(option);
  }
  fields.purpose.value = 'teaser';
  let imported = null,
    inspected = null,
    inspectedDraft = null,
    disposed = false,
    generation = 0,
    controller = null,
    viewer = null,
    busy = false;
  const urls = new Set(),
    actions = [];
  const sourceContext = () =>
    getCosmeticSource?.() ?? (imported && { ...imported, editionId: fields.edition.value });
  const identity = () => {
    const value = sourceContext();
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
    const source = sourceContext(),
      reward = getRewards().find((item) => item.id === fields.reward.value);
    required(source && reward, 'Choose an owning Company source draft and reward first.');
    return rewardAssetHandoffContext(source, reward.campaignId);
  };
  function stopPreview() {
    viewer?.dispose();
    viewer = null;
    for (const url of urls) window.URL.revokeObjectURL(url);
    urls.clear();
    preview.replaceChildren();
  }
  function invalidate() {
    generation++;
    controller?.abort();
    controller = null;
    inspected = inspectedDraft = null;
    stopPreview();
    fields.asset.replaceChildren();
    fields.recipe.replaceChildren();
    refreshButtons();
  }
  function options(field, values, key, label, blank = false) {
    const old = field.value,
      list = values.map((value) => {
        const option = node('option', label(value));
        option.value = key(value);
        return option;
      });
    if (blank) {
      const option = node('option', tr('choose'));
      option.value = '';
      list.unshift(option);
    }
    field.replaceChildren(...list);
    field.value = values.some((value) => key(value) === old)
      ? old
      : blank
        ? ''
        : values[0]
          ? key(values[0])
          : '';
  }
  function visibility() {
    const purpose = fields.purpose.value;
    labels.recipe.hidden = purpose !== 'cosmetic';
    labels.payloadId.hidden = purpose === 'teaser';
    for (const locale of ['en', 'uk']) {
      labels[locale + 'Title'].hidden = purpose === 'teaser';
      labels[locale + 'Alt'].hidden = purpose === 'cosmetic';
    }
  }
  function refreshButtons() {
    for (const [key, button] of actions)
      button.disabled = busy || disposed || (key !== 'inspect' && !inspected);
  }
  function chooseAsset() {
    stopPreview();
    options(
      fields.recipe,
      inspected?.recipes.filter((item) => item.image?.assetId === fields.asset.value) ?? [],
      (item) => item.recipeId,
      (item) => item.body.label,
      true,
    );
  }
  function draft() {
    required(
      inspected && inspectedDraft === identity(),
      'The draft changed. Inspect the original again.',
    );
    return editDiscoveryAssetHandoff(
      getSource(),
      getRewards(),
      fields.reward.value,
      context(),
      inspected,
      {
        assetId: fields.asset.value,
        recipeId: fields.recipe.value,
        payloadId: fields.payloadId.value,
        locales: {
          en: { title: fields.enTitle.value, alt: fields.enAlt.value },
          uk: { title: fields.ukTitle.value, alt: fields.ukAlt.value },
        },
      },
    );
  }
  function button(key, callback) {
    const n = node('button', tr(key));
    n.type = 'button';
    n.setAttribute('data-asset-handoff-action', key);
    n.onclick = async () => {
      if (disposed || busy) return false;
      if (key === 'inspect') invalidate();
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
    actions.push([key, n]);
    root.append(n);
  }
  button('inspect', async () => {
    const current = generation,
      snapshot = identity(),
      ctx = context(),
      purpose = fields.purpose.value;
    controller = new AbortController();
    const result = await inspectDiscoveryAssetHandoff(ctx, fields.file.files?.[0], purpose, {
      signal: controller.signal,
    });
    if (disposed || current !== generation || identity() !== snapshot) return;
    inspected = result;
    inspectedDraft = snapshot;
    options(
      fields.asset,
      result.matches,
      (item) => item.id,
      (item) => item.id,
      true,
    );
    chooseAsset();
    status.textContent = tr('verified');
  });
  button('preview', async () => {
    const candidate = draft(),
      current = generation,
      evidence = inspected,
      reward = candidate.rewards.find((item) => item.id === fields.reward.value);
    stopPreview();
    controller?.abort();
    controller = new AbortController();
    const asset = evidence.matches.find((item) => item.id === fields.asset.value);
    const readLocalAsset = async () => ({ asset, bytes: evidence.bytes });
    if (evidence.purpose === 'cosmetic') {
      viewer = mountRewardCosmetic({
        container: preview,
        payload: reward.payloads.find((item) => item.id === fields.payloadId.value),
        registry: discoveryCosmeticContext(sourceContext()).registry,
        locale: getLocale(),
        preview: true,
        window,
        signal: controller.signal,
        readLocalAsset,
      });
    } else
      await loadRewardImage({
        container: preview,
        image:
          evidence.purpose === 'teaser'
            ? reward.teaserImage
            : reward.payloads.find((item) => item.id === fields.payloadId.value),
        locale: getLocale(),
        signal: controller.signal,
        isCurrent: () => !disposed && current === generation,
        urls,
        URLImpl: window.URL,
        readLocalAsset,
        missingLabel: tr('unavailable'),
      });
    if (!disposed && current === generation) status.textContent = tr('previewOnly');
  });
  button('apply', async () => {
    const candidate = draft();
    if ((await apply(candidate)) === false || disposed) return;
    sync();
    status.textContent = tr('applied');
  });
  fields.packet.onchange = async () => {
    invalidate();
    const current = generation;
    try {
      const file = fields.packet.files?.[0];
      required(
        file && file.size <= 16 * 1024 * 1024,
        'Choose a bounded Company Studio source draft.',
      );
      const value = validateStudioDraft(await file.text());
      if (disposed || current !== generation) return;
      imported = value;
      options(
        fields.edition,
        value.catalog.editions,
        (item) => item.id,
        (item) => item.name,
      );
      sync();
    } catch (error) {
      if (!disposed && current === generation) status.textContent = error.message;
    }
  };
  fields.edition.onchange = () => sync();
  fields.reward.onchange = fields.file.onchange = () => invalidate();
  fields.purpose.onchange = () => {
    invalidate();
    visibility();
  };
  fields.asset.onchange = chooseAsset;
  for (const key of ['recipe', 'payloadId', 'enTitle', 'ukTitle', 'enAlt', 'ukAlt'])
    fields[key].oninput = fields[key].onchange = () => {
      controller?.abort();
      stopPreview();
    };
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  function sync() {
    if (disposed) return;
    invalidate();
    const owner = sourceContext();
    options(
      fields.reward,
      getRewards().filter(
        (item) =>
          !owner ||
          owner.catalog.editions
            .find((edition) => edition.id === owner.editionId)
            ?.campaignIds.includes(item.campaignId),
      ),
      (item) => item.id,
      (item) => item.locales[getLocale()].title,
    );
    visibility();
    refreshButtons();
  }
  return {
    sync,
    suspend() {
      if (disposed) return;
      generation++;
      controller?.abort();
      controller = null;
      stopPreview();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      invalidate();
      Object.values(fields).forEach((field) => (field.onchange = field.oninput = null));
      actions.forEach(([, n]) => (n.onclick = null));
      root.remove();
    },
  };
}
