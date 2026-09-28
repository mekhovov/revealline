import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { boundedJSON, dataIdentity, required } from '../data-json.mjs';
import { validateCompletionRewards } from '../rewards/model.mjs';
import {
  editContentDiscovery,
  projectDiscoveryPreview,
  DISCOVERY_PACING_BEATS,
  DISCOVERY_EXHIBIT_LAYOUTS,
} from '../content-design/discovery.mjs';
import { showEditorFailure } from './editor-copy.mjs';

/** Shared Level/Campaign and Company Studio controls. Import/preview never touch
 * Journey, reward receipts or storage; the supplied apply owns draft persistence. */
export function createDiscoveryEditor({ document, getSource, getMission, getRewards, apply }) {
  const $ = (id) => document.getElementById(`discovery-${id}`);
  let imported = [],
    key = null;
  const rewards = () => (getRewards ? getRewards() : imported);
  const context = () =>
    dataIdentity({ source: getSource(), missionId: getMission()?.id, rewards: rewards() });
  const refValue = (ref) => (ref ? JSON.stringify({ id: ref.id, revision: ref.revision }) : '');
  const readRef = (node) => (node.value ? JSON.parse(node.value) : null);
  function option(value, label) {
    const node = document.createElement('option');
    node.value = value;
    localizedText(node, label);
    return node;
  }
  function rewardOptions(node, scope, id, value) {
    node.replaceChildren(
      option('', localizedMessage('tools:studio.discovery.none')),
      ...rewards()
        .filter((item) => item.scope.kind === scope && item.scope.id === id)
        .map((item) =>
          option(
            refValue({ id: item.id, revision: item.revision }),
            `${item.locales.en.title} · ${item.revision}`,
          ),
        ),
    );
    const selected = refValue(value);
    if (value && ![...node.children].some((entry) => entry.value === selected))
      node.append(
        option(selected, () =>
          t('tools:studio.discovery.unavailable', { id: value.id, revision: value.revision }),
        ),
      );
    node.value = selected;
  }
  function selectCampaign() {
    const campaign = getSource().campaigns.find((item) => item.id === $('campaign').value);
    $('layout').value = campaign?.discovery?.exhibitLayout ?? '';
    rewardOptions($('finale'), 'campaign', campaign?.id, campaign?.discovery?.finaleRewardRef);
    localizedText($('result'), localizedMessage('tools:studio.discovery.prompt'));
    $('preview').replaceChildren();
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission;
    if (key === context()) return;
    key = context();
    const campaignId = $('campaign').value;
    const campaigns = getSource().campaigns.filter((item) => item.missionIds.includes(mission?.id));
    $('campaign').replaceChildren(...campaigns.map((item) => option(item.id, item.name)));
    $('campaign').value = campaigns.some((item) => item.id === campaignId)
      ? campaignId
      : (campaigns[0]?.id ?? '');
    $('beat').replaceChildren(
      option('', localizedMessage('tools:studio.discovery.none')),
      ...DISCOVERY_PACING_BEATS.map((id) =>
        option(id, localizedMessage(`tools:studio.discovery.beat.${id}`)),
      ),
    );
    $('beat').value = mission?.design.pacingBeat ?? '';
    $('layout').replaceChildren(
      option('', localizedMessage('tools:studio.discovery.none')),
      ...DISCOVERY_EXHIBIT_LAYOUTS.map((id) =>
        option(id, localizedMessage(`tools:studio.discovery.layout.${id}`)),
      ),
    );
    rewardOptions($('reward'), 'mission', mission?.id, mission?.design.rewardRef);
    selectCampaign();
  }
  function command() {
    const finaleRewardRef = readRef($('finale'));
    required(!finaleRewardRef || $('layout').value, 'Choose an exhibit layout for the finale.');
    return {
      campaignId: $('campaign').value,
      pacingBeat: $('beat').value || null,
      rewardRef: readRef($('reward')),
      discovery: $('layout').value
        ? { exhibitLayout: $('layout').value, ...(finaleRewardRef ? { finaleRewardRef } : {}) }
        : null,
    };
  }
  function draft() {
    required(key === context(), 'The draft changed. Refresh the discovery controls.');
    return editContentDiscovery(getSource(), getMission()?.id, command(), rewards());
  }
  $('form').onsubmit = (event) => {
    event.preventDefault();
    try {
      if (apply(draft()) === false) return;
      key = null;
      sync();
      localizedText($('result'), localizedMessage('tools:studio.discovery.applied'));
    } catch (error) {
      showEditorFailure($('result'), error);
    }
  };
  $('campaign').onchange = selectCampaign;
  $('show').onclick = () => {
    try {
      const preview = projectDiscoveryPreview(
        draft(),
        $('campaign').value,
        rewards(),
        $('locale').value || 'en',
      );
      const list = document.createElement('ol');
      list.className = `discovery-exhibit discovery-exhibit-${preview.layout}`;
      for (const mission of preview.missions) {
        const item = document.createElement('li');
        const heading = document.createElement('strong');
        heading.textContent = mission.name;
        const route = document.createElement('p');
        route.textContent = mission.routeDecision;
        const moment = document.createElement('p');
        moment.textContent = mission.memorableMoment;
        const beat = document.createElement('small');
        localizedText(
          beat,
          mission.pacingBeat
            ? localizedMessage(`tools:studio.discovery.beat.${mission.pacingBeat}`)
            : localizedMessage('tools:studio.discovery.none'),
        );
        item.append(heading, beat, route, moment);
        if (mission.reward) {
          const teaser = document.createElement('p');
          teaser.textContent = mission.reward.teaser;
          item.append(teaser);
        }
        list.append(item);
      }
      $('preview').replaceChildren(list);
      if (preview.finale) {
        const finale = document.createElement('p');
        finale.textContent = `${preview.finale.title}: ${preview.finale.teaser}`;
        const requirements = document.createElement('p');
        localizedText(requirements, () =>
          t('tools:studio.discovery.requirements', {
            missions: preview.finale.requirements.join(', '),
          }),
        );
        $('preview').append(finale, requirements);
      }
      localizedText($('result'), localizedMessage('tools:studio.discovery.previewOnly'));
      return preview;
    } catch (error) {
      showEditorFailure($('result'), error);
      return null;
    }
  };
  if ($('import')) {
    $('import').disabled = !!getRewards;
    $('import').onchange = async () => {
      try {
        const file = $('import').files[0];
        if (!file) return;
        required(file.size <= 8 * 1024 * 1024, 'Reward sidecar exceeds 8 MiB.');
        imported = validateCompletionRewards(
          boundedJSON(await file.text(), {
            maxBytes: 8 * 1024 * 1024,
            maxNodes: 500000,
            maxArray: 512,
          }),
        );
        key = null;
        sync();
        localizedText($('result'), localizedMessage('tools:studio.discovery.imported'));
      } catch (error) {
        showEditorFailure($('result'), error);
      }
    };
  }
  return { sync };
}
