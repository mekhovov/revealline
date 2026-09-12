const root = document.documentElement;
const currentVersion = root.dataset.currentVersion;
const currentLabel = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`;
const picker = document.querySelector('#version-picker');
const versionPlay = document.querySelector('#version-play');
const versionGrid = document.querySelector('#version-grid');
const status = document.querySelector('#version-status');

const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );

const historicalPlayPath = (record) => `./releases/${record.play}`;

function addOption(label, href) {
  const option = document.createElement('option');
  option.value = href;
  option.textContent = label;
  picker.append(option);
}

function versionCard(record) {
  const card = document.createElement('article');
  card.className = 'version-card';
  const shortRevision = record.sourceRevision ? record.sourceRevision.slice(0, 7) : 'archived';
  card.innerHTML = `<div class="card-topline"><span>ARCHIVED FLIGHT</span><span>${escapeHTML(record.version)}</span></div><h3>${escapeHTML(record.version)} release</h3><p>Play the preserved build from its own version channel. Progress stays separate from newer flights.</p><a href="${escapeHTML(historicalPlayPath(record))}">Launch ${escapeHTML(record.version)} <span aria-hidden="true">↗</span></a><small class="card-revision">${escapeHTML(shortRevision)}</small>`;
  return card;
}

picker.addEventListener('change', () => {
  versionPlay.href = picker.value;
});

try {
  const response = await fetch('./releases/index.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('archive unavailable');
  const payload = await response.json();
  const releases = Array.isArray(payload.releases) ? payload.releases : [];
  releases.sort((a, b) =>
    String(b.version).localeCompare(String(a.version), undefined, { numeric: true }),
  );
  for (const record of releases) {
    if (!record || typeof record.version !== 'string' || typeof record.play !== 'string') continue;
    addOption(`${record.version} · archived`, historicalPlayPath(record));
  }
  versionGrid.querySelector('.version-card-loading')?.remove();
  for (const record of releases) {
    if (record && typeof record.version === 'string' && typeof record.play === 'string')
      versionGrid.append(versionCard(record));
  }
  status.textContent = `${releases.length} archived flight${releases.length === 1 ? '' : 's'} available · ${currentLabel} is the live default.`;
} catch {
  versionGrid.querySelector('.version-card-loading')?.remove();
  status.textContent = `The live flight is ready. The archive will appear when its index is available.`;
}

document.querySelector('#latest-label').textContent = currentLabel;
