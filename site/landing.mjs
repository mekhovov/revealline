import { t, localizedText } from '../game/i18n/index.mjs';
import { contentText } from '../game/i18n/content.mjs';
import { attachAboutNavigation } from './about-navigation.mjs';
import { preparePackCatalog, packLaunchHref } from '../game/content-launch.mjs';
import { archivedPlayHrefFromCatalog, releaseHistoryHref } from './release-links.mjs';

const navigation = attachAboutNavigation();
const root = document.documentElement;
const currentVersion = root.dataset.currentVersion;
const currentLabel = () =>
  currentVersion.startsWith('__')
    ? t('website:dev')
    : currentVersion.startsWith('v')
      ? currentVersion
      : `v${currentVersion}`;
const picker = document.querySelector('#version-picker');
const versionPlay = document.querySelector('#version-play');
const status = document.querySelector('#version-status');
const packSelect = document.querySelector('#landing-pack-select');
const levelSelect = document.querySelector('#landing-level-select');
const packPlay = document.querySelector('#landing-pack-play');
const packStatus = document.querySelector('#landing-pack-status');
const historyHref = releaseHistoryHref(location.href);
const catalogIndex = new URL('index.json', historyHref);
const historyLink = document.querySelector('#release-history');
// Resolve the shared catalog before any network wait; hidden markup avoids a
// release-local fallback URL if this module never starts.
historyLink.href = historyHref;
historyLink.hidden = false;

for (const label of document.querySelectorAll('[data-current-label]')) {
  localizedText(label, currentLabel);
}
localizedText(picker.options[0], () =>
  t('website:reveallineVersionCurrent', { version: currentLabel() }),
);

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

function createOption(label, value) {
  const option = document.createElement('option');
  option.value = value;
  localizedText(option, label);
  return option;
}

function addOption(label, href) {
  const option = createOption(label, href);
  picker.append(option);
}

picker.addEventListener('change', () => {
  versionPlay.href = picker.value;
});

async function loadCatalogs() {
  try {
    const response = await fetch(catalogIndex, { cache: 'no-cache' });
    if (!navigation.current()) return;
    if (!response.ok) throw new Error('archive unavailable');
    const payload = await response.json();
    if (!navigation.current()) return;
    const fetchedCatalog = response.url || catalogIndex.href;
    const releases = Array.isArray(payload.releases) ? payload.releases : [];
    releases.sort((a, b) =>
      String(b.version).localeCompare(String(a.version), undefined, { numeric: true }),
    );
    let available = 0;
    for (const record of releases) {
      if (!record || typeof record.version !== 'string' || typeof record.play !== 'string')
        continue;
      const href =
        archivedPlayHrefFromCatalog(record.canonicalPlay, fetchedCatalog) ??
        archivedPlayHrefFromCatalog(record.play, fetchedCatalog);
      if (!href) continue;
      addOption(() => t('website:preserved', { value1: record.version }), href);
      available++;
    }
    localizedText(status, () =>
      t('website:preservedBuildStatus', {
        count: available,
        current: currentLabel(),
      }),
    );
  } catch {
    if (!navigation.current()) return;
    localizedText(status, () => t('website:theCurrentBuildIsReadyPreservedBuildsWillAppearWhen'));
  }

  if (!navigation.current()) return;
  try {
    const response = await fetch(new URL('../game/content/packs/catalog.json', import.meta.url));
    if (!navigation.current()) return;
    if (!response.ok) throw new Error('pack catalog unavailable');
    const payload = await response.json();
    if (!navigation.current()) return;
    const catalog = preparePackCatalog(payload);

    const populateLevels = () => {
      const pack = catalog.packs.find((item) => item.id === packSelect.value);
      levelSelect.replaceChildren(
        ...pack.campaigns.flatMap((campaign) => {
          const clears = savedClears(campaign);
          return campaign.levels.map((level, index) => {
            const available =
              index === 0 || clears.has(level.id) || clears.has(campaign.levels[index - 1].id);
            const option = createOption(
              () =>
                t(
                  available
                    ? 'website:quickSelector.levelAvailable'
                    : 'website:quickSelector.levelLocked',
                  {
                    number: String(index + 1).padStart(2, '0'),
                    name: contentText(level, 'name'),
                  },
                ),
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
      const option = levelSelect.selectedOptions[0];
      if (!pack || !option) return;
      const campaign = pack.campaigns.find((item) => item.id === option.dataset.campaignId);
      const level = campaign?.levels.find((item) => item.id === option.value);
      if (!level) return;
      packPlay.href = packLaunchHref('../game/', {
        packId: pack.id,
        campaignId: campaign.id,
        levelId: level.id,
        play: true,
      });
      localizedText(packStatus, () =>
        t('website:readyToInstallAndPlay', {
          value1: contentText(pack, 'name'),
          value2: contentText(level, 'name'),
        }),
      );
    };

    packSelect.replaceChildren(
      ...catalog.packs.map((pack) => {
        const option = createOption(() => contentText(pack, 'name'), pack.id);
        option.defaultSelected = option.selected = pack.id === 'fpv-arcade-r5';
        return option;
      }),
    );
    populateLevels();
    updatePackLaunch();
    packSelect.addEventListener('change', () => {
      populateLevels();
      updatePackLaunch();
    });
    levelSelect.addEventListener('change', updatePackLaunch);
  } catch {
    if (!navigation.current()) return;
    packSelect.disabled = true;
    levelSelect.disabled = true;
    localizedText(packStatus, () => t('website:quickSelectorUnavailableUseAnyPackCardBelow'));
  }
}
await loadCatalogs();
