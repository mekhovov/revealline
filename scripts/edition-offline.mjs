import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { editionAppIdentity, validateEditionId } from '../game/edition-context.mjs';
import { inspectImageDataUrl } from '../game/content.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
const safe = (path) =>
  typeof path === 'string' &&
  /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(path);
const scriptJSON = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const htmlText = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

function workerSource(inventory) {
  return `const INVENTORY = ${scriptJSON(inventory)};
const SCOPE = self.registration.scope;
const CACHE = 'revealline-company-' + encodeURIComponent(SCOPE) + '-' + INVENTORY.buildId;
const rows = new Map(INVENTORY.files.map(row => [new URL(row.path, SCOPE).href, row]));
async function checked(response, row) {
  if (!response || !response.ok || response.type === 'opaque') throw new Error('An offline file is unavailable.');
  const announced = response.headers.get('content-length');
  if (!response.headers.get('content-encoding') && announced !== null && (!/^\\d+$/.test(announced) || Number(announced) > row.bytes)) {
    response.body?.cancel().catch(() => {}); throw new Error('Offline file length differs.');
  }
  const bytes = new Uint8Array(row.bytes);
  let received = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const item = await reader.read(); if (item.done) break;
        if (received + item.value.byteLength > row.bytes) throw new Error('Offline file length differs.');
        bytes.set(item.value, received); received += item.value.byteLength;
      }
    } catch (error) { reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
  }
  if (received !== row.bytes) throw new Error('Offline file length differs.');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== row.sha256) throw new Error('Offline file hash differs.');
  const headers = new Headers(response.headers);
  headers.delete('content-encoding'); headers.set('content-length', String(received));
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers });
}
async function prepareCache() {
  const cache = await caches.open(CACHE);
  for (const [url, row] of rows) {
    let saved = await cache.match(url);
    try { if (saved) { await checked(saved, row); continue; } } catch { saved = null; }
    await cache.put(url, await checked(await fetch(url, { cache: 'no-store', redirect: 'error' }), row));
  }
}
self.addEventListener('install', event => event.waitUntil(prepareCache()));
// No forced activation, global cache deletion or player-storage mutation.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url); url.search = ''; url.hash = '';
  if (url.pathname.endsWith('/')) url.pathname += 'index.html';
  const row = rows.get(url.href); if (!row) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), saved = await cache.match(url.href);
    if (saved) return saved;
    try { const response = await checked(await fetch(url.href, { redirect: 'error' }), row); await cache.put(url.href, response.clone()); return response; }
    catch { return new Response('Reconnect and repair this edition.', { status: 503 }); }
  })());
});
self.addEventListener('message', event => {
  if (!['verify-company-edition', 'repair-company-edition'].includes(event.data?.type) || !event.ports[0]) return;
  event.waitUntil((async () => {
    const client = event.source?.id ? await self.clients.get(event.source.id) : null;
    if (!client || !client.url.startsWith(SCOPE)) return event.ports[0].postMessage({ status: 'error', message: 'Verification belongs to this edition.' });
    try { if (event.data.type === 'repair-company-edition') await prepareCache(); const cache = await caches.open(CACHE); for (const [url, row] of rows) await checked(await cache.match(url), row);
      event.ports[0].postMessage({ status: 'ready', editionId: INVENTORY.editionId, version: INVENTORY.version, buildId: INVENTORY.buildId, count: rows.size, bytes: INVENTORY.totalBytes }); }
    catch (error) { event.ports[0].postMessage({ status: 'error', message: error.message }); }
  })());
});\n`;
}

