import { t, localizedText } from '../../game/i18n/index.mjs';
import { CURRENT_ART_SOURCES } from '../../game/presentation/current-art-sources.mjs';
import { createSceneArt, sceneDescriptor } from '../../game/ui/scene-art.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';
import { mountRevealAuditInput, attachRevealAuditReader } from './reveal-audit-input.mjs';

const doc = document,
  win = window;
const status = doc.querySelector('#status');
const reload = doc.querySelector('#reveal-reload'),
  cancel = doc.querySelector('#reveal-cancel');
const rasters = doc.querySelector('#rasters'),
  procedures = doc.querySelector('#procedures');
let task = null,
  published = 0,
  disposed = false,
  readers = [];
const foreground = () => !doc.hidden && doc.hasFocus();
const el = (tag, text, className) => {
  const node = doc.createElement(tag);
  if (typeof text === 'function') localizedText(node, text);
  else if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const show = (text, error = false) => {
  status.dataset.error = String(error);
  localizedText(status, text);
};
status.removeAttribute('data-i18n');
localizedText(reload, () => t('tools:retryLoadingStudy'));
localizedText(cancel, () => t('common:actions.cancel'));
setMenuIcon(reload, 'content');
setMenuIcon(cancel, 'back');
function retire({ announce = true, restore = false } = {}) {
  if (!task) return false;
  task.controller.abort();
  task = null;
  if (restore && foreground() && doc.activeElement === cancel) reload.focus();
  cancel.disabled = true;
  cancel.hidden = true;
  if (announce) show(() => t('tools:revealAuditCancelled'));
  return true;
}
const owner = mountRevealAuditInput(doc, win, () => retire({ restore: true }));
const sectionReaders = [
  attachRevealAuditReader({
    navigation: owner.navigation,
    region: rasters,
    id: 'rasters',
    label: () => t('tools:rasterOriginals'),
  }),
  attachRevealAuditReader({
    navigation: owner.navigation,
    region: procedures,
    id: 'procedures',
    label: () => t('tools:currentProceduralScenes'),
  }),
];
const size = ({ width, height }) => `${width} × ${height}`;
function ownerList(owners, id, title, nextReaders) {
  const details = el('details');
  details.id = `reveal-owners-${id}`;
  const summary = el(
    'summary',
    `${owners.length} exact owner${owners.length === 1 ? '' : 's'} and export frames`,
  );
  summary.id = `${details.id}-summary`;
  details.append(summary);
  const list = el('ul', '', 'owners');
  list.id = `reveal-${id}-owners-region`;
  for (const item of owners) {
    const li = el('li');
    li.append(
      el('strong', item.label),
      el(
        'p',
        `${item.sourceKind} · New frame ${size(item.slotDimensions)} · ${item.classification}`,
      ),
      el(
        'code',
        `${item.id}\n${item.owner.baseCampaignKey} / ${item.owner.levelId} / ${item.owner.levelRevision}`,
      ),
    );
    list.append(li);
  }
  details.append(list);
  nextReaders.push({ region: list, id: `${id}-owners`, label: () => title });
  return details;
}
function stage(audit, generation) {
  if (
    audit?.format !== 'fpv-reveal-art-audit.v1' ||
    !Array.isArray(audit.images) ||
    !Array.isArray(audit.procedural) ||
    audit.images.length !== audit.counts?.uniqueRasterHashes ||
    audit.procedural.length !== audit.counts?.proceduralOwners ||
    audit.images.reduce((n, entry) => n + entry.owners.length, audit.procedural.length) !==
      audit.counts?.fpvOwners
  )
    throw new Error('The historical audit inventory is incomplete.');
  const originals = new Map(CURRENT_ART_SOURCES.map((entry) => [entry.id, entry]));
  const nextReaders = [];
  const images = audit.images.map((entry, index) => {
    const id = `raster-${index + 1}`,
      title = `${String(entry.index).padStart(2, '0')} · ${entry.subject}`;
    const article = el('article'),
      heading = el('h3', title);
    heading.dataset.authoringTarget = `reveal-owners-${id}-summary`;
    article.append(
      el('span', () => t('tools:needsReplacementOriginalPreserved'), 'tag'),
      heading,
    );
    const box = el('div', '', 'image'),
      img = el('img');
    img.alt = `Existing ${entry.subject} source illustration`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = entry.image.width;
    img.height = entry.image.height;
    img.addEventListener(
      'error',
      () => {
        if (!disposed && published === generation && article.isConnected)
          box.replaceChildren(
            el('p', () => t('tools:originalUnavailableHereOpenThisAtlasFromItsSourceCheckout')),
          );
      },
      { once: true },
    );
    img.src = `../../${entry.path}`;
    box.append(img);
    const link = el('a', () => t('tools:openUnchangedSourcePng'));
    link.href = img.src;
    article.append(
      box,
      el('p', `${size(entry.image)} source · ${entry.owners.length} exact owners`, 'meta'),
      el('p', entry.reason),
      link,
      ownerList(entry.owners, id, title, nextReaders),
    );
    return article;
  });
  const scenes = audit.procedural.map((entry, index) => {
    const source = originals.get(entry.id),
      id = `procedural-${index + 1}`,
      title = entry.label.replace(' · FPV Front', '');
    const article = el('article', '', 'procedure'),
      heading = el('h3', title);
    heading.dataset.authoringTarget = `reveal-owners-${id}-summary`;
    article.append(
      el('span', () => t('tools:needsMissionSpecificComposition'), 'tag'),
      heading,
    );
    const box = el('div', '', 'image');
    if (
      source?.kind === 'procedural' &&
      JSON.stringify(sceneDescriptor(source.theme, source.level, 0)) ===
        JSON.stringify(entry.descriptor)
    ) {
      const canvas = createSceneArt(source.theme, source.level, 0);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${entry.label}: recorded dawn village scene, seed 0`);
      box.append(canvas);
    } else
      box.append(
        el('p', () => t('tools:originalUnavailableHereOpenThisAtlasFromItsSourceCheckout')),
      );
    article.append(
      box,
      el(
        'p',
        `${size(entry.dimensions)} native source · seed 0 · variant ${entry.descriptor.variant}`,
        'meta',
      ),
      el('p', `Proposed subject: ${entry.proposedSubject}.`),
      ownerList([entry], id, title, nextReaders),
    );
    return article;
  });
  return { images, scenes, nextReaders };
}
let generation = 0;
async function load(explicit = false) {
  retire({ announce: false });
  const current = { controller: new AbortController(), generation: ++generation };
  task = current;
  cancel.disabled = false;
  cancel.hidden = false;
  if (explicit && foreground() && doc.activeElement === reload) cancel.focus();
  show(() => t('tools:loadingTheAudit'));
  const valid = () => !disposed && task === current && !current.controller.signal.aborted;
  try {
    const response = await fetch('./reveal-audit.json', { signal: current.controller.signal });
    if (!valid()) return;
    if (!response.ok) throw new Error(`Audit inventory unavailable (${response.status}).`);
    const audit = await response.json();
    if (!valid()) return;
    const result = stage(audit, current.generation);
    if (!valid()) return;
    owner.navigation.endReading({ restoreFocus: false });
    readers.forEach((reader) => reader.destroy());
    rasters.replaceChildren(...result.images);
    procedures.replaceChildren(...result.scenes);
    published = current.generation;
    readers = result.nextReaders.map((options) =>
      attachRevealAuditReader({ navigation: owner.navigation, ...options }),
    );
    show(() =>
      t('tools:revealAuditSummary', {
        owners: audit.counts.fpvOwners,
        rasters: audit.counts.uniqueRasterHashes,
        procedural: audit.counts.proceduralOwners,
      }),
    );
  } catch (error) {
    if (valid()) show(() => t('tools:revealAuditUnavailable', { reason: error.message }), true);
  } finally {
    if (task === current) {
      task = null;
      if (foreground() && doc.activeElement === cancel) reload.focus();
      cancel.disabled = true;
      cancel.hidden = true;
    }
  }
}
reload.onclick = () => {
  void load(true);
};
cancel.onclick = () => retire({ restore: true });
const interaction = (event) => {
  if (!task || !published || reload.contains(event.target) || cancel.contains(event.target)) return;
  retire();
};
const blur = () => retire();
const visibility = () => {
  if (doc.hidden) retire();
};
const pagehide = (event) => {
  retire();
  owner.navigation.endReading({ restoreFocus: false });
  if (event.persisted) return;
  disposed = true;
  readers.forEach((reader) => reader.destroy());
  sectionReaders.forEach((reader) => reader.destroy());
  owner.destroy();
  reload.onclick = cancel.onclick = null;
  for (const name of [
    'focusin',
    'pointerdown',
    'touchstart',
    'wheel',
    'keydown',
    'input',
    'change',
  ])
    doc.removeEventListener(name, interaction, true);
  doc.removeEventListener('visibilitychange', visibility);
  win.removeEventListener('blur', blur);
  win.removeEventListener('pagehide', pagehide);
};
for (const name of ['focusin', 'pointerdown', 'touchstart', 'wheel', 'keydown', 'input', 'change'])
  doc.addEventListener(name, interaction, true);
doc.addEventListener('visibilitychange', visibility);
win.addEventListener('blur', blur);
win.addEventListener('pagehide', pagehide);
void load();
