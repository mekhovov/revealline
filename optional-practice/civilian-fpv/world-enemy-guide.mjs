import { actorDefinition } from '../../game/hunt/actor-catalog.mjs';
import { HUNT_CONTACT_CRITERION } from './snake-hunt.mjs';
import {
  PURSUIT_FAMILIES,
  PURSUIT_FORMAT,
  PURSUIT_FORMAT_V2,
  PURSUIT_RULES,
} from './world-pursuit.mjs';

// Names are shared with Capture/Snake; goals and counters describe only native
// flight policies. A costume never grants an unimplemented flight capability.
const descriptions = {
  lookout: [
    ['Holds its position.', 'Утримує свою позицію.'],
    ['A stationary humanoid marks a direct approach.', 'Нерухома постать позначає прямий підхід.'],
    [
      'Approach at body height and touch it with the drone.',
      'Підійдіть на висоті тіла й торкніться його дроном.',
    ],
  ],
  patroller: [
    ['Follows its authored ground route.', 'Рухається авторським наземним маршрутом.'],
    [
      'Watch its heading as it follows ground waypoints.',
      'Стежте за напрямком руху через наземні точки маршруту.',
    ],
    [
      'Intercept a crossing at body height instead of following from above.',
      'Перехопіть на перетині на висоті тіла замість переслідування згори.',
    ],
  ],
  runner: [
    [
      'Seeks a more distant reachable route when it sees a drone within six metres.',
      'Шукає віддаленіший доступний маршрут, коли бачить дрон у межах шести метрів.',
    ],
    [
      'Commits to a direction for half a second; it runs at 1.5 m/s.',
      'Утримує напрямок пів секунди; швидкість — 1,5 м/с.',
    ],
    [
      'Use a crossing to intercept its escape, keeping enough room to turn the aircraft.',
      'Перехопіть шлях відступу на перетині, залишаючи місце для повороту дрона.',
    ],
  ],
  sprinter: [
    [
      'Makes a committed burst along a ground route.',
      'Виконує спрямований ривок наземним маршрутом.',
    ],
    [
      'Warns for 0.8 s, bursts at 3 m/s for 0.4 s, then recovers for 1.6 s.',
      'Попереджає 0,8 с, рухається зі швидкістю 3 м/с протягом 0,4 с і відновлюється 1,6 с.',
    ],
    [
      'Cut across the route or approach during recovery. Ordinary contact always catches it.',
      'Перетніть маршрут або підійдіть під час відновлення. Звичайний контакт завжди перехоплює ціль.',
    ],
  ],
  courier: [
    [
      'Visits delivery waypoints; catching it is optional.',
      'Відвідує точки доставки; перехоплення необов’язкове.',
    ],
    [
      'A satchel identifies the courier. It stays in the world after delivery.',
      'Сумка позначає кур’єра. Після доставки він залишається у світі.',
    ],
    [
      'Take a safe detour if you want the extra catch. It does not satisfy a required Hunt objective.',
      'Оберіть безпечний обхід заради додаткового перехоплення. Воно не зараховується до обов’язкової цілі полювання.',
    ],
  ],
  'refuge-seeker': [
    ['Chooses one of its authored shelter waypoints.', 'Обирає одну з авторських точок укриття.'],
    [
      'Its heading shows the chosen route; it rests after reaching a shelter.',
      'Напрямок показує обраний маршрут; в укритті ціль перепочиває.',
    ],
    [
      'Cover the shelter approach. Shelter gives no contact protection.',
      'Перекрийте підхід до укриття. Укриття не захищає від контакту.',
    ],
  ],
  switchback: [
    [
      'Chooses another connected exit when possible.',
      'За можливості обирає інший з’єднаний вихід.',
    ],
    [
      'Shows the next heading during a 0.8 s warning before moving.',
      'Показує наступний напрямок під час попередження тривалістю 0,8 с.',
    ],
    [
      'Cover the announced exit; it cannot jump across walls or blocked routes.',
      'Перекрийте оголошений вихід; ціль не перестрибує стіни або заблоковані маршрути.',
    ],
  ],
  'rendezvous-pair': [
    [
      'Two independently catchable partners seek a shared meeting point.',
      'Дві окремо доступні для перехоплення цілі прямують до спільного місця зустрічі.',
    ],
    [
      'Follow their converging routes. The survivor becomes a Runner after its partner is caught.',
      'Стежте за маршрутами, що зближуються. Після перехоплення партнера друга ціль стає бігуном.',
    ],
    [
      'Intercept either partner, then adjust to the survivor’s escape route.',
      'Перехопіть одного партнера, потім пристосуйтеся до шляху відступу другого.',
    ],
  ],
  'shield-bearer': [
    [
      'Keeps its front protected while following its ground route.',
      'Захищає передній бік під час руху наземним маршрутом.',
    ],
    [
      'The shield marks the protected front half. A heading change is warned for 0.8 s.',
      'Щит позначає захищену передню половину. Зміну напрямку показано за 0,8 с.',
    ],
    [
      'Touch the side or rear. Contact in front damages the hull; use the facing visible before contact.',
      'Торкніться збоку або ззаду. Контакт спереду пошкоджує корпус; орієнтуйтеся на напрямок перед контактом.',
    ],
  ],
  'brace-trooper': [
    [
      'Protects its body during a warned, committed burst.',
      'Захищає тіло під час оголошеного спрямованого ривка.',
    ],
    [
      'Armor is closed through the 0.8 s warning and 0.4 s burst; recovery lasts 1.6 s.',
      'Броня закрита протягом попередження 0,8 с і ривка 0,4 с; відновлення триває 1,6 с.',
    ],
    [
      'Wait for recovery before touching it. Warning and burst contact damage the hull.',
      'Дочекайтеся відновлення, перш ніж торкатися. Контакт під час попередження або ривка пошкоджує корпус.',
    ],
  ],
};

