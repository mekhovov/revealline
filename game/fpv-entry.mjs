// Same-site navigation between the regular game and its bundled simulator.
export function fpvLaunchURL(href, locale = 'en') {
  const game = new URL(href);
  if (!['http:', 'https:', 'file:', 'capacitor:'].includes(game.protocol)) return null;
  if (!/\/game\/(?:index\.html|company\.html)?$/.test(game.pathname)) return null;
  const target = new URL('../optional-practice/civilian-fpv/index.html', game);
  target.searchParams.set('game-return', game.pathname + game.search);
  target.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  return target.href;
}

/** Fixed same-build World Studio destination; callers check its availability. */
export function fpvWorldLaunchURL(href, locale = 'en') {
  let game;
  try {
    game = new URL(href);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:', 'file:', 'capacitor:'].includes(game.protocol) ||
    game.username ||
    game.password
  )
    return null;
  const match =
    /^(.*\/)game\/(?:(?:index|company)\.html|couch\/(?:index\.html|relay-rescue\.html)?)?$/.exec(
      game.pathname,
    );
  if (!match) return null;
  const target = new URL(match[1] + 'optional-practice/fpv-worlds/index.html', game);
  target.searchParams.set('game-return', game.pathname + game.search + game.hash);
  target.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  target.hash = 'learn';
  return target.href;
}

export function fpvReturnURL(href) {
  const current = new URL(href);
  const value = current.searchParams.get('game-return');
  if (!value) return null;
  const gameRoot = new URL('../../game/', current);
  try {
    const target = new URL(value, current);
    if (
      target.origin !== current.origin ||
      target.protocol !== current.protocol ||
      target.username ||
      target.password ||
      ![
        '',
        'index.html',
        'company.html',
        'couch/',
        'couch/index.html',
        'couch/relay-rescue.html',
      ].some((name) => target.pathname === gameRoot.pathname + name)
    )
      return null;
    return target.href;
  } catch {
    return null;
  }
}

/** Standalone SIM visits also need an exit without relying on browser chrome. */
export function fpvWorldReturnURL(href) {
  const retained = fpvReturnURL(href);
  if (retained) return retained;
  const current = new URL(href);
  if (!['http:', 'https:', 'file:', 'capacitor:'].includes(current.protocol)) return null;
  const match = /^(.*\/)optional-practice\/fpv-worlds\/(?:index\.html)?$/.exec(current.pathname);
  if (!match) return null;
  // A separately published practice package does not ship an arcade of its own.
  const root = match[1].replace(/practice\/fpv-worlds\/releases\/v\d+\.\d+\.\d+\/site\/$/, '');
  return new URL(root + (root.includes('/editions/') ? 'game/company.html' : 'game/'), current)
    .href;
}
