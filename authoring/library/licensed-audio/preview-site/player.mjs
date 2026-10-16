const audio = document.querySelector('#audio');
const now = document.querySelector('#now-playing');
const status = document.querySelector('#playback-status');
const rows = [...document.querySelectorAll('.track')];
const search = document.querySelector('#search');
const genre = document.querySelector('#genre');
const shuffle = document.querySelector('#shuffle');
const pause = document.querySelector('#pause');
const { localizedAttribute, localizedMessage, localizedText } = globalThis.RevealLineI18n;
let current = null;
let queue = [];
let generation = 0;
const visible = () => rows.filter((row) => !row.hidden);
function refresh() {
  const term = search.value.trim().toLowerCase();
  for (const row of rows) {
    row.hidden =
      !row.dataset.search.includes(term) ||
      (genre.value && !row.dataset.genres.split(' ').includes(genre.value));
  }
  const count = visible().length;
  localizedText(
    document.querySelector('#count'),
    localizedMessage('website:musicArchive.recordingsCount', { count }),
  );
  document.querySelector('#empty').hidden = count > 0;
  queue = [];
}
function refill() {
  queue = visible();
  if (shuffle.checked) {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (queue.length > 1 && queue[0] === current) [queue[0], queue[1]] = [queue[1], queue[0]];
  } else if (current && queue.includes(current)) {
    const offset = queue.indexOf(current) + 1;
    queue = [...queue.slice(offset), ...queue.slice(0, offset)];
  }
}
async function play(row) {
  const request = ++generation;
  if (current) current.removeAttribute('data-active');
  current = row;
  pause.disabled = false;
  current.dataset.active = 'true';
  queue = queue.filter((candidate) => candidate !== row);
  audio.pause();
  audio.src = row.querySelector('a[download]').href;
  localizedText(
    now,
    () => `${row.querySelector('h2').textContent} · ${row.querySelector('.artist').textContent}`,
  );
  localizedText(status, () => '');
  try {
    await audio.play();
  } catch {
    if (request === generation)
      localizedText(status, localizedMessage('website:musicArchive.pressPlayOrChooseAnother'));
  }
}
function next() {
  if (!queue.length) refill();
  const row = queue.shift();
  if (row) void play(row);
  else localizedText(status, localizedMessage('website:musicArchive.noRecordingsCurrentFilters'));
}
for (const row of rows)
  row.querySelector('button').addEventListener('click', () => {
    queue = [];
    void play(row);
    refill();
    queue = queue.filter((candidate) => candidate !== row);
  });
for (const row of rows)
  localizedAttribute(
    row.querySelector('button'),
    'aria-label',
    localizedMessage('website:musicArchive.playTrack', {
      title: row.querySelector('h2').textContent,
    }),
  );
search.addEventListener('input', refresh);
genre.addEventListener('change', refresh);
shuffle.addEventListener('change', () => {
  queue = [];
});
document.querySelector('#next').addEventListener('click', next);
pause.addEventListener('click', () => {
  if (!audio.paused) audio.pause();
  else {
    const request = generation;
    void audio.play().catch(() => {
      if (request === generation)
        localizedText(status, localizedMessage('website:musicArchive.playbackCouldNotStart'));
    });
  }
});
audio.addEventListener('play', () => {
  localizedText(pause, localizedMessage('interface:pauseMusic'));
  localizedText(status, () => '');
});
audio.addEventListener('pause', () => {
  localizedText(pause, localizedMessage('website:musicArchive.resumeMusic'));
});
audio.addEventListener('ended', next);
audio.addEventListener('error', () => {
  localizedText(status, localizedMessage('website:musicArchive.recordingLoadFailed'));
});
refresh();