/** Read-only projection of a validated native course and its optional snapshot.
 * Repeated objective references count once; ordinary non-Hunt actors are not
 * reinterpreted as prey. Historical policies retain their original descriptions. */
export function worldEnemyGuide(course, { mode = 'self-level', locale = 'en', state = null } = {}) {
  const language = locale === 'uk' ? 'uk' : 'en',
    index = language === 'uk' ? 1 : 0,
    steps = (course?.steps?.[mode] ?? []).filter((step) => step.type === HUNT_CONTACT_CRITERION),
    required = new Set(steps.flatMap((step) => step.targets)),
    pursuit = [PURSUIT_FORMAT, PURSUIT_FORMAT_V2].includes(course?.pursuit?.format)
      ? course.pursuit
      : null,
    policies = new Map((pursuit?.actors ?? []).map((actor) => [actor.id, actor])),
    caught = new Set([...(state?.hunt?.caught ?? []), ...(state?.pursuit?.bonusCaught ?? [])]),
    rows = new Map();
  for (const actor of course?.actors ?? []) {
    const policy = policies.get(actor.id),
      optional = policy?.family === 'courier';
    if (
      (!required.has(actor.id) && !optional) ||
      !['patrol', 'sentry'].includes(actor.type) ||
      actor.role !== 'hostile' ||
      actor.fireEveryTicks !== 0
    )
      continue;
    const family =
      policy?.family ?? (actor.speed > 0 && actor.path.length > 0 ? 'patroller' : 'lookout');
    if (!PURSUIT_FAMILIES.includes(family)) continue;
    if (!rows.has(family)) {
      const definition = actorDefinition(family),
        [goal, tell, counter] = descriptions[family].map((line) => line[index]);
      rows.set(family, {
        family,
        name: definition.name[language],
        specialist: definition.specialist,
        total: 0,
        remaining: 0,
        required: 0,
        optional: 0,
        survivor: false,
        goal,
        tell,
        counter,
      });
    }
    const row = rows.get(family);
    row.total++;
    row.remaining += Number(!caught.has(actor.id));
    row[optional ? 'optional' : 'required']++;
    row.survivor ||= Boolean(
      family === 'rendezvous-pair' &&
        state?.actors?.some(
          (live) =>
            live.id === actor.id && live.status === 'active' && live.pursuit?.family === 'runner',
        ),
    );
  }
  if (pursuit?.format === PURSUIT_FORMAT_V2) {
    if (rows.has('refuge-seeker'))
      rows.get('refuge-seeker').tell = [
        'Announces a shelter for 0.8 s, commits until arrival, then rests for 1.6 s.',
        'Оголошує укриття за 0,8 с, дотримується маршруту до прибуття, потім перепочиває 1,6 с.',
      ][index];
    if (rows.has('rendezvous-pair'))
      rows.get('rendezvous-pair').tell = [
        'Approaches on separate routes, waits for its partner, then both rest for 1.6 s. A survivor becomes a Runner.',
        'Наближається окремим маршрутом і чекає партнера, потім обидва відпочивають 1,6 с. Той, хто лишився, стає бігуном.',
      ][index];
  }
  return {
    rows: [...rows.values()],
    ordered: steps.some((step) => step.ordered),
    tail: steps.some((step) => step.tail.linksPerCatch > 0),
  };
}

/** One paused, text-first native guide. No aircraft, renderer, clock or record is
 * created by preview; dismissing it never resumes an existing flight. */
