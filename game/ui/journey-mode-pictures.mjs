import { journeyPictureCompletion } from '../journey/pictures.mjs';
import { createJourneyArtworkView } from './journey-artwork.mjs';

const labels = Object.freeze({ versus: 'Versus', team: 'Team' });

/** A mode-local view of authenticated Journey originals. It reads the shared
 * presentation ledger but cannot award, replay or launch a mission. */
export function attachJourneyModePictures({
  document: doc = globalThis.document,
  button,
  mode,
  editionId,
  catalog,
  profile,
}) {
  if (!labels[mode] || !button || !editionId || !catalog || !profile)
    throw new TypeError('Journey pictures need an exact mode, edition, catalogue and profile.');
  const make = (tag, text = '') => {
    const element = doc.createElement(tag);
    element.textContent = text;
    return element;
  };
  const dialog = make('dialog');
  dialog.id = `${mode}-journey-pictures`;
  dialog.className = 'journey-mode-pictures';
  dialog.dataset.journeyModePictures = mode;
  dialog.setAttribute('aria-labelledby', `${dialog.id}-title`);
  const heading = make('header');
  const title = make('h2', `${labels[mode]} Journey pictures`);
  title.id = `${dialog.id}-title`;
  const close = make('button', 'Back');
  close.type = 'button';
  heading.append(title, close);
  const status = make('p', 'Loading Journey pictures…');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const grid = make('div');
  grid.className = 'journey-mode-picture-grid';
  const viewer = make('section');
  viewer.className = 'journey-mode-picture-viewer';
  viewer.hidden = true;
  const viewTitle = make('h3');
  const canvas = make('canvas');
  canvas.width = 960;
  canvas.setAttribute('role', 'img');
  const viewStatus = make('p');
  viewStatus.setAttribute('role', 'status');
  const retry = make('button', 'Retry original download');
  retry.type = 'button';
  const back = make('button', 'Back to pictures');
  back.type = 'button';
  viewer.append(viewTitle, canvas, viewStatus, retry, back);
  dialog.append(heading, status, grid, viewer);
  doc.body.append(dialog);
  const artwork = createJourneyArtworkView({ canvas, status: viewStatus });
  let disposed = false,
    revision = 0,
    opener = null,
    selected = null;

  function restore() {
    if (opener && !opener.disabled) opener.focus({ preventScroll: true });
  }
  function closeDialog({ restoreFocus = true } = {}) {
    revision++;
    artwork.release();
    selected = null;
    viewer.hidden = true;
    grid.hidden = false;
    if (dialog.open) dialog.close();
    if (restoreFocus) restore();
  }
  async function showSelected() {
    if (!selected || !dialog.open || viewer.hidden) return false;
    retry.hidden = true;
    const record = selected,
      loaded = await artwork.show(record);
    if (!disposed && dialog.open && selected === record && !viewer.hidden) retry.hidden = loaded;
    return loaded;
  }
  function showRecord(record, origin) {
    artwork.release();
    selected = record;
    grid.hidden = true;
    viewer.hidden = false;
    viewTitle.textContent = record.name;
    canvas.setAttribute('aria-label', record.asset.alt);
    back.dataset.returnId = origin.dataset.pictureId;
    back.focus({ preventScroll: true });
    void showSelected();
  }
  function showGrid() {
    artwork.release();
    selected = null;
    viewer.hidden = true;
    grid.hidden = false;
    const origin = grid.querySelector(`[data-picture-id="${back.dataset.returnId || ''}"]`);
    (origin ?? close).focus({ preventScroll: true });
  }
  function render() {
    const state = profile.snapshot(),
      pictures = profile.pictures(),
      missions = catalog.forMode(mode),
      known = new Set(missions.map((mission) => mission.id)),
      entries = pictures.records
        .filter((record) => record.mode === mode && record.editionId === editionId)
        .map((record) => ({ ...record, record }));
    for (const mission of missions) {
      const completion = journeyPictureCompletion({
        profile: state,
        pictures,
        mode,
        editionId,
        missionId: mission.id,
      });
      if (completion.state === 'unavailable')
        entries.push({ ...mission, missionId: mission.id, reason: completion.reason });
    }
    for (const missionId of Object.keys(state.clears[mode] ?? {}))
      if (!known.has(missionId) && !entries.some((entry) => entry.missionId === missionId))
        entries.push({
          missionId,
          name: 'Earlier Journey mission',
          campaignTitle: 'Earlier edition',
          reason:
            'Original unavailable. Keep your progress backup and reopen its original game edition.',
        });
    grid.replaceChildren();
    for (const [index, entry] of entries.entries()) {
      const card = make('article');
      card.className = 'journey-mode-picture-card';
      card.dataset.missionId = entry.missionId;
      card.append(make('h3', entry.name), make('p', entry.campaignTitle));
      if (entry.record) {
        const view = make('button', 'View earned original');
        view.type = 'button';
        view.dataset.pictureId = `${index}`;
        view.onclick = () => showRecord(entry.record, view);
        card.append(view);
      } else card.append(make('p', entry.reason));
      grid.append(card);
    }
    const earned = entries.filter((entry) => entry.record).length;
    status.textContent = entries.length
      ? `${earned} earned ${labels[mode]} original${earned === 1 ? '' : 's'}. This view does not award progress or start a mission.`
      : `Complete a ${labels[mode]} Journey mission to earn its original picture.`;
  }
  async function open(origin = button) {
    if (disposed || dialog.open) return false;
    const ticket = ++revision;
    opener = origin;
    status.textContent = 'Loading Journey pictures…';
    grid.replaceChildren();
    viewer.hidden = true;
    grid.hidden = false;
    dialog.showModal();
    close.focus({ preventScroll: true });
    await Promise.resolve();
    if (disposed || ticket !== revision || !dialog.open) return false;
    try {
      render();
    } catch (error) {
      status.textContent = `Journey pictures could not load. Close and reopen to retry. ${error.message}`;
    }
    return true;
  }
  close.onclick = () => closeDialog();
  back.onclick = showGrid;
  retry.onclick = () => void showSelected();
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener('close', () => artwork.release());
  button.hidden = false;
  button.onclick = () => void open(button);

  return Object.freeze({
    root: () => (dialog.open ? dialog : null),
    primary: () => (viewer.hidden ? close : back),
    open,
    close: closeDialog,
    dispose() {
      if (disposed) return;
      disposed = true;
      button.onclick = null;
      closeDialog({ restoreFocus: false });
      dialog.remove();
    },
  });
}
