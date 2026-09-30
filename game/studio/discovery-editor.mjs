import { createVideoRewardEditor } from './video-reward-editor.mjs';
import { createAudioGroupEditor } from './audio-group-editor.mjs';
import { rewardPresentationItems } from '../rewards/audio-groups.mjs';
import { createAudioRewardEditor } from './audio-reward-editor.mjs';
import { createAssetRewardEditor } from './asset-reward-editor.mjs';
import { createTeaserRewardEditor } from './teaser-reward-editor.mjs';
import { mountLocalRewardTeaserPreview } from './reward-teaser-preview.mjs';
import { createCampaignFeedbackEditor } from './campaign-feedback-editor.mjs';
import { mountRewardKnowledge } from '../ui/reward-knowledge.mjs';
import { createLearningProfileEditor } from './learning-profile-editor.mjs';
import { mountLocalRewardMediaPreview } from './reward-media-preview.mjs';
import { mountRewardQr } from '../ui/reward-qr.mjs';
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
import { createRewardPrintPreview } from './reward-print-preview.mjs';
import { createExplorationEditor } from './exploration-editor.mjs';
import { createResourceRewardEditor } from './resource-reward-editor.mjs';
import { createCosmeticRewardEditor } from './cosmetic-reward-editor.mjs';
import { createMasteryRewardEditor } from './mastery-reward-editor.mjs';

/** Shared Level/Campaign and Company Studio controls. Import/preview never touch
 * Journey, reward receipts or storage; the supplied apply owns draft persistence. */