/** Pure artifact composition. No registration, downloads or publication occurs here. */
export async function buildEditionOfflineFiles({
  files,
  editionId,
  version,
  basePath = '/',
  name = editionId,
  entry = 'game/company.html',
  iconPath,
  iconPaths,
  fontPath,
  palette = {},
} = {}) {
  validateEditionId(editionId);
  if (
    !(files instanceof Map) ||
    !/^v?\d+\.\d+\.\d+$/.test(version) ||
    !safe(entry) ||
    !files.has(entry)
  )
    throw new Error('An exact playable edition inventory is required.');
  const selectedIcons = iconPaths ?? (iconPath ? [iconPath] : []);
  if (
    !Array.isArray(selectedIcons) ||
    selectedIcons.length > 4 ||
    new Set(selectedIcons).size !== selectedIcons.length ||
    selectedIcons.some((path) => !safe(path) || !files.has(path))
  )
    throw new Error('Edition icon must be included in its inventory.');
  if (
    fontPath !== undefined &&
    (!safe(fontPath) || !files.has(fontPath) || !/\.(?:ttf|otf|woff2?)$/i.test(fontPath))
  )
    throw new Error('Edition font must be included in its inventory.');
  if (typeof name !== 'string' || !name.trim() || name.length > 160)
    throw new Error('An edition launcher needs a bounded name.');
  const colors = { ink: '#142333', paper: '#ffffff', accent: '#315574', ...palette };
  for (const key of ['ink', 'paper', 'accent'])
    if (!/^#[0-9a-f]{6}$/i.test(colors[key]))
      throw new Error('Edition launcher colors must be fixed hex colors.');
  const result = new Map(files),
    identity = editionAppIdentity({ editionId, basePath });
  const put = (path, bytes) => {
    if (result.has(path)) throw new Error(`Generated offline path already exists: ${path}`);
    result.set(path, bytes);
  };
  const icons = selectedIcons.map((path, index) => {
    const extension = path.split('.').at(-1).toLowerCase();
    const type = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    }[extension];
    if (!type) throw new Error('Edition icon needs a supported image format.');
    let sizes = 'any';
    if (extension !== 'svg') {
      const inspected = inspectImageDataUrl(
        `data:${type};base64,${Buffer.from(files.get(path)).toString('base64')}`,
      );
      if (!inspected.valid)
        throw new Error('Edition icon bytes do not match a supported raster image.');
      sizes = `${inspected.width}x${inspected.height}`;
      if (
        iconPaths &&
        (![192, 512].includes(inspected.width) || inspected.height !== inspected.width)
      )
        throw new Error('Install icon variants must be square 192 or 512 pixel images.');
    }
    const name = `icon${selectedIcons.length > 1 ? `-${index + 1}` : ''}.${extension}`;
    put(`app/${name}`, files.get(path));
    return { src: `./${name}`, sizes, type, purpose: 'any' };
  });
  if (
    iconPaths?.length &&
    (icons.length !== 2 ||
      !['192x192', '512x512'].every((size) => icons.some((icon) => icon.sizes === size)))
  )
    throw new Error('Install icons need both exact 192 and 512 pixel variants.');
  let fontCSS = '';
  if (fontPath) {
    const extension = fontPath.split('.').at(-1).toLowerCase();
    const format = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' }[extension];
    put(`app/font.${extension}`, files.get(fontPath));
    fontCSS = `@font-face{font-family:"Company Brand";src:url("./font.${extension}") format("${format}");font-display:swap}`;
  }
  const manifest = {
    ...identity,
    name,
    short_name: name,
    display: 'standalone',
    background_color: colors.paper,
    theme_color: colors.ink,
    icons,
  };
  put('app/manifest.webmanifest', json(manifest));
  put('app/current.json', json({ editionId, version, scope: '../', entry }));
  const link = '<link rel="manifest" href="../app/manifest.webmanifest">';
  for (const page of new Set([entry, 'game/index.html'])) {
    if (!result.has(page)) continue;
    const html = new TextDecoder('utf-8', { fatal: true }).decode(result.get(page));
    result.set(
      page,
      Buffer.from(
        html.includes('</head>') ? html.replace('</head>', `${link}</head>`) : `${link}${html}`,
      ),
    );
  }
  put(
    'app/index.html',
    Buffer.from(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${colors.ink}"><link rel="manifest" href="./manifest.webmanifest"><title>${htmlText(name)} · Installation</title><style>${fontCSS}:root{color-scheme:light;font-family:${fontPath ? '"Company Brand",' : ''}system-ui,sans-serif;color:${colors.ink};background:${colors.paper}}body{margin:0;padding:clamp(1.5rem,6vw,5rem)}main{max-width:44rem;margin:auto}img{max-width:5rem;max-height:5rem}h1{font-size:clamp(2rem,7vw,4rem);line-height:1.1}a,button{display:block;margin:1rem 0;padding:.8rem 1rem;border:2px solid ${colors.accent};border-radius:.6rem;color:${colors.ink};background:${colors.paper};font:inherit;text-decoration:underline;cursor:pointer}[hidden]{display:none}a:focus-visible,button:focus-visible{outline:3px solid ${colors.accent};outline-offset:3px}</style><main>${icons.length ? `<img src="${icons.at(-1).src}" alt="">` : ''}<h1 id="name">${htmlText(name)}</h1><p id="status">Your previous edition stays available.</p><a id="play" hidden>Open installed game</a><button id="check">Check available edition</button><a id="prepare" hidden>Open game to prepare offline</a><a id="previous" hidden>Open previous edition</a></main><script type="module" src="./app.mjs"></script></html>`,
    ),
  );
  put(
    'app/app.mjs',
    Buffer.from(`import { validateCompanyInstallationReference } from './edition-context.mjs';
const ID=${scriptJSON(editionId)}, ROOT=${scriptJSON(identity.scope)}, NAME=${scriptJSON(name)}, KEY='revealline.company-installed.'+ID+'.v1';
const $=id=>document.getElementById(id); $('name').textContent=NAME;
const validate=value=>validateCompanyInstallationReference(value,{editionId:ID,baseURL:location.href,editionRoot:ROOT});
try{const state=JSON.parse(localStorage.getItem(KEY)||'{}');if(state.active){const a=validate(state.active);$('play').href=new URL(a.entry,a.scope);$('play').hidden=false;}if(state.previous){const p=validate(state.previous);$('previous').href=new URL(p.entry,p.scope);$('previous').hidden=false;}}catch(error){$('status').textContent=error.message;}
$('check').onclick=async()=>{try{const response=await fetch('./current.json',{cache:'no-store'});if(!response.ok)throw new Error('Update check unavailable.');const candidate=validate(await response.json());$('prepare').href=new URL(candidate.entry,candidate.scope);$('prepare').hidden=false;$('status').textContent='Open this edition and choose Prepare offline. Existing progress is preserved.';}catch(error){$('status').textContent=error.message;}};
// The game records a verified edition only after explicit preparation succeeds.
navigator.serviceWorker?.register('./service-worker.js',{scope:'./',updateViaCache:'none'}).catch(error=>{$('status').textContent=error.message;});\n`),
  );
  const contextSource = await fs.readFile(new URL('../game/edition-context.mjs', import.meta.url));
  put('app/edition-context.mjs', contextSource);
  if (!result.has('game/edition-context.mjs')) put('game/edition-context.mjs', contextSource);
  if (!result.has('game/editions/offline-client.mjs'))
    put(
      'game/editions/offline-client.mjs',
      await fs.readFile(new URL('../game/editions/offline-client.mjs', import.meta.url)),
    );
  const launcher = [...result]
    .filter(([path]) => path.startsWith('app/') && path !== 'app/current.json')
    .map(([path, bytes]) => ({ path: path.slice(4), bytes: bytes.byteLength, sha256: sha(bytes) }));
  const launcherInventory = {
    editionId,
    version,
    files: launcher,
    totalBytes: launcher.reduce((sum, row) => sum + row.bytes, 0),
    buildId: sha(json(launcher)),
  };
  put('app/service-worker.js', Buffer.from(workerSource(launcherInventory)));
  const inventory = [...result]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, bytes]) => {
      if (!safe(path) || !(bytes instanceof Uint8Array))
        throw new Error('Invalid edition offline file.');
      return { path, bytes: bytes.byteLength, sha256: sha(bytes) };
    });
  const totalBytes = inventory.reduce((sum, row) => sum + row.bytes, 0);
  if (inventory.length > 2000 || totalBytes > 64 * 1024 * 1024)
    throw new Error('Edition offline core exceeds 2000 files or 64 MiB.');
  const config = {
    format: 'revealline-company-offline.v1',
    editionId,
    version,
    files: inventory,
    totalBytes,
    buildId: sha(json({ editionId, version, inventory })),
  };
  put('offline-cache.json', json(config));
  put('service-worker.js', Buffer.from(workerSource(config)));
  return result;
}
