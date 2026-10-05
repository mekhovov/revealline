import { actorFieldGuide } from '../hunt/actor-catalog.mjs';
import { renderEnemyFieldGuide } from '../ui/enemy-field-guide.mjs';
import { drawClassicTarget } from './classic-target-art.mjs';

const guides = {
  jammer: [
    false,
    ['Signal jammer', 'Глушник сигналу'],
    [
      'Blacks out the whole playfield for four moves after a warning.',
      'Після попередження приховує все поле на чотири ходи.',
    ],
    [
      'The antenna and dashed amber arena edge warn first. A recovery counter stays visible during signal loss.',
      'Антена й жовтий пунктир краю поля попереджають завчасно. Під час втрати сигналу видно відлік відновлення.',
    ],
    [
      'Memorize your next four moves: enemies, walls and your cable disappear while steering continues. Catch the jammer to restore reception. Pulse shows the field while freezing the remaining blackout moves.',
      'Запам’ятайте наступні чотири ходи: вороги, стіни й кабель зникнуть, але керування діє. Спіймайте глушник для відновлення прийому. Імпульс показує поле, заморожуючи решту ходів втрати сигналу.',
    ],
  ],
  lane: [
    true,
    ['Lane emitter', 'Випромінювач смуги'],
    ['Closes a marked crossing for two moves.', 'Закриває позначений перехід на два ходи.'],
    [
      'The entire lane is dashed during warning and solid when dangerous.',
      'Уся смуга пунктирна під час попередження й суцільна, коли небезпечна.',
    ],
    [
      'Use the permanent end bypass or cross during recovery. Only the head is vulnerable.',
      'Обходьте кінці або перетинайте під час відновлення. Небезпека лише для голови.',
    ],
  ],
  relay: [
    true,
    ['Relay sentinel', 'Вартовий ретранслятора'],
    [
      'Protects its body until both linked relay pads are touched.',
      'Захищає тіло, доки не торкнетеся обох пов’язаних майданчиків.',
    ],
    [
      'Linked diamonds show progress; the red shield turns into a blue open mark.',
      'Пов’язані ромби показують поступ; червоний щит змінюється синьою відкритою позначкою.',
    ],
    [
      'Collect both relays without growing, then catch the core. It stays open.',
      'Відвідайте обидва ретранслятори без зростання, потім ловіть ядро. Воно залишиться відкритим.',
    ],
  ],
  perimeter: [
    false,
    ['Border patrol', 'Прикордонний патруль'],
    ['Follows the outer circuit.', 'Рухається зовнішнім колом.'],
    [
      'A square badge distinguishes the perimeter route.',
      'Квадратна позначка вирізняє маршрут периметра.',
    ],
    [
      'Cut across the interior; blocked patrols wait rather than hitting your cable.',
      'Перетинайте центр; заблоковані патрулі чекають і не б’ють кабель.',
    ],
  ],
  contour: [
    false,
    ['Contour crawler', 'Контурний повзун'],
    ['Circles an authored island contour.', 'Обходить заданий контур острова.'],
    [
      'An L-shaped badge and steady turns identify the circuit.',
      'Позначка-кут і рівні повороти показують коло.',
    ],
    [
      'Meet the next corner instead of following directly.',
      'Зустрічайте за наступним кутом, замість переслідування слідом.',
    ],
  ],
  rover: [
    false,
    ['Ground rover', 'Наземний ровер'],
    [
      'Wakes when a head comes close and follows its position.',
      'Прокидається біля голови й прямує до неї.',
    ],
    [
      'A wheel badge stays still before the waking warning.',
      'Позначка колеса нерухома до попередження про пробудження.',
    ],
    [
      'Approach from open ground. The body is safe to catch in every phase.',
      'Наближайтеся відкритим шляхом. Тіло безпечно ловити в будь-якій фазі.',
    ],
  ],
  ricochet: [
    false,
    ['Field hunter', 'Польовий мисливець'],
    [
      'Travels straight and reverses at a blocked cell.',
      'Рухається прямо й розвертається перед перешкодою.',
    ],
    [
      'A reflected-arrow badge marks the predictable return.',
      'Позначка відбитої стрілки показує передбачуване повернення.',
    ],
    [
      'Intercept the returning route. It never moves into your cable.',
      'Перехоплюйте на зворотному шляху. Він не заходить у кабель.',
    ],
  ],
  eroder: [
    false,
    ['Wall eroder', 'Руйнівник стін'],
    [
      'Opens explicitly cracked adjacent wall cells.',
      'Відкриває сусідні клітини стіни з видимою тріщиною.',
    ],
    [
      'The crack highlights before the marked wall opens.',
      'Тріщина підсвічується перед відкриттям стіни.',
    ],
    [
      'Use the new turn pocket or keep the outer bypass. Erosion never closes terrain.',
      'Користуйтеся новою кишенею або зовнішнім обходом. Руйнування не закриває клітини.',
    ],
  ],
  guard: [
    false,
    ['Projectile guard', 'Стрілець-охоронець'],
    [
      'Fires along a fixed, warned direction.',
      'Стріляє у фіксованому напрямку після попередження.',
    ],
    [
      'A dashed aim line precedes the shot; each shot marks its next cell.',
      'Пунктирний приціл передує пострілу; кожен снаряд позначає наступну клітину.',
    ],
    [
      'Dodge with your head and catch from the side. Your cable is immune to shots.',
      'Ухиляйтеся головою й ловіть збоку. Постріли не шкодять кабелю.',
    ],
  ],
};
export function classicMechanicGuide(kind, locale = 'en') {
  const row = guides[kind];
  if (!row) return actorFieldGuide(kind, locale);
  const index = locale === 'uk' ? 1 : 0;
  return {
    id: kind,
    kind,
    specialist: row[0],
    name: row[1][index],
    goal: row[2][index],
    tell: row[3][index],
    counter: row[4][index],
  };
}
export function renderClassicEnemyFieldGuide(container, kinds, options = {}) {
  return renderEnemyFieldGuide(container, kinds, {
    ...options,
    resolveEntry: classicMechanicGuide,
    drawActor: drawClassicTarget,
  });
}
