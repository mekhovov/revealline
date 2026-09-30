import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { editDiscoveryMastery } from '../content-design/discovery-mastery.mjs';

/** Shared side-effect-free Level/Campaign and Company Studio requirement editor. */
export function createMasteryRewardEditor({ container, getSource, getRewards, getLocale, apply }) {
  const doc = container.ownerDocument,
    tr = (key) => t('tools:studio.mastery.' + key);
  const node = (tag, text) => {
    const value = doc.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const root = node('fieldset'),
    reward = node('select'),
    choices = node('fieldset'),
    status = node('p');
  root.setAttribute('data-mastery-editor', 'true');
  reward.setAttribute('data-mastery-field', 'reward');
  const label = node('label', tr('reward'));
  label.append(reward);
  choices.setAttribute('aria-label', tr('required'));
  root.append(node('legend', tr('title')), node('p', tr('help')), label, choices);
  status.setAttribute('role', 'status');
  let context,
    disposed = false,
    busy = false;
  const identity = () => dataIdentity({ source: getSource(), rewards: getRewards() });
  function selectReward() {
    const selected = getRewards().find((item) => item.id === reward.value);
    choices.replaceChildren(
      ...(selected?.requirements.missions ?? []).map((item) => {
        const label = node('label'),
          input = node('input');
        input.type = 'checkbox';
        input.value = item.missionId;
        input.checked = selected.requirements.mastery.some(
          (rule) => rule.missionId === item.missionId,
        );
        label.append(
          input,
          node(
            'span',
            getSource().missions.find((mission) => mission.id === item.missionId)?.name ??
              item.missionId,
          ),
        );
        return label;
      }),
    );
  }
  function draft() {
    required(context === identity(), 'The draft changed. Refresh optional mastery requirements.');
    return editDiscoveryMastery(
      getSource(),
      getRewards(),
      reward.value,
      [...choices.querySelectorAll('input')]
        .filter((item) => item.checked)
        .map((item) => item.value),
    );
  }
  const preview = node('button', tr('preview')),
    save = node('button', tr('apply'));
  preview.type = save.type = 'button';
  preview.setAttribute('data-mastery-action', 'preview');
  save.setAttribute('data-mastery-action', 'apply');
  preview.onclick = () => {
    if (disposed || busy) return;
    try {
      const candidate = draft().rewards.find((item) => item.id === reward.value);
      status.textContent =
        tr('previewOnly') +
        ' ' +
        candidate.requirements.mastery.map((item) => item.missionId).join(', ');
    } catch (error) {
      status.textContent = error.message;
    }
  };
  save.onclick = async () => {
    if (disposed || busy) return;
    busy = true;
    try {
      const candidate = draft();
      if ((await apply(candidate)) === false || disposed) return;
      sync();
      status.textContent = tr('applied');
    } catch (error) {
      if (!disposed) status.textContent = error.message;
    } finally {
      busy = false;
    }
  };
  root.append(preview, save, status);
  container.append(root);
  reward.onchange = selectReward;
  function sync() {
    if (disposed) return;
    context = identity();
    const previous = reward.value,
      definitions = getRewards();
    reward.replaceChildren(
      ...definitions.map((item) => {
        const option = node('option', item.locales[getLocale()].title);
        option.value = item.id;
        return option;
      }),
    );
    reward.value = definitions.some((item) => item.id === previous)
      ? previous
      : (definitions[0]?.id ?? '');
    root.disabled = !definitions.length;
    selectReward();
  }
  return {
    sync,
    dispose() {
      disposed = true;
      reward.onchange = preview.onclick = save.onclick = null;
      root.remove();
    },
  };
}
