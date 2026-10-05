import { canonicalEnemyFamily } from '../enemy-stats.mjs';
import { drawHuntActor } from '../hunt/actor-art.mjs';
import { actorDefinition, resolveActorFamily } from '../hunt/actor-catalog.mjs';

const copy = {
  en: {
    title: 'Your victories',
    lifetime: 'Lifetime',
    run: 'This run',
    all: 'All games',
    defeated: 'Enemies defeated',
    empty: 'Your first catch starts your collection.',
    saving: 'Session totals · saving unavailable',
    since: 'Every enemy counts, even on a run you retry.',
    filter: 'Filter victories by game',
    solo: 'Solo',
    team: 'Team',
    versus: 'Versus',
    snake: 'Snake',
    worlds: 'SIM Worlds',
  },
  uk: {
    title: 'Ваші перемоги',
    lifetime: 'За весь час',
    run: 'Ця спроба',
    all: 'Усі ігри',
    defeated: 'Переможені вороги',
    empty: 'Спіймайте першого ворога, щоб почати колекцію.',
    saving: 'Підсумки сеансу · збереження недоступне',
    since: 'Кожен ворог зараховується, навіть якщо почати спробу знову.',
    filter: 'Фільтр перемог за грою',
    solo: 'Соло',
    team: 'Команда',
    versus: 'Дуель',
    snake: 'Змійка',
    worlds: 'SIM Worlds',
  },
};
const families = {
  lookout: ['Lookout', 'Спостерігач'],
  patroller: ['Patroller', 'Патрульний'],
  runner: ['Runner', 'Бігун'],
  sprinter: ['Sprinter', 'Спринтер'],
  'refuge-seeker': ['Refuge seeker', 'Шукач укриття'],
  'pair-runner': ['Pair runner', 'Парний бігун'],
  'shield-trooper': ['Shield trooper', 'Щитоносець'],
  'brace-trooper': ['Brace trooper', 'Боєць у стійці'],
  bouncer: ['Field hunter', 'Польовий мисливець'],
  'border-patrol': ['Border guard', 'Прикордонний патруль'],
  'contour-patrol': ['Contour crawler', 'Контурний патруль'],
  'claimed-rover': ['Ground rover', 'Наземний ровер'],
  eroder: ['Territory eroder', 'Руйнівник території'],
  'lane-boss': ['Lane emitter', 'Лінійний випромінювач'],
  'relay-sentinel': ['Relay sentinel', 'Релейний вартовий'],
  jammer: ['Signal jammer', 'Глушник сигналу'],
  sentry: ['Sentry', 'Вартовий'],
  courier: ['Courier', 'Кур’єр'],
  drone: ['Drone', 'Дрон'],
  vehicle: ['Armoured vehicle', 'Бронемашина'],
};
const spriteFamilies = new Set([
  'bouncer',
  'border-patrol',
  'contour-patrol',
  'claimed-rover',
  'eroder',
  'lane-boss',
  'relay-sentinel',
]);
const glyphs = {
  drone: ['11000011', '01100110', '00111100', '00111100', '01100110', '11000011'],
  vehicle: ['00011100', '00111110', '11111111', '11011011', '11111111', '01100110'],
  bouncer: ['00111100', '01111110', '11100111', '11111111', '01111110', '11000011'],
  'border-patrol': ['11000011', '11100111', '00111100', '00111100', '11100111', '11000011'],
  'contour-patrol': ['11110000', '10010000', '10111100', '10100100', '00101111', '00100001'],
  'claimed-rover': ['00011000', '00111100', '01111110', '11011011', '11111111', '11000011'],
  eroder: ['00011000', '00111100', '01100110', '11011011', '01100110', '00111100'],
  'lane-boss': ['10000001', '01011010', '00111100', '11111111', '00111100', '01100110'],
  'relay-sentinel': ['00111100', '01100110', '11011011', '11011011', '01111110', '00111100'],
};
function drawMechanicalPortrait(ctx, family) {
  if (!ctx) return;
  ctx.fillStyle = '#b9c6a6';
  glyphs[family]?.forEach((row, y) =>
    [...row].forEach((value, x) => {
      if (value === '1') ctx.fillRect(4 + x * 7, 11 + y * 7, 7, 7);
    }),
  );
}
const styles = `
.enemy-stats{--stats-gold:var(--fk-color-accent,#eabb59);color:inherit;min-width:0}
.enemy-stats[data-variant=collection],.enemy-stats[data-variant=panel]{border:1px solid #69706f66;background:linear-gradient(140deg,#26343b99,#171c2099);padding:clamp(12px,2vw,24px);margin:12px 0;border-radius:4px}
.enemy-stats-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.enemy-stats-header h3{margin:0}.enemy-stats-total{font-variant-numeric:tabular-nums;color:var(--stats-gold);font-size:clamp(1.7rem,3vw,2.8rem);font-weight:800;line-height:1.1}.enemy-stats-summary{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:10px 0}.enemy-stats-caption{opacity:.8;font-size:.9em}.enemy-stats-run{font-variant-numeric:tabular-nums;white-space:nowrap}.enemy-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,165px),1fr));gap:10px;margin:12px 0 0;padding:0;list-style:none}.enemy-stats-card{display:grid;grid-template-columns:40px 1fr;align-items:center;gap:10px;padding:10px;border:1px solid #87958c44;background:#10181b77}.enemy-stats-card strong{display:block;font-variant-numeric:tabular-nums;font-size:1.4em;color:var(--stats-gold)}.enemy-stats-card span{font-size:.85em}.enemy-stats-portrait{width:40px;height:40px;object-fit:contain;image-rendering:pixelated;background:#27383c}.enemy-stats-person{position:relative;display:block;width:40px;height:40px;background:#27383c;overflow:hidden}.enemy-stats-person:before{content:'';position:absolute;width:14px;height:14px;left:13px;top:6px;background:#d7bd87;box-shadow:0 -3px #bb934c}.enemy-stats-person:after{content:'';position:absolute;width:24px;height:18px;left:8px;top:22px;background:#829c75;box-shadow:inset 9px 0 #566d58,inset -9px 0 #566d58}.enemy-stats select{max-width:100%;min-height:40px;color:inherit;background:#20292f;border:1px solid #83908a;padding:5px 9px;font:inherit}.enemy-stats[data-variant=hud]{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:.85rem}.enemy-stats[data-variant=hud] .enemy-stats-total{font-size:1.1em}.enemy-stats[data-variant=hud] .enemy-stats-summary{margin:0}.enemy-stats[data-variant=hud] .enemy-stats-caption{font-size:inherit}.enemy-stats-warning{color:#e6c68b;font-size:.85em}.enemy-stats [hidden]{display:none!important}
`;
export function enemyStatsFamilyLabel(family, locale = 'en') {
  const canonical = canonicalEnemyFamily(family);
  return (
    actorDefinition(canonical)?.name?.[locale === 'uk' ? 'uk' : 'en'] ??
    families[canonical]?.[locale === 'uk' ? 1 : 0] ??
    canonical.replaceAll('-', ' ')
  );
}