export function mountWorldEnemyGuide({ document: doc, locale = () => 'en', onPause = () => {} }) {
  const node = (tag, text) => {
    const value = doc.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const dialog = node('dialog'),
    header = node('header'),
    heading = node('h2'),
    close = node('button'),
    content = node('section');
  dialog.id = 'world-enemy-guide';
  dialog.className = 'world-enemy-guide';
  heading.id = 'world-enemy-guide-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  close.type = 'button';
  header.append(heading, close);
  dialog.append(header, content);
  doc.body.append(dialog);
  let selected = null,
    focus = null,
    disposed = false;
  const text = (en, uk) => (locale() === 'uk' ? uk : en);
  function refresh() {
    heading.textContent = text('Enemy field guide · FPV SIM', 'Довідник ворогів · FPV SIM');
    close.textContent = text('Back', 'Назад');
    if (!selected) return;
    const { course, mode, state } = selected,
      guide = worldEnemyGuide(course, { mode, state, locale: locale() });
    content.replaceChildren(
      node('h3', course.locales[locale() === 'uk' ? 'uk' : 'en'].title),
      node(
        'p',
        text(
          state
            ? 'Current flight · paused inspection. Resume explicitly when ready.'
            : 'Course preview · no flight started.',
          state
            ? 'Поточний політ · огляд на паузі. Продовжіть окремою дією, коли будете готові.'
            : 'Перегляд завдання · політ не розпочато.',
        ),
      ),
      node(
        'p',
        text(
          'These unarmed targets are caught by physical drone contact at body height. Populations are finite; caught targets do not respawn. Other obstacles and combat actors keep their native rules.',
          'Ці неозброєні цілі перехоплюються фізичним контактом дрона на висоті тіла. Кількість скінченна; перехоплені цілі не відроджуються. Інші перешкоди й бойові об’єкти зберігають власні правила.',
        ),
      ),
    );
    if (guide.ordered)
      content.append(
        node(
          'p',
          text(
            'This course includes ordered catches. Follow the next target shown in the flight objective.',
            'У цьому завданні є послідовні перехоплення. Стежте за наступною ціллю в меті польоту.',
          ),
        ),
      );
    if (guide.tail)
      content.append(
        node(
          'p',
          text(
            'Catches grow a solid echo tail on this course. Keep clear of your previous route.',
            'У цьому завданні перехоплення подовжують небезпечний слід. Не торкайтеся свого попереднього маршруту.',
          ),
        ),
      );
    if (guide.rows.some((row) => row.specialist))
      content.append(
        node(
          'p',
          text(
            `Protected contact deals ${PURSUIT_RULES.protectedDamage} hull damage. The shared contact-damage cooldown is ${PURSUIT_RULES.contactCooldown} flight ticks (0.4 s); it does not open armor.`,
            `Захищений контакт завдає ${PURSUIT_RULES.protectedDamage} одиниць шкоди корпусу. Спільна затримка між контактними пошкодженнями — ${PURSUIT_RULES.contactCooldown} тактів польоту (0,4 с); вона не відкриває броню.`,
          ),
        ),
      );
    for (const row of guide.rows) {
      const card = node('article');
      card.dataset.enemyFamily = row.family;
      card.append(node('h3', `${row.specialist ? '◇ ' : ''}${row.name} × ${row.total}`));
      card.append(
        node(
          'p',
          [
            `${text('Required', 'Обов’язкових')}: ${row.required}`,
            ...(row.optional ? [`${text('Optional', 'Необов’язкових')}: ${row.optional}`] : []),
            ...(state ? [`${text('Remaining', 'Залишилось')}: ${row.remaining}`] : []),
          ].join(' · '),
        ),
      );
      if (row.specialist)
        card.append(
          node('strong', text('Hazard · protected contact', 'Небезпека · захищений контакт')),
        );
      for (const [key, label] of [
        ['goal', text('Goal', 'Мета')],
        ['tell', text('Tell', 'Ознака')],
        ['counter', text('How to catch', 'Як перехопити')],
      ]) {
        const paragraph = node('p');
        paragraph.append(node('strong', `${label}: `), doc.createTextNode(row[key]));
        card.append(paragraph);
      }
      if (row.survivor)
        card.append(
          node(
            'p',
            text('The surviving partner is now a Runner.', 'Партнер, що лишився, тепер бігун.'),
          ),
        );
      content.append(card);
    }
  }
  function dismiss() {
    if (!dialog.open) return;
    dialog.close();
    if (focus?.isConnected) focus.focus({ preventScroll: true });
    selected = null;
    focus = null;
  }
  const cancel = (event) => {
    event.preventDefault();
    dismiss();
  };
  close.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', cancel);
  return {
    dialog,
    open(course, { mode = 'self-level', state = null, trigger = doc.activeElement } = {}) {
      if (disposed || !worldEnemyGuide(course, { mode }).rows.length) return false;
      onPause();
      selected = { course, mode, state };
      focus = trigger;
      refresh();
      if (!dialog.open) dialog.showModal();
      close.focus();
      return true;
    },
    refresh,
    close: dismiss,
    dispose() {
      disposed = true;
      focus = null;
      dismiss();
      close.removeEventListener('click', dismiss);
      dialog.removeEventListener('cancel', cancel);
      dialog.remove();
    },
  };
}
