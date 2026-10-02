// Same-site navigation between the regular game and its bundled simulator.
import { saveAppearanceContext, resolveStoredAppearance } from './presentation/theme-system.mjs';
export function fpvLaunchURL(href, locale = 'en', appearanceDefault = null) {
  const game = new URL(href);
  if (!['http:', 'https:', 'file:', 'capacitor:'].includes(game.protocol)) return null;
  if (!/\/game\/(?:index\.html|company\.html)?$/.test(game.pathname)) return null;
  const target = new URL('../optional-practice/civilian-fpv/index.html', game);
  target.searchParams.set('game-return', game.pathname + game.search);
  target.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  return appearanceLaunchURL(target.href, appearanceDefault);
}

/** Cosmetic context only. A theme pin cannot select content, assets or audience. */
export function appearanceLaunchURL(
  href,
  pin,
  { sessionStorage, localStorage, window: win = globalThis, transfer = true } = {},
) {
  const target = new URL(href);
  target.searchParams.delete('appearanceFamily');
  target.searchParams.delete('appearanceRevision');
  if (
    pin &&
    /^[a-z][a-z0-9-]{0,63}$/.test(pin.familyId) &&
    /^r[1-9][0-9]{0,8}$/.test(pin.revision)
  ) {
    target.searchParams.set('appearanceFamily', pin.familyId);
    target.searchParams.set('appearanceRevision', pin.revision);
    if (transfer) {
      // The session carries this context plus any active personal custom choice.
      // One replacing, expiring origin-local envelope serves noopener launches.
      let intent = 'follow-game';
      try {
        const storage = localStorage ?? win.localStorage;
        intent = resolveStoredAppearance({
          appearance: storage?.getItem('revealline.appearance.v2'),
          legacyTheme: storage?.getItem('revealline.theme-family.v1'),
          legacyMenu: storage?.getItem('revealline.menu-style.v1'),
          legacyDisplay: storage?.getItem('revealline.display.v1'),
        }).familyId;
      } catch {
        /* Unreadable preferences follow the supplied context. */
      }
      const activeId = intent === 'follow-game' ? pin.familyId : intent;
      const candidates = (pin.appearanceThemes ?? []).filter(
        (row) => row.family?.id === pin.familyId || row.family?.id === activeId,
      );
      for (const kind of ['session', 'local']) {
        try {
          const storage =
            kind === 'session'
              ? (sessionStorage ?? win.sessionStorage)
              : (localStorage ?? win.localStorage);
          for (const candidate of candidates) {
            if (kind === 'session' || candidate.family.id === activeId)
              saveAppearanceContext(storage, candidate, { shared: kind === 'local' });
          }
        } catch {
          // Denied storage keeps the normal visible authored fallback available.
        }
      }
    }
  }
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