/** A shared rendering adapter: no simulation, rewards, picture ownership, or
 * keyboard shortcuts live here. Hosts mount it above their existing pictures. */
export function mountEnemyStats({
  container,
  stats,
  gameType = null,
  getAttempt = () => null,
  locale = 'en',
  variant = 'panel',
  spritePortraits = true,
  assetBaseURL = new URL('../assets/', import.meta.url).href,
  document: doc = container?.ownerDocument ?? globalThis.document,
} = {}) {
  if (!container || !stats || !doc)
    throw new TypeError('Enemy statistics need a host and service.');
  if (!doc.getElementById('enemy-stats-shared-style')) {
    const style = doc.createElement('style');
    style.id = 'enemy-stats-shared-style';
    style.textContent = styles;
    (doc.head ?? doc.body).append(style);
  }
  const make = (tag, className) => {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    return el;
  };
  const root = make('section', 'enemy-stats');
  root.dataset.variant = variant;
  const header = make('div', 'enemy-stats-header'),
    title = make('h3'),
    filter = make('select');
  const summary = make('div', 'enemy-stats-summary'),
    total = make('strong', 'enemy-stats-total'),
    caption = make('span', 'enemy-stats-caption'),
    run = make('span', 'enemy-stats-run');
  const grid = make('ul', 'enemy-stats-grid'),
    detail = make('p', 'enemy-stats-caption'),
    warning = make('p', 'enemy-stats-warning'),
    milestone = make('span', 'enemy-stats-milestone');
  milestone.setAttribute('role', 'status');
  milestone.hidden = true;
  header.append(title, filter);
  summary.append(total, caption, run);
  root.append(header, summary, milestone, grid, detail, warning);
  container.append(root);
  let selected = variant === 'collection' ? '' : (gameType ?? ''),
    disposed = false,
    priorTotal = stats.totals().total,
    priorRun = 0,
    milestoneTimer = null;
  const language = () =>
    (typeof locale === 'function' ? locale() : locale) === 'uk' ? 'uk' : 'en';
  function refresh(event = {}) {
    if (disposed) return;
    const lang = language(),
      t = copy[lang],
      attempt = getAttempt();
    const all = stats.totals(),
      result = stats.totals({ gameType: selected || null, attempt });
    const number = (n) => new Intl.NumberFormat(lang).format(n);
    const mark = (n) =>
      n >= 100 ? Math.floor(n / 100) * 100 : ([50, 25, 10].find((value) => n >= value) ?? 0);
    if (event.kind === 'defeat') {
      const lifetimeMark = mark(all.total),
        runMark = mark(result.run.total);
      const reached =
        lifetimeMark > mark(priorTotal) ? lifetimeMark : runMark > mark(priorRun) ? runMark : 0;
      if (reached) {
        milestone.textContent =
          lang === 'uk' ? `✦ ${number(reached)} перемог!` : `✦ ${number(reached)} victories!`;
        milestone.hidden = false;
        clearTimeout(milestoneTimer);
        milestoneTimer = setTimeout(() => {
          milestone.hidden = true;
        }, 3500);
      }
    }
    priorTotal = all.total;
    priorRun = result.run.total;
    title.textContent = t.title;
    header.hidden = variant === 'hud';
    filter.hidden = variant !== 'collection';
    filter.setAttribute('aria-label', t.filter);
    if (variant === 'collection') {
      const games = Object.keys(all.byGame).sort();
      if (gameType && !games.includes(gameType)) games.push(gameType);
      filter.replaceChildren();
      for (const game of ['', ...games]) {
        const option = make('option');
        option.value = game;
        option.textContent = game ? (t[game] ?? game) : t.all;
        filter.append(option);
      }
      filter.value = selected;
    }
    total.textContent = number(result.total);
    caption.textContent = variant === 'hud' ? t.lifetime : t.defeated;
    run.textContent = attempt ? ` · ${t.run}: ${number(result.run.total)}` : '';
    run.hidden = !attempt;
    grid.hidden = variant === 'hud';
    detail.hidden = variant === 'hud';
    warning.hidden = result.durable;
    detail.textContent = result.total ? t.since : t.empty;
    warning.textContent = t.saving;
    grid.replaceChildren();
    if (variant !== 'hud')
      for (const [family, n] of Object.entries(result.byFamily).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )) {
        const card = make('li', 'enemy-stats-card'),
          info = make('div'),
          count = make('strong'),
          name = make('span');
        let portrait;
        if (spriteFamilies.has(family) && spritePortraits) {
          portrait = make('img', 'enemy-stats-portrait');
          portrait.src = new URL(`field-kit/sprites/enemy-${family}.png`, assetBaseURL).href;
          portrait.alt = '';
          portrait.loading = 'lazy';
        } else if (Object.hasOwn(glyphs, family)) {
          portrait = make('canvas', 'enemy-stats-portrait');
          portrait.width = portrait.height = 64;
          portrait.setAttribute('aria-hidden', 'true');
          drawMechanicalPortrait(portrait.getContext?.('2d'), family);
        } else if (resolveActorFamily(family)) {
          portrait = make('canvas', 'enemy-stats-portrait');
          portrait.width = portrait.height = 64;
          portrait.setAttribute('aria-hidden', 'true');
          drawHuntActor(portrait.getContext?.('2d'), 2, 2, 60, 0, {
            family,
            cast: 'rivals',
            direction: 'up',
            reducedEffects: true,
            frozen: true,
            token: false,
          });
        } else {
          portrait = make('i', 'enemy-stats-person');
          portrait.setAttribute('aria-hidden', 'true');
        }
        count.textContent = number(n);
        name.textContent = enemyStatsFamilyLabel(family, lang);
        info.append(count, name);
        card.append(portrait, info);
        grid.append(card);
      }
  }
  filter.addEventListener('change', () => {
    selected = filter.value;
    refresh();
  });
  const unsubscribe = stats.subscribe(refresh);
  refresh();
  return {
    root,
    refresh,
    dispose() {
      disposed = true;
      clearTimeout(milestoneTimer);
      unsubscribe();
      root.remove();
    },
  };
}
