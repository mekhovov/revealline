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
const marker = (key, value, tag = 'span') =>
  `<${tag} data-i18n="website:musicArchive.${key}">${escape(value)}</${tag}>`;

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
      const changes = track.changes || track.transform;
      const changeDetails = changes
        ? `<p>${escape(changes)}</p>`
        : marker(
            'exactDeliveryDetails',
            'Exact delivery MP3; source conversion details are retained in the recording credit.',
            'p',
          );
      return `<article class="track" id="track-${index}" data-index="${index}" data-genres="${escape(genres.join(' '))}" data-search="${escape(`${track.title} ${track.artist}`.toLowerCase())}">
      <button type="button" class="play-track" data-index="${index}" aria-label="Play ${escape(track.title)}">▶</button>
      <div class="track-main"><h2>${escape(track.title)}</h2><p class="artist">${artist}</p>
      <p class="tags">${genres.map((genre) => (labels[genre] ? marker(`genre.${genre}`, labels[genre]) : escape(genre))).join(' · ')} · ${minutes(duration)}${duration < 90 ? ` · ${marker('shortCue', 'Short cue')}` : ''}</p>
      <details><summary data-i18n="website:musicArchive.creditsAndDetails">Credits & file details</summary><p>${escape(track.credit)}</p>${changeDetails}<p>${marker('mp3Filename', 'MP3 filename:')} <span class="filename">${escape(filename)}</span></p><p>${marker('sourceFilename', 'Source filename:')} <span class="filename">${escape(track.conversion?.original?.fileName || filename)}</span></p><p>SHA-256: <code>${escape(track.sha256)}</code></p></details></div>
      <div class="links"><a href="${escape(track.path)}" download="${escape(filename)}">MP3 ↓</a><a href="${escape(track.source)}" rel="noopener noreferrer" data-i18n="website:musicArchive.creatorSource">Creator source ↗</a><a href="${escape(track.licenseURL)}" rel="license">${escape(track.license)}</a></div>
    </article>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="Listen to and download 70 Creative Commons game-music recordings with full creator credits." data-i18n-content="website:musicArchive.description"><title data-i18n="website:musicArchive.title">RevealLine · Music archive</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="i18n/style.css"><script src="i18n/i18next-26.4.2.min.js"></script><script src="i18n/catalogs.mjs"></script><script src="i18n/bootstrap.mjs"></script><script src="player.mjs" type="module"></script></head>
<body><div data-language-control></div><a class="skip" href="#recordings" data-i18n="website:musicArchive.skipToRecordings">Skip to recordings</a><main>
<header><p class="eyebrow" data-i18n="website:musicArchive.eyebrow">REVEALLINE / MUSIC ARCHIVE 01</p><h1><span data-i18n="website:musicArchive.musicFor">Music for</span><br><span data-i18n="website:musicArchive.anotherRound">another round.</span></h1><p class="intro" data-i18n="website:musicArchive.intro">70 creator recordings. Heavy riffs, FM melodies, chiptune, dance and quieter moments. Listen here or keep the exact MP3.</p><p class="notice" data-i18n="website:musicArchive.notice">Free to use under the listed Creative Commons licenses; attribution required where marked. These are creator music previews. Game integration and musical review are pending.</p><nav><a href="https://mekhovov.github.io/revealline/game/" data-i18n="website:musicArchive.playRevealLine">Play RevealLine ↗</a><a href="https://github.com/mekhovov/revealline-soundtracks-01" data-i18n="website:musicArchive.mp3Repository">MP3 repository ↗</a><a href="preview-catalogue.json" data-i18n="website:musicArchive.creditsLicensesJson">Credits & licenses JSON</a><a href="inventory.json" data-i18n="website:musicArchive.exactFileInventory">Exact file inventory</a></nav></header>
<section class="player" aria-labelledby="player-heading"><div><p class="eyebrow" id="player-heading" data-i18n="website:musicArchive.nowPlaying">NOW PLAYING</p><p id="now-playing" aria-live="polite" data-i18n="website:musicArchive.chooseRecording">Choose a recording below.</p></div><audio id="audio" controls preload="none"></audio><div class="transport"><button id="pause" type="button" disabled data-i18n="interface:pauseMusic">Pause music</button><button id="next" type="button" data-i18n="website:musicArchive.nextTrack">Next track →</button><label><input id="shuffle" type="checkbox" checked> <span data-i18n="website:musicArchive.shuffle">Shuffle</span></label><span data-i18n="website:musicArchive.repeatAll">Repeat all</span></div><p id="playback-status" role="status"></p></section>
<section id="recordings" aria-label="Recordings" data-i18n-aria-label="website:musicArchive.recordings"><div class="filters"><label><span data-i18n="website:musicArchive.findSongOrArtist">Find a song or artist</span><input id="search" type="search" placeholder="Title or creator" data-i18n-placeholder="website:musicArchive.titleOrCreator" autocomplete="off"></label><label><span data-i18n="website:musicArchive.musicStyle">Music style</span><select id="genre"><option value="" data-i18n="website:musicArchive.allStyles">All styles</option>${Object.entries(
    labels,
  )
    .map(
      ([key, label]) =>
        `<option value="${key}" data-i18n="website:musicArchive.genre.${key}">${label}</option>`,
    )
    .join(
      '',
    )}</select></label><p id="count" role="status">70 recordings</p></div><div id="tracks">${rows}</div><p id="empty" hidden data-i18n="website:musicArchive.noRecordingsMatch">No recordings match. Try another search or style.</p></section>
<section class="guide"><h2 data-i18n="website:musicArchive.takeTrackIntoGame">Take a track into the game</h2><ol><li data-i18n="website:musicArchive.guideDownload">Download the MP3s you want using the links above.</li><li data-i18n="website:musicArchive.guideOpenLibrary">In RevealLine, open Settings → Music library & playlists.</li><li data-i18n="website:musicArchive.guideImport">Choose Add MP3 files, import the selected files, then Save all changes.</li><li data-i18n="website:musicArchive.guidePlaylist">Create a playlist, add your tracks, save it and choose it for playback. Turn sound on and press Play.</li></ol><p data-i18n="website:musicArchive.libraryBudget">Your browser library shares a 256 MiB media budget; select a few albums instead of importing this entire 338.54 MiB collection at once. Downloads include audio only: preserve the recording credits, source and license from this page when reusing or sharing.</p></section>
<footer><p data-i18n="website:musicArchive.thirdPartyNotice">Third-party recordings, credited to their creators. No creator endorsement or Content ID clearance is implied. UA-FPV and rejected AI originals are not included in this public archive.</p><p data-i18n="website:musicArchive.immutableNotice">Public files keep immutable SHA-256 paths. The archive does not change the current game release or automatically download music to your browser.</p></footer>
<noscript><p>Language: English / Мова: Українська. Enable JavaScript to switch this archive to Ukrainian. / Увімкніть JavaScript, щоб перемкнути цей архів українською.</p></noscript>
</main></body></html>\n`;
}
