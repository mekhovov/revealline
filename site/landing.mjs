const root = document.documentElement;
const currentVersion = root.dataset.currentVersion;
const currentLabel = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`;
const picker = document.querySelector('#version-picker');
const versionPlay = document.querySelector('#version-play');
const status = document.querySelector('#version-status');

const historicalPlayPath = (record) => `./releases/${record.play}`;

function addOption(label, href) {
  const option = document.createElement('option');
  option.value = href;
  option.textContent = label;
  picker.append(option);
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
    addOption(`${record.version} · preserved`, historicalPlayPath(record));
  }
  status.textContent = `${releases.length} preserved build${releases.length === 1 ? '' : 's'} · ${currentLabel} remains the default.`;
} catch {
  status.textContent = `The current build is ready. Preserved builds will appear when the archive is available.`;
}

for (const label of document.querySelectorAll('[data-current-label]')) {
  label.textContent = currentLabel;
}
