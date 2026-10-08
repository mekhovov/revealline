// Same-site navigation between the regular game and its bundled simulator.
import { saveAppearanceContext, resolveStoredAppearance } from './presentation/theme-system.mjs';
import { nativeArtReviewURL } from './ui/art-review-navigation.mjs';
export { nativeArtReviewURL } from './ui/art-review-navigation.mjs';

export function fpvLaunchURL(href, locale = 'en', appearanceDefault = null) {
  const game = new URL(href);
  if (!['http:', 'https:', 'file:', 'capacitor:'].includes(game.protocol)) return null;
  if (!/\/game\/(?:index\.html|company\.html)?$/.test(game.pathname)) return null;
  const target = new URL('../optional-practice/civilian-fpv/index.html', game);
  target.searchParams.set('game-return', game.pathname + game.search);
  target.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  return nativeArtReviewURL(appearanceLaunchURL(target.href, appearanceDefault), game.href);
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

/** Fixed same-build World Studio destination; callers check its availability. */
export function fpvWorldLaunchURL(href, locale = 'en', appearanceDefault = null) {
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
    /^(.*\/)game\/(?:(?:index|company)\.html|couch\/(?:index\.html|relay-rescue\.html)?|snake\/(?:(?:index|play)\.html)?|overflight\/(?:play|raid)\.html)?$/.exec(
      game.pathname,
    );
  if (!match) return null;
  const target = new URL(match[1] + 'optional-practice/fpv-worlds/index.html', game);
  target.searchParams.set('game-return', game.pathname + game.search + game.hash);
  target.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  target.hash = 'learn';
  return nativeArtReviewURL(appearanceLaunchURL(target.href, appearanceDefault), game.href);
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
        'snake/',
        'snake/index.html',
        'snake/play.html',
        'overflight/play.html',
        'overflight/raid.html',
      ].some((name) => target.pathname === gameRoot.pathname + name)
    )
      return null;
    return nativeArtReviewURL(target.href, current.href);
  } catch {
    return null;
  }
}

/** The bundled Classic destination retains the selected seat arrangement. */
export function snakeLaunchURL(href, mode = 'solo', locale = 'en', appearanceDefault = null) {
  let current;
  try {
    current = new URL(href);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:', 'file:', 'capacitor:'].includes(current.protocol) ||
    current.username ||
    current.password ||
    !['solo', 'versus', 'team'].includes(mode)
  )
    return null;
  const match =
    /^(.*\/)game\/(?:(?:index|company)\.html|couch\/(?:index\.html|relay-rescue\.html)?|snake\/(?:(?:index|play)\.html)?|overflight\/(?:play|raid)\.html)?$/.exec(
      current.pathname,
    );
  if (!match) return null;
  const target = new URL(`${match[1]}game/snake/play.html`, current);
  target.searchParams.set('mode', mode);
  target.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  return nativeArtReviewURL(appearanceLaunchURL(target.href, appearanceDefault), current.href);
}

/** Same-build survivor destination. Carry only the shared locale/artwork context. */
export function overflightLaunchURL(href, locale = 'en', appearanceDefault = null) {
  let current;
  try {
    current = new URL(href);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:', 'file:', 'capacitor:'].includes(current.protocol) ||
    current.username ||
    current.password
  )
    return null;
  const match =
    /^(.*\/)game\/(?:(?:index|company)\.html|couch\/(?:index\.html|relay-rescue\.html)?|snake\/(?:(?:index|play)\.html)?|overflight\/(?:(?:index|play|raid)\.html)?|studio\/(?:index|overflight|raid)\.html)?$/.exec(
      current.pathname,
    );
  if (!match) return null;
  const target = new URL(`${match[1]}game/overflight/play.html`, current);
  target.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  return nativeArtReviewURL(appearanceLaunchURL(target.href, appearanceDefault), current.href);
}

/** Raid shares the same native artwork/locale context, with its own rules identity. */
export function overflightHuntLaunchURL(href, locale = 'en', appearanceDefault = null) {
  const shared = overflightLaunchURL(href, locale, appearanceDefault);
  if (!shared) return null;
  const target = new URL(shared);
  target.pathname = target.pathname.replace(/\/overflight\/play\.html$/, '/overflight/raid.html');
  return target.href;
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
  return nativeArtReviewURL(
    new URL(root + (root.includes('/editions/') ? 'game/company.html' : 'game/'), current).href,
    current.href,
  );
}
