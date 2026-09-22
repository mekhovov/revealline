import { attachJourneyBackup } from './journey-backup.mjs';
import { paintMissionThumbnail } from '../content-design/mission-card.mjs';
import { attachMissionLibraryChooser } from './mission-library-chooser.mjs';

/** One optional surface: global search and campaign filters, never a chapter drill-down. */
export function attachJourneyChooser({
  document: doc = globalThis.document,
  catalog,
  profile,
  mode = 'solo',
  onChoose,
  onPause,
  onReturn,
  getCard,
  library,
  readState,
  writeState,
}) {
  if (library) {
    const chooser = attachMissionLibraryChooser({
      document: doc,
      library,
      mode,
      onPause,
      onReturn,
      readState,
      writeState,
    });
    if (profile) {
      const button = doc.createElement('button');
      button.id = 'journey-backup-open';
      button.type = 'button';
      button.className = 'button secondary';
      button.textContent = 'Progress backup';
      const backup = attachJourneyBackup({
        document: doc,
        profile,
        onRestore: () => chooser.refresh(),
      });
      button.onclick = () => backup.open(button);
      doc.getElementById('journey-chooser').querySelector('.journey-footer').append(button);
      return {
        ...chooser,
        destroy() {
          backup.close();
          chooser.destroy();
          doc.getElementById('journey-backup')?.remove();
        },
      };
    }
    return chooser;
  }
  const dialog = doc.createElement('dialog');
  dialog.id = 'journey-chooser';
  dialog.className = 'journey-chooser';
  dialog.setAttribute('aria-labelledby', 'journey-chooser-title');
  const heading = doc.createElement('h2');
  heading.id = 'journey-chooser-title';
  heading.textContent = 'Find your next line';
  const copy = doc.createElement('p');
  copy.textContent =
    'Every mission in this test route is selectable. Choose one to play; your clears stay with you.';
  if (getCard)
    copy.textContent =
      'Choose any mission. Starting maps: light ground closes cuts; cross = launch; shapes = threats. No capture prediction.';
  const label = doc.createElement('label');
  label.textContent = 'Search all missions';
  const search = doc.createElement('input');
  search.id = 'journey-search';
  search.type = 'search';
  search.placeholder = 'Mission or campaign';
  label.append(search);
  const filterLabel = doc.createElement('label');
  filterLabel.textContent = 'Campaign';
  const filter = doc.createElement('select');
  filter.id = 'journey-campaign';
  const option = (text, value) => {
    const node = doc.createElement('option');
    node.textContent = text;
    node.value = value;
    return node;
  };
  // Composite ownership prevents identically named imported campaigns colliding.
  const campaigns = new Map();
  for (const mission of catalog.forMode(mode))
    campaigns.set(
      `${mission.source}/${mission.packId ?? '_base'}/${mission.campaignId}`,
      mission.campaignTitle,
    );
  filter.append(option('All campaigns', ''));
  filter.append(...[...campaigns].map(([key, title]) => option(title, key)));
  filter.value = '';
  filterLabel.append(filter);
  const filters = doc.createElement('div');
  filters.className = 'journey-filters';
  filters.append(label, filterLabel);
  const status = doc.createElement('p');
  status.id = 'journey-chooser-status';
  status.setAttribute('role', 'status');
  const list = doc.createElement('div');
  list.className = 'journey-cards';
  list.id = 'journey-cards';
  const back = doc.createElement('button');
  back.type = 'button';
  back.id = 'journey-back';
  back.className = 'button secondary';
  back.textContent = 'Back to game';
  const footer = doc.createElement('div');
  footer.className = 'journey-footer';
  const backupButton = doc.createElement('button');
  backupButton.id = 'journey-backup-open';
  backupButton.type = 'button';
  backupButton.className = 'button secondary';
  backupButton.textContent = 'Progress backup';
  footer.append(back, backupButton);
  dialog.append(heading, copy, filters, status, list, footer);
  doc.body.append(dialog);
  const backup = attachJourneyBackup({ document: doc, profile, onRestore: render });
  backupButton.onclick = () => backup.open(backupButton);
  let opener = null;
  function render() {
    const state = profile.snapshot();
    const matches = catalog
      .search(search.value || '', { mode })
      .filter(
        (mission) =>
          !filter.value ||
          `${mission.source}/${mission.packId ?? '_base'}/${mission.campaignId}` === filter.value,
      );
    status.textContent = `${matches.length} mission${matches.length === 1 ? '' : 's'} · ${mode === 'solo' ? 'Solo' : mode}`;
    list.replaceChildren(
      ...matches.map((mission) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'journey-card';
        button.dataset.missionId = mission.id;
        const number = doc.createElement('span');
        number.className = 'journey-card-number';
        number.textContent = String(mission.levelIndex + 1).padStart(2, '0');
        const name = doc.createElement('strong');
        name.textContent = mission.name;
        const campaign = doc.createElement('span');
        campaign.textContent = mission.campaignTitle;
        const progress = doc.createElement('span');
        progress.className = 'journey-card-progress';
        progress.textContent = Object.hasOwn(state.clears[mode], mission.id)
          ? 'Cleared'
          : state.skipped[mode].includes(mission.id)
            ? 'Skipped · try again'
            : 'Ready to play';
        button.append(number, name, campaign, progress);
        const card = getCard?.(mission);
        if (card) {
          button.classList.add('journey-card-illustrated');
          const preview = doc.createElement('canvas');
          preview.className = 'journey-card-map';
          preview.width = 288;
          preview.height = (288 * card.height) / card.width;
          preview.setAttribute('aria-hidden', 'true');
          try {
            const ctx = preview.getContext('2d');
            if (typeof ctx?.save === 'function') paintMissionThumbnail(ctx, card, preview.width);
            else preview.hidden = true;
          } catch {
            // An optional diagram cannot block mission selection or progress.
            preview.hidden = true;
          }
          const challenge = doc.createElement('span');
          challenge.className = 'journey-card-challenge';
          challenge.textContent = `Band ${card.band}/12 · ${card.preset[0].toUpperCase()}${card.preset.slice(1)}`;
          const route = doc.createElement('span');
          route.className = 'journey-card-route';
          route.textContent = card.route;
          const mastery = doc.createElement('span');
          mastery.className = 'journey-card-mastery';
          mastery.textContent = `Optional challenge: ${card.mastery}`;
          button.append(preview, challenge, route, mastery);
        }
        button.onclick = () => {
          dialog.close();
          void onChoose(mission);
        };
        return button;
      }),
    );
  }
  function close() {
    dialog.close();
    if (onReturn) onReturn(opener);
    else if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  back.onclick = close;
  dialog.addEventListener('cancel', (event) => {
    if (event.target !== dialog) return;
    event.preventDefault();
    close();
  });
  return {
    refresh() {
      if (!dialog.open) return;
      const missionId = doc.activeElement?.closest('.journey-card')?.dataset.missionId;
      render();
      if (missionId)
        [...list.children]
          .find((card) => card.dataset.missionId === missionId)
          ?.focus({ preventScroll: true });
    },
    open(origin = doc.activeElement, { returnLabel = 'Back to game' } = {}) {
      opener = origin;
      back.textContent = returnLabel;
      onPause?.();
      render();
      dialog.showModal();
      search.focus({ preventScroll: true });
    },
    close,
  };
}
