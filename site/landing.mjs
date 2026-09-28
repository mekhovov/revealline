import { localizedText, t, localizedOption } from '../game/i18n/index.mjs';
import { preparePackCatalog, packLaunchHref } from '../game/content-launch.mjs';
import { archivedPlayHref } from './release-links.mjs';

const root = document.documentElement;
const currentVersion = root.dataset.currentVersion;
const currentLabel = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`;
const picker = document.querySelector('#version-picker');
const versionPlay = document.querySelector('#version-play');
const status = document.querySelector('#version-status');
const packSelect = document.querySelector('#landing-pack-select');
const levelSelect = document.querySelector('#landing-level-select');
const packPlay = document.querySelector('#landing-pack-play');
const packStatus = document.querySelector('#landing-pack-status');

const savedClears = (campaign) => {
  try {
    const version = currentVersion.replace(/^v/, '');
    const raw = localStorage.getItem(`revealline.library.release-${version}.v1`);
    if (!raw) return new Set();
    const stored = JSON.parse(raw);
    const library = stored?.format === 'xonix-library-storage.v1' ? stored.library : stored;
    if (!library || !['xonix-library.v1', 'xonix-library.v2'].includes(library.format))
      return new Set();
    const progress = Object.values(library.campaigns || {}).find(
      (entry) => entry?.campaignId === campaign.id && entry?.revision === campaign.revision,
    );
    return new Set(
      progress?.clears && typeof progress.clears === 'object' ? Object.keys(progress.clears) : [],
    );
  } catch {
    return new Set();
  }
};

function addOption(label, href) {
  const option = document.createElement('option');
  option.value = href;
  localizedText(option, () =>label);
  picker.append(option);
}

picker.addEventListener('change', () => {
  versionPlay.href = picker.value;
});

try {
  const response = await fetch('../releases/index.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('archive unavailable');
  const payload = await response.json();
  const releases = Array.isArray(payload.releases) ? payload.releases : [];
  releases.sort((a, b) =>
    String(b.version).localeCompare(String(a.version), undefined, { numeric: true }),
  );
  let available = 0;
  for (const record of releases) {
    if (!record || typeof record.version !== 'string' || typeof record.play !== 'string') continue;
    const href = archivedPlayHref(record.canonicalPlay) ?? archivedPlayHref(record.play);
    if (!href) continue;
    addOption(t("website:preserved", { value1: record.version }), href);
    available++;
  }
  localizedText(status, () =>t("website:preservedBuildRemainsTheDefault", { value1: available, value2: available === 1 ? '' : 's', value3: currentLabel }));
} catch {
  localizedText(status, () =>t("website:theCurrentBuildIsReadyPreservedBuildsWillAppearWhen"));
}

try {
  const response = await fetch(new URL('../game/content/packs/catalog.json', import.meta.url));
  if (!response.ok) throw new Error('pack catalog unavailable');
  const catalog = preparePackCatalog(await response.json());

  const populateLevels = () => {
    const pack = catalog.packs.find((item) => item.id === packSelect.value);
    levelSelect.replaceChildren(
      ...pack.campaigns.flatMap((campaign) => {
        const clears = savedClears(campaign);
        return campaign.levels.map((level, index) => {
          const available =
            index === 0 || clears.has(level.id) || clears.has(campaign.levels[index - 1].id);
          const option = localizedOption(() => `${String(index + 1).padStart(2, '0')} · ${level.name}${available ? '' : ' · locked'}`,
            level.id,
          );
          option.dataset.campaignId = campaign.id;
          option.disabled = !available;
          return option;
        });
      }),
    );
  };
  const updatePackLaunch = () => {
    const pack = catalog.packs.find((item) => item.id === packSelect.value);
    const level = levelSelect.selectedOptions[0];
    if (!pack || !level) return;
    packPlay.href = packLaunchHref('../game/', {
      packId: pack.id,
      campaignId: level.dataset.campaignId,
      levelId: level.value,
      play: true,
    });
    localizedText(packStatus, () =>t("website:readyToInstallAndPlay", { value1: pack.name, value2: level.textContent.replace(/^\d+ · /, '') }));
  };

  packSelect.replaceChildren(
    ...catalog.packs.map(
      (pack) => localizedOption(() => pack.name, pack.id, false, pack.id === 'fpv-arcade-r5'),
    ),
  );
  populateLevels();
  updatePackLaunch();
  packSelect.addEventListener('change', () => {
    populateLevels();
    updatePackLaunch();
  });
  levelSelect.addEventListener('change', updatePackLaunch);
} catch {
  packSelect.disabled = true;
  levelSelect.disabled = true;
  localizedText(packStatus, () =>t("website:quickSelectorUnavailableUseAnyPackCardBelow"));
}

for (const label of document.querySelectorAll('[data-current-label]')) {
  localizedText(label, () =>currentLabel);
}
