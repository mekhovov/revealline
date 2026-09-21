const labels = {
  synth90s: '90s Synth & FM',
  metal: 'Metal',
  chiptune: 'Chiptune',
  electronic: 'Electronic & dance',
  rock: 'Rock',
  ambient: 'Ambient',
};
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
const minutes = (value) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

/** Static credits and downloads work without JavaScript. Playback is progressive. */
export function renderPreviewSite(catalogue) {
  const rows = catalogue.tracks
    .map((track, index) => {
      const genres = track.tags?.genres ?? track.genres ?? [];
      const artistURL =
        track.artist === 'Zander Noriega' ? 'https://twitter.com/ZanderNoriega' : track.artistURL;
      const artist = artistURL
        ? `<a href="${escape(artistURL)}" rel="noopener noreferrer">${escape(track.artist)}</a>`
        : escape(track.artist);
      const filename = track.fileName || `${track.title}.mp3`;
      const duration = track.durationSeconds ?? track.asset?.durationSeconds ?? 0;
      const changes =
        track.changes ||
        track.transform ||
        'Exact delivery MP3; source conversion details are retained in the recording credit.';
      return `<article class="track" id="track-${index}" data-index="${index}" data-genres="${escape(genres.join(' '))}" data-search="${escape(`${track.title} ${track.artist}`.toLowerCase())}">
      <button type="button" class="play-track" data-index="${index}" aria-label="Play ${escape(track.title)}">▶</button>
      <div class="track-main"><h2>${escape(track.title)}</h2><p class="artist">${artist}</p>
      <p class="tags">${escape(genres.map((genre) => labels[genre] || genre).join(' · '))} · ${minutes(duration)}${duration < 90 ? ' · Short cue' : ''}</p>
      <details><summary>Credits & file details</summary><p>${escape(track.credit)}</p><p>${escape(changes)}</p><p>MP3 filename: <span class="filename">${escape(filename)}</span></p><p>Source filename: <span class="filename">${escape(track.conversion?.original?.fileName || filename)}</span></p><p>SHA-256: <code>${escape(track.sha256)}</code></p></details></div>
      <div class="links"><a href="${escape(track.path)}" download="${escape(filename)}">MP3 ↓</a><a href="${escape(track.source)}" rel="noopener noreferrer">Creator source ↗</a><a href="${escape(track.licenseURL)}" rel="license">${escape(track.license)}</a></div>
    </article>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="Listen to and download 70 Creative Commons game-music recordings with full creator credits."><title>RevealLine · Music archive</title><link rel="stylesheet" href="style.css"><script src="player.mjs" type="module"></script></head>
<body><a class="skip" href="#recordings">Skip to recordings</a><main>
<header><p class="eyebrow">REVEALLINE / MUSIC ARCHIVE 01</p><h1>Music for<br><span>another round.</span></h1><p class="intro">70 creator recordings. Heavy riffs, FM melodies, chiptune, dance and quieter moments. Listen here or keep the exact MP3.</p><p class="notice">Free to use under the listed Creative Commons licenses; attribution required where marked. These are creator music previews. Game integration and musical review are pending.</p><nav><a href="https://mekhovov.github.io/revealline/game/">Play RevealLine ↗</a><a href="https://github.com/mekhovov/revealline-soundtracks-01">MP3 repository ↗</a><a href="preview-catalogue.json">Credits & licenses JSON</a><a href="inventory.json">Exact file inventory</a></nav></header>
<section class="player" aria-labelledby="player-heading"><div><p class="eyebrow" id="player-heading">NOW PLAYING</p><p id="now-playing" aria-live="polite">Choose a recording below.</p></div><audio id="audio" controls preload="none"></audio><div class="transport"><button id="pause" type="button" disabled>Pause music</button><button id="next" type="button">Next track →</button><label><input id="shuffle" type="checkbox" checked> Shuffle</label><span>Repeat all</span></div><p id="playback-status" role="status"></p></section>
<section id="recordings" aria-label="Recordings"><div class="filters"><label>Find a song or artist<input id="search" type="search" placeholder="Title or creator" autocomplete="off"></label><label>Music style<select id="genre"><option value="">All styles</option>${Object.entries(
    labels,
  )
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join(
      '',
    )}</select></label><p id="count" role="status">70 recordings</p></div><div id="tracks">${rows}</div><p id="empty" hidden>No recordings match. Try another search or style.</p></section>
<section class="guide"><h2>Take a track into the game</h2><ol><li>Download the MP3s you want using the links above.</li><li>In RevealLine, open Settings → Music library & playlists.</li><li>Choose Add MP3 files, import the selected files, then Save all changes.</li><li>Create a playlist, add your tracks, save it and choose it for playback. Turn sound on and press Play.</li></ol><p>Your browser library shares a 256 MiB media budget; select a few albums instead of importing this entire 338.54 MiB collection at once. Downloads include audio only: preserve the recording credits, source and license from this page when reusing or sharing.</p></section>
<footer><p>Third-party recordings, credited to their creators. No creator endorsement or Content ID clearance is implied. UA-FPV and rejected AI originals are not included in this public archive.</p><p>Public files keep immutable SHA-256 paths. The archive does not change the current game release or automatically download music to your browser.</p></footer>
</main></body></html>\n`;
}
