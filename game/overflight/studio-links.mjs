const COPY = Object.freeze({
  en: {
    title: 'Studios & sound library',
    help: 'Editors open in another tab and keep this sortie paused. Music opens here.',
    newTab: 'opens in another tab',
    sounds: ['Sound Studio', 'Preview and replace destruction sounds, impacts and game cues.'],
    assets: ['Asset Studio', 'Drone, enemy, terrain and effect artwork.'],
    motion: ['Motion Lab', 'Propellers, movement and combat animations.'],
    voices: ['Voice Studio', 'Commentator lines and character recordings.'],
    themes: ['Theme Studio', 'Shared interface themes and presentation.'],
    music: ['Music library', 'Choose, import and organize your soundtrack.'],
  },
  uk: {
    title: 'Студії та бібліотека звуку',
    help: 'Редактори відкриваються в іншій вкладці, виліт залишається на паузі. Музика — тут.',
    newTab: 'відкривається в іншій вкладці',
    sounds: ['Студія звуку', 'Прослуховуйте й замінюйте звуки знищення, ударів та ігрових подій.'],
    assets: ['Студія ресурсів', 'Графіка дронів, ворогів, місцевості та ефектів.'],
    motion: ['Лабораторія руху', 'Пропелери, рух і бойові анімації.'],
    voices: ['Студія голосів', 'Репліки коментатора й записи персонажів.'],
    themes: ['Студія тем', 'Спільні теми інтерфейсу та оформлення.'],
    music: ['Бібліотека музики', 'Вибирайте, імпортуйте й упорядковуйте саундтрек.'],
  },
});

const TOOLS = Object.freeze([
  ['sounds', '../../authoring/asset-studio/?studio=sounds'],
  ['creator', null],
  ['assets', '../../authoring/asset-studio/'],
  ['motion', '../../authoring/motion-lab/'],
  ['voices', '../studio/index.html#reaction-voice-editor-panel'],
  ['themes', '../../authoring/asset-studio/?studio=themes'],
]);

/** Native links stay in the host's edition/appearance context. The existing
 * shell and music host own pause, input and audio; these controls own none. */
export function attachOverflightStudioLinks({
  document: doc,
  root,
  getLocale,
  getCreator,
  destination,
  onOpen,
  onMusic,
}) {
  const heading = doc.createElement('h3'),
    help = doc.createElement('p'),
    links = doc.createElement('div'),
    controls = [],
    cleanup = [];
  heading.id = 'overflight-studios-title';
  root.setAttribute('aria-labelledby', heading.id);
  help.className = 'micro-note';
  links.className = 'overflight-studio-links';
  for (const [id, path] of [...TOOLS, ['music', null]]) {
    const control = doc.createElement(id === 'music' ? 'button' : 'a'),
      title = doc.createElement('strong'),
      description = doc.createElement('span');
    control.id = `overflight-studio-${id}`;
    control.className = 'overflight-studio-link';
    if (id === 'music') control.type = 'button';
    else {
      control.target = '_blank';
      control.rel = 'noopener';
    }
    control.append(title, description);
    const activate = () => {
      if (id === 'music') onMusic();
      else {
        control.href = destination(id === 'creator' ? getCreator().path : path);
        onOpen();
      }
    };
    control.addEventListener('click', activate);
    cleanup.push(() => control.removeEventListener('click', activate));
    controls.push({ id, path, control, title, description });
    links.append(control);
  }
  root.replaceChildren(heading, help, links);
  function refresh() {
    const copy = COPY[getLocale() === 'uk' ? 'uk' : 'en'];
    heading.textContent = copy.title;
    help.textContent = copy.help;
    for (const { id, path, control, title, description } of controls) {
      const creator = id === 'creator' ? getCreator() : null,
        [label, detail] = creator ? [creator.title, creator.description] : copy[id];
      title.textContent = label;
      description.textContent = detail;
      if (id !== 'music') {
        control.href = destination(creator?.path ?? path);
        control.setAttribute('aria-label', `${label} · ${copy.newTab}. ${detail}`);
      }
    }
  }
  refresh();
  return Object.freeze({
    refresh,
    dispose() {
      cleanup.splice(0).forEach((release) => release());
      root.replaceChildren();
    },
  });
}
