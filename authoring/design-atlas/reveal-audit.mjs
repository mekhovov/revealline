import { t, localizedText } from '../../game/i18n/index.mjs';
import { CURRENT_ART_SOURCES } from '../../game/presentation/current-art-sources.mjs';
import { createSceneArt } from '../../game/ui/scene-art.mjs';

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) localizedText(node, () =>text);
  if (className) node.className = className;
  return node;
};
const size = ({ width, height }) => `${width} × ${height}`;
const ownerList = (owners) => {
  const details = el('details');
  details.append(
    el(
      'summary',
      `${owners.length} exact owner${owners.length === 1 ? '' : 's'} and export frames`,
    ),
  );
  const list = el('ul', '', 'owners');
  for (const owner of owners) {
    const li = el('li');
    li.append(
      el('strong', owner.label),
      el(
        'p',
        `${owner.sourceKind} · New frame ${size(owner.slotDimensions)} · ${owner.classification}`,
      ),
    );
    li.append(
      el(
        'code',
        `${owner.id}\n${owner.owner.baseCampaignKey} / ${owner.owner.levelId} / ${owner.owner.levelRevision}`,
      ),
    );
    list.append(li);
  }
  details.append(list);
  return details;
};
try {
  const response = await fetch('./reveal-audit.json');
  if (!response.ok) throw new Error(`Audit inventory unavailable (${response.status}).`);
  const audit = await response.json();
  const originals = new Map(CURRENT_ART_SOURCES.map((entry) => [entry.id, entry]));
  for (const entry of audit.images) {
    const article = el('article');
    article.append(el('span', t("tools:needsReplacementOriginalPreserved"), 'tag'));
    article.append(el('h3', `${String(entry.index).padStart(2, '0')} · ${entry.subject}`));
    const box = el('div', '', 'image');
    const img = document.createElement('img');
    img.alt = `Existing ${entry.subject} source illustration`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = entry.image.width;
    img.height = entry.image.height;
    img.addEventListener(
      'error',
      () => {
        box.replaceChildren(
          el(
            'p',
            t("tools:originalUnavailableHereOpenThisAtlasFromItsSourceCheckout"),
          ),
        );
      },
      { once: true },
    );
    img.src = `../../${entry.path}`;
    box.append(img);
    const link = el('a', t("tools:openUnchangedSourcePng"));
    link.href = img.src;
    article.append(
      box,
      el('p', `${size(entry.image)} source · ${entry.owners.length} exact owners`, 'meta'),
      el('p', entry.reason),
      link,
      ownerList(entry.owners),
    );
    document.querySelector('#rasters').append(article);
  }
  for (const entry of audit.procedural) {
    const source = originals.get(entry.id);
    if (!source || source.kind !== 'procedural')
      throw new Error(`Procedural owner no longer matches the audit: ${entry.id}`);
    const article = el('article', '', 'procedure');
    article.append(
      el('span', t("tools:needsMissionSpecificComposition"), 'tag'),
      el('h3', entry.label.replace(' · FPV Front', '')),
    );
    const box = el('div', '', 'image');
    const canvas = createSceneArt(source.theme, source.level, 0);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${entry.label}: original dawn village scene, seed 0`);
    box.append(canvas);
    article.append(
      box,
      el(
        'p',
        `${size(entry.dimensions)} native source · seed 0 · variant ${entry.descriptor.variant}`,
        'meta',
      ),
      el('p', `Proposed subject: ${entry.proposedSubject}.`),
      ownerList([entry]),
    );
    document.querySelector('#procedures').append(article);
  }
  localizedText(document.querySelector('#status'), () =>`${audit.counts.fpvOwners} exact owners · ${audit.counts.uniqueRasterHashes} raster originals · ${audit.counts.proceduralOwners} procedural scenes · proposed ${audit.counts.newCompositions} distinct new compositions / ${audit.counts.newExactFrameExports} exact frame exports.`);
} catch (error) {
  const status = document.querySelector('#status');
  status.dataset.error = 'true';
  localizedText(status, () =>`${error.message} Reload after restoring the matching source checkout.`);
}