export function createDiscoveryEditor({
  document,
  window = globalThis.window,
  getSource,
  getMission,
  getRewards,
  applyRewards,
  getCosmeticSource,
  apply,
}) {
  const $ = (id) => document.getElementById(`discovery-${id}`);
  let mediaPreviews = [],
    disposed = false,
    generation = 0;
  const disposeMediaPreviews = () => {
    mediaPreviews.forEach((viewer) => viewer.dispose());
    mediaPreviews = [];
  };
  function mediaPreview(reference) {
    const container = document.createElement('section');
    const reward = rewards().find(
      (item) => item.id === reference.id && item.revision === reference.revision,
    );
    if (reward?.teaserImage)
      mediaPreviews.push(
        mountLocalRewardTeaserPreview({
          container,
          teaserImage: reward.teaserImage,
          locale: $('locale').value || 'en',
          window,
        }),
      );
    for (const item of reward ? rewardPresentationItems(reward) : []) {
      const payload = item.kind === 'audio-group' ? item.group : item.payload;
      if (payload.type === 'knowledge' && payload.profiles)
        mediaPreviews.push(
          mountRewardKnowledge({ container, payload, locale: $('locale').value || 'en' }),
        );
      else if (payload.type === 'cosmetic') {
        try {
          mediaPreviews.push(cosmetics.preview(payload, container));
        } catch (error) {
          const note = document.createElement('p');
          note.textContent = error.message;
          container.append(note);
        }
      } else if (item.kind === 'audio-group' || ['audio', 'video'].includes(payload.type))
        mediaPreviews.push(
          mountLocalRewardMediaPreview({
            container,
            ...(item.kind === 'audio-group'
              ? { group: item.group, payloads: item.payloads }
              : { payload }),
            locale: $('locale').value || 'en',
            window,
          }),
        );
      else if (payload.type === 'url' && payload.qr)
        mediaPreviews.push(
          mountRewardQr({ container, payload, locale: $('locale').value || 'en' }),
        );
    }
    return container;
  }
  let imported = [],
    key = null;
  const rewards = () => (getRewards ? getRewards() : imported);
  const applyRewardCandidate = async (candidate) => {
    if (getRewards) {
      required(applyRewards, 'This host does not support editing its reward sidecar.');
      if ((await applyRewards(candidate)) === false) return false;
    } else {
      const previous = imported;
      imported = candidate.rewards;
      try {
        if ((await apply(candidate.source)) === false) {
          imported = previous;
          return false;
        }
      } catch (error) {
        imported = previous;
        throw error;
      }
    }
    key = null;
    sync();
    return true;
  };
  const sharedEditorOptions = {
    container: $('tools'),
    getSource,
    getRewards: rewards,
    getLocale: () => $('locale').value || 'en',
    apply: applyRewardCandidate,
  };
  const exploration = createExplorationEditor({
    ...sharedEditorOptions,
    window,
  });
  const resources = createResourceRewardEditor(sharedEditorOptions);
  const teasers = createTeaserRewardEditor({ ...sharedEditorOptions, window });
  const mastery = createMasteryRewardEditor(sharedEditorOptions);
  const profiles = createLearningProfileEditor(sharedEditorOptions);
  const cosmetics = createCosmeticRewardEditor({
    ...sharedEditorOptions,
    getCosmeticSource,
    window,
  });
  const assetHandoff = createAssetRewardEditor({
    ...sharedEditorOptions,
    getCosmeticSource,
    window,
  });
  const audioHandoff = createAudioRewardEditor({
    ...sharedEditorOptions,
    getCompanySource: getCosmeticSource,
    window,
  });
  const videoHandoff = createVideoRewardEditor({
    ...sharedEditorOptions,
    getCompanySource: getCosmeticSource,
    window,
  });
  const audioGroups = createAudioGroupEditor({ ...sharedEditorOptions, window });
  const feedback = createCampaignFeedbackEditor({
    container: $('tools'),
    getSource,
    getCampaignId: () => $('campaign').value,
    getLocale: () => $('locale').value || 'en',
    apply,
    window,
  });
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
    disposeMediaPreviews();
    $('preview').replaceChildren();
    feedback.sync();
  }
  function printPreview(reference) {
    const viewer = createRewardPrintPreview({
      document,
      window,
      getReward: () =>
        rewards().find((item) => item.id === reference.id && item.revision === reference.revision),
      getLocale: () => $('locale').value || 'en',
      onSaved() {
        localizedText($('result'), localizedMessage('tools:studio.discovery.printPreviewSaved'));
      },
      onError(error) {
        showEditorFailure($('result'), error);
      },
    });
    mediaPreviews.push(viewer);
    return viewer.button;
  }
  function sync() {
    if (disposed) return;
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
    exploration.sync();
    resources.sync();
    teasers.sync();
    mastery.sync();
    profiles.sync();
    cosmetics.sync();
    assetHandoff.sync();
    audioHandoff.sync();
    videoHandoff.sync();
    audioGroups.sync();
  }
  function command() {
    const finaleRewardRef = readRef($('finale')),
      existingFeedback = getSource().campaigns.find((item) => item.id === $('campaign').value)
        ?.discovery?.feedback;
    required(!finaleRewardRef || $('layout').value, 'Choose an exhibit layout for the finale.');
    return {
      campaignId: $('campaign').value,
      pacingBeat: $('beat').value || null,
      rewardRef: readRef($('reward')),
      discovery:
        $('layout').value || existingFeedback
          ? {
              exhibitLayout: $('layout').value || 'route',
              ...(finaleRewardRef ? { finaleRewardRef } : {}),
              ...(existingFeedback ? { feedback: existingFeedback } : {}),
            }
          : null,
    };
  }
  function draft() {
    required(key === context(), 'The draft changed. Refresh the discovery controls.');
    return editContentDiscovery(getSource(), getMission()?.id, command(), rewards());
  }
  $('form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      if ((await apply(draft())) === false) return;
      key = null;
      sync();
      localizedText($('result'), localizedMessage('tools:studio.discovery.applied'));
    } catch (error) {
      showEditorFailure($('result'), error);
    }
  };
  $('campaign').onchange = selectCampaign;
  $('show').onclick = () => {
    disposeMediaPreviews();
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
          item.append(teaser, printPreview(mission.reward), mediaPreview(mission.reward));
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
        $('preview').append(
          finale,
          requirements,
          printPreview(preview.finale),
          mediaPreview(preview.finale),
        );
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
      const visit = ++generation;
      if (disposed) return;
      try {
        const file = $('import').files[0];
        if (!file) return;
        required(file.size <= 8 * 1024 * 1024, 'Reward sidecar exceeds 8 MiB.');
        const candidate = validateCompletionRewards(
          boundedJSON(await file.text(), {
            maxBytes: 8 * 1024 * 1024,
            maxNodes: 500000,
            maxArray: 512,
          }),
        );
        if (disposed || visit !== generation) return;
        imported = candidate;
        key = null;
        sync();
        localizedText($('result'), localizedMessage('tools:studio.discovery.imported'));
      } catch (error) {
        if (!disposed && visit === generation) showEditorFailure($('result'), error);
      }
    };
  }
  function suspend() {
    if (disposed) return;
    generation++;
    disposeMediaPreviews();
    for (const editor of [
      exploration,
      teasers,
      cosmetics,
      assetHandoff,
      audioHandoff,
      videoHandoff,
      audioGroups,
      feedback,
    ])
      editor.suspend();
  }
  return {
    sync,
    suspend,
    dispose() {
      if (disposed) return;
      suspend();
      disposed = true;
      exploration.dispose();
      resources.dispose();
      teasers.dispose();
      mastery.dispose();
      profiles.dispose();
      cosmetics.dispose();
      assetHandoff.dispose();
      audioHandoff.dispose();
      videoHandoff.dispose();
      audioGroups.dispose();
      feedback.dispose();
    },
  };
}
