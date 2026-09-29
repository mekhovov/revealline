import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCompletionRewardPayload } from '../rewards/model.mjs';
import { LEARNING_PROFILE_IDS } from '../rewards/learning-profiles.mjs';
import { mountRewardKnowledge } from '../ui/reward-knowledge.mjs';
import { createPrintableReward } from '../rewards/printable.mjs';
import { editDiscoveryProfiles } from '../content-design/discovery-profiles.mjs';
import { createLearningProfileEditor } from '../studio/learning-profile-editor.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { Document } from './helpers/couch-dom.mjs';

const profiles = Object.fromEntries(
  LEARNING_PROFILE_IDS.map((id) => [
    id,
    Object.fromEntries(
      ['en', 'uk'].map((locale) => [
        locale,
        {
          title: `${id} ${locale}`,
          paragraphs: [`Explore ${id} ${locale} <script>not executable</script>`],
        },
      ]),
    ),
  ]),
);
function fixture() {
  const source = createStarterProject();
  const reward = createStudioReward({
    source,
    campaign: { ...source.campaigns[0], brandId: 'museum' },
    rule: 'all-missions',
    id: 'profile-finale',
    locales: {
      en: {
        title: 'Exhibit',
        teaser: 'Finale',
        paragraph: 'Base explanation and safety stay visible.',
      },
      uk: {
        title: 'Виставка',
        teaser: 'Фінал',
        paragraph: 'Основне пояснення залишається видимим.',
      },
    },
  });
  return { source, rewards: [reward] };
}
test('profiles remain additive and reject incomplete, executable or unbounded structures', () => {
  const f = fixture(),
    payload = f.rewards[0].payloads[0];
  assert.deepEqual(validateCompletionRewardPayload(payload), payload);
  assert.deepEqual(validateCompletionRewardPayload({ ...payload, profiles }).profiles, profiles);
  for (const mutate of [
    (p) => delete p.families,
    (p) => delete p.hobbyists.uk,
    (p) => (p.beginners.en.paragraphs = []),
    (p) => (p.families.en.paragraphs = Array(5).fill('too much')),
    (p) => (p.beginners.en.title = 'x'.repeat(2049)),
    (p) => (p.remote = { url: 'https://example.org' }),
  ]) {
    const bad = structuredClone(profiles);
    mutate(bad);
    assert.throws(() => validateCompletionRewardPayload({ ...payload, profiles: bad }));
  }
});
test('profile authoring preserves base knowledge, exact requirements and gameplay through JSON and printable round trip', async () => {
  const f = fixture(),
    reward = f.rewards[0],
    before = JSON.stringify(f),
    payload = reward.payloads[0];
  const result = editDiscoveryProfiles(f.source, f.rewards, reward.id, payload.id, profiles);
  assert.equal(JSON.stringify(f), before);
  assert.deepEqual(result.rewards[0].requirements, reward.requirements);
  assert.deepEqual(result.rewards[0].payloads[0].locales, payload.locales);
  assert.deepEqual(
    createRewardMissionBindings(result.source),
    createRewardMissionBindings(f.source),
  );
  assert.notEqual(result.rewards[0].revision, reward.revision);
  const portable = await createPrintableReward(JSON.parse(JSON.stringify(result.rewards[0])), {
    preview: true,
    locale: 'uk',
  });
  for (const id of LEARNING_PROFILE_IDS) assert(portable.html.includes(`${id} uk`));
  assert(!portable.html.includes('<script>'));
  assert(portable.html.includes('&lt;script&gt;'));
});
test('untimed reading choices retain essential base copy and sources without navigation or progress', () => {
  const f = fixture(),
    document = new Document(),
    container = document.createElement('section');
  const payload = structuredClone({ ...f.rewards[0].payloads[0], profiles });
  payload.locales.en.sources = [{ title: 'Source', url: 'https://example.org/source' }];
  const choices = [];
  const viewer = mountRewardKnowledge({ container, payload, onProfile: (id) => choices.push(id) });
  const select = container.querySelector('select');
  assert.equal(select.value, 'beginners');
  for (const id of LEARNING_PROFILE_IDS) {
    select.value = id;
    select.onchange();
    assert(container.textContent.includes('Base explanation'));
    assert(container.textContent.includes(`Explore ${id} en`));
    assert.equal(container.querySelector('a').href, 'https://example.org/source');
  }
  assert.deepEqual(choices, LEARNING_PROFILE_IDS);
  viewer.dispose();
  assert.equal(container.children.length, 0);
  assert.equal(select.onchange, null);
});
test('shared Studio editor retains three drafts, previews without saving and applies one exact revision', async () => {
  let current = fixture(),
    applications = 0;
  const document = new Document(),
    container = document.createElement('section');
  const editor = createLearningProfileEditor({
    container,
    getSource: () => current.source,
    getRewards: () => current.rewards,
    getLocale: () => 'en',
    apply: (candidate) => {
      current = candidate;
      applications++;
    },
  });
  editor.sync();
  const field = (name) => container.querySelector(`[data-learning-profile-field="${name}"]`);
  for (const id of LEARNING_PROFILE_IDS) {
    field('profile').value = id;
    field('profile').onchange();
    for (const locale of ['en', 'uk']) {
      field(locale + 'Title').value = profiles[id][locale].title;
      field(locale + 'Text').value = profiles[id][locale].paragraphs.join('\n\n');
    }
  }
  await container.querySelector('[data-learning-profile-action="preview"]').onclick();
  assert.equal(applications, 0);
  await container.querySelector('[data-learning-profile-action="apply"]').onclick();
  assert.equal(applications, 1);
  assert.deepEqual(current.rewards[0].payloads[0].profiles, profiles);
  editor.dispose();
  assert.equal(container.children.length, 0);
});
