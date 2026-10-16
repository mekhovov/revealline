import { dataIdentity, required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { editDiscoveryProfiles } from '../content-design/discovery-profiles.mjs';
import { LEARNING_PROFILE_IDS, LEARNING_PROFILE_LABELS } from '../rewards/learning-profiles.mjs';
import { mountRewardKnowledge } from '../ui/reward-knowledge.mjs';

/** Three bounded, bilingual reading variations share one reward and its source
 * facts. Preview has no completion or persistence capability. */
export function createLearningProfileEditor({
  container,
  getSource,
  getRewards,
  apply,
  getLocale,
}) {
  const doc = container.ownerDocument;
  const tr = (key) => t('tools:studio.profiles.' + key);
  const node = (tag, text) => {
    const value = doc.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const root = node('fieldset'),
    reward = node('select'),
    payload = node('select'),
    profile = node('select'),
    status = node('p'),
    preview = node('section');
  root.setAttribute('data-learning-profile-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  const fields = {
    reward,
    payload,
    profile,
    enTitle: node('input'),
    enText: node('textarea'),
    ukTitle: node('input'),
    ukText: node('textarea'),
  };
  for (const [key, field] of Object.entries(fields)) {
    const label = node('label', tr(key));
    field.setAttribute('data-learning-profile-field', key);
    label.append(field);
    root.append(label);
  }
  for (const id of LEARNING_PROFILE_IDS) {
    const option = node('option', LEARNING_PROFILE_LABELS[getLocale()][id]);
    option.value = id;
    profile.append(option);
  }
  profile.value = 'beginners';
  let context,
    draft,
    selectedProfile = 'beginners',
    disposed = false,
    busy = false,
    viewer;
  const identity = () => dataIdentity({ source: getSource(), rewards: getRewards() });
  const stop = () => {
    viewer?.dispose();
    viewer = null;
    preview.replaceChildren();
  };
  const original = () =>
    getRewards()
      .find((item) => item.id === reward.value)
      ?.payloads.find((item) => item.id === payload.value);
  function readFields() {
    if (!draft) return;
    draft[selectedProfile] = Object.fromEntries(
      ['en', 'uk'].map((locale) => [
        locale,
        {
          title: fields[locale + 'Title'].value,
          paragraphs: fields[locale + 'Text'].value
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
        },
      ]),
    );
  }
  function showProfile() {
    selectedProfile = profile.value;
    const copy = draft?.[selectedProfile];
    for (const locale of ['en', 'uk']) {
      fields[locale + 'Title'].value = copy?.[locale].title ?? '';
      fields[locale + 'Text'].value = copy?.[locale].paragraphs.join('\n\n') ?? '';
    }
  }
  function loadPayload() {
    stop();
    const value = original();
    draft = value
      ? structuredClone(
          value.profiles ??
            Object.fromEntries(
              LEARNING_PROFILE_IDS.map((id) => [
                id,
                Object.fromEntries(
                  ['en', 'uk'].map((locale) => [locale, { title: '', paragraphs: [] }]),
                ),
              ]),
            ),
        )
      : null;
    showProfile();
  }
  function loadReward() {
    const options =
      getRewards()
        .find((item) => item.id === reward.value)
        ?.payloads.filter((item) => item.type === 'knowledge') ?? [];
    payload.replaceChildren(
      ...options.map((item) => {
        const option = node('option', item.locales[getLocale()].title);
        option.value = item.id;
        return option;
      }),
    );
    payload.value = options[0]?.id ?? '';
    loadPayload();
  }
  function read() {
    readFields();
    required(context === identity(), 'The draft changed. Refresh the reading profile editor.');
    return editDiscoveryProfiles(getSource(), getRewards(), reward.value, payload.value, draft);
  }
  const controls = [];
  function button(key, action) {
    const button = node('button', tr(key));
    button.type = 'button';
    button.setAttribute('data-learning-profile-action', key);
    button.onclick = async () => {
      if (disposed || busy) return;
      busy = true;
      root.disabled = true;
      try {
        await action();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
        if (!disposed)
          root.disabled = !getRewards().some((item) =>
            item.payloads.some((payload) => payload.type === 'knowledge'),
          );
      }
    };
    controls.push(button);
    root.append(button);
  }
  button('preview', () => {
    const candidate = read();
    stop();
    const value = candidate.rewards
      .find((item) => item.id === reward.value)
      .payloads.find((item) => item.id === payload.value);
    viewer = mountRewardKnowledge({
      container: preview,
      payload: value,
      locale: getLocale(),
      initialProfile: profile.value,
    });
    status.textContent = tr('previewOnly');
  });
  button('apply', async () => {
    const candidate = read();
    if ((await apply(candidate)) === false || disposed) return;
    sync();
    status.textContent = tr('applied');
  });
  reward.onchange = loadReward;
  payload.onchange = loadPayload;
  profile.onchange = () => {
    readFields();
    showProfile();
    stop();
  };
  status.setAttribute('role', 'status');
  root.append(status, preview);
  container.append(root);
  function sync() {
    if (disposed) return;
    context = identity();
    const previous = reward.value,
      definitions = getRewards().filter((item) =>
        item.payloads.some((payload) => payload.type === 'knowledge'),
      );
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
    loadReward();
  }
  return {
    sync,
    dispose() {
      disposed = true;
      stop();
      reward.onchange = payload.onchange = profile.onchange = null;
      controls.forEach((button) => (button.onclick = null));
      root.remove();
    },
  };
}
