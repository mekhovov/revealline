globalThis.RevealLineToolLaunch?.attached();
import { createOperationStatus } from '../../../game/ui/operation-status.mjs';
const $ = (id) => document.getElementById(id);
const base = new URL('.', import.meta.url);
let entries = [];
let visible = [];
let current = null;
let themes = {};
let imageRequest = 0;
const catalogStatus = createOperationStatus($('catalog-status')),
  imageStatus = createOperationStatus($('image-status'));
const catalogLease = catalogStatus.begin({ message: 'Loading the reserve catalog…' });

function link(pin) {
  if (
    !/^\.\.\/reserve-illustrations-wave-\d+\/[A-Za-z0-9/_-]+\.(png|txt|json|md)$/.test(pin?.url)
  ) {
    throw new Error('Invalid source link in catalog.');
  }
  const url = new URL(pin.url, base);
  if (url.origin !== base.origin) throw new Error('Source link left this authoring library.');
  return url.href;
}

function show(entry) {
  current = entry;
  $('selection').value = entry.id;
  const position = visible.indexOf(entry);
  $('previous').disabled = position === 0;
  $('next').disabled = position === visible.length - 1;
  $('position').textContent = `${position + 1} of ${visible.length}`;
  $('theme-wave').textContent = `${themes[entry.themeId]} · Wave ${entry.wave} · Source only`;
  $('title').textContent = entry.title;
  $('dimensions').textContent =
    `${entry.width} × ${entry.height} pixels · 2:1 · ${(entry.original.bytes / 1048576).toFixed(2)} MiB · PNG original`;
  $('download').href = link(entry.original);
  $('download').download = entry.original.path.split('/').at(-1);
  $('prompt').href = link(entry.prompts[0]);
  $('cleanup').hidden = entry.prompts.length < 2;
  if (entry.prompts[1]) $('cleanup').href = link(entry.prompts[1]);
  else $('cleanup').removeAttribute('href');
  $('provenance').href = link(entry.provenance);
  $('notes').href = link(entry.notes);
  $('sha').textContent = entry.original.sha256;
  $('blob').textContent = entry.original.gitBlob;
  $('path').textContent = entry.original.path;
  const request = ++imageRequest;
  const lease = imageStatus.begin({
    message: `Loading ${entry.title}…`,
    isCurrent: () => request === imageRequest,
  });
  const old = $('image-slot').querySelector('img');
  old?.removeAttribute('src');
  const image = document.createElement('img');
  image.width = entry.width;
  image.height = entry.height;
  image.alt = `${entry.title} — ${themes[entry.themeId]} reserve illustration`;
  image.decoding = 'async';
  image.onload = () => {
    if (request === imageRequest)
      lease.finish({ message: 'Complete original shown; fitted to this page without cropping.' });
  };
  image.onerror = () => {
    if (request === imageRequest)
      lease.finish({
        state: 'error',
        message:
          'This original could not load. Check the local server and retry the selection; the source links remain available.',
      });
  };
  $('image-slot').replaceChildren(image);
  // This is the sole image request. Lists and links contain no thumbnails or preloads.
  image.src = link(entry.original);
}

function filter() {
  visible = entries.filter(
    (entry) => $('theme').value === 'all' || entry.themeId === $('theme').value,
  );
  $('selection').replaceChildren(
    ...visible.map((entry) => new Option(`Wave ${entry.wave} · ${entry.title}`, entry.id)),
  );
  show(visible.includes(current) ? current : visible[0]);
}

try {
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
  const manifest = await response.json();
  if (
    manifest.format !== 'revealline-reserve-catalog.v1' ||
    manifest.sourceOnly !== true ||
    manifest.entries?.length !== 40
  )
    throw new Error('Unrecognized reserve catalog.');
  entries = manifest.entries;
  themes = manifest.themes;
  for (const entry of entries) {
    if (
      !entry.sourceOnly ||
      !themes[entry.themeId] ||
      !entry.prompts?.length ||
      entry.width !== 2 * entry.height
    )
      throw new Error('Invalid reserve record.');
    for (const pin of [entry.original, ...entry.prompts, entry.provenance, entry.notes]) link(pin);
  }
  for (const [id, label] of Object.entries(themes)) $('theme').append(new Option(label, id));
  $('theme').addEventListener('change', filter);
  $('selection').addEventListener('change', () =>
    show(visible.find((entry) => entry.id === $('selection').value)),
  );
  $('previous').addEventListener('click', () =>
    show(visible[Math.max(0, visible.indexOf(current) - 1)]),
  );
  $('next').addEventListener('click', () =>
    show(visible[Math.min(visible.length - 1, visible.indexOf(current) + 1)]),
  );
  $('catalog').hidden = false;
  catalogLease.finish({
    message: '40 selected originals. Choose a theme or illustration; only that image loads.',
  });
  filter();
} catch (error) {
  $('catalog').hidden = true;
  catalogLease.finish({
    state: 'error',
    message: `${error.message} Reload to retry. Serve the authoring catalog over HTTP using the command in its README.`,
  });
}
