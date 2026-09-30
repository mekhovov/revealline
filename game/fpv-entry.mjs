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
      !['', 'index.html', 'company.html'].some(
        (name) => target.pathname === gameRoot.pathname + name,
      )
    )
      return null;
    return target.href;
  } catch {
    return null;
  }
}
