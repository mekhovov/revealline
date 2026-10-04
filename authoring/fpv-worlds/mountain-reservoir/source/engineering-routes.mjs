import { hold, land, gate } from './land-routes.mjs';
export function engineeringRouteCandidates(base) {
  const data = [
    {
      suffix: '03',
      en: {
        title: 'Intake controls',
        brief:
          'Approach the dam-side control station, brake in front of its closed instrument panel and settle above the gallery landing mark. Stay west of the shoreline rail.',
        lesson:
          'This is a land-side inspection of the intake controls, not an underwater flight. The gallery, housing and rails are solid. Align above the marked support before descending.',
      },
      uk: {
        title: 'Пульт водозабору',
        brief:
          'Підійдіть до пункту керування біля греблі, загальмуйте перед закритою панеллю приладів і стабілізуйтеся над посадковою міткою галереї. Залишайтеся на захід від берегової огорожі.',
        lesson:
          'Це огляд керування водозабором із боку суші, а не підводний політ. Галерея, корпус та огорожі тверді. Перед зниженням вирівняйтеся над позначеною опорою.',
      },
      steps: {
        'self-level': [
          hold([-3, 5.2, 12]),
          gate('z', -12, -1, 2.2, 6.2, 3),
          hold([-4, 5.4, -18.5]),
          hold([2.2, 5.8, -22.65], [1.8, 1.3, 1.8]),
          land([2.2, 3.8, -22.65], 'platform-intake-gallery', [2, 1.1, 2]),
        ],
        acro: [
          hold([1.8, 6, 12]),
          gate('z', -11, -1, 1.8, 6, 2.6),
          gate('x', -2, -1, -17, 5.6, 2.6),
          hold([-4, 5.4, -18.5]),
          hold([2.2, 5.8, -22.65], [1.8, 1.3, 1.8]),
          land([2.2, 3.8, -22.65], 'platform-intake-gallery', [2, 1.1, 2]),
        ],
      },
    },
    {
      suffix: '04',
      en: {
        title: 'Dry spillway descent',
        brief:
          'Climb beside the west abutment, enter the dry spillway from above and descend through the height windows. Brake over the lower apron and land on its marked concrete.',
        lesson:
          'Follow the actual sloping channel while staying clear of its sidewalls. This maintenance route is dry; the dam has no hidden opening and no flowing-water physics is simulated.',
      },
      uk: {
        title: 'Спуск сухим водоскидом',
        brief:
          'Наберіть висоту біля західного устою, увійдіть у сухий водоскид згори й спускайтеся крізь висотні створи. Загальмуйте над нижнім майданчиком і сядьте на позначений бетон.',
        lesson:
          'Рухайтеся вздовж справжнього похилого каналу, тримаючись подалі від бічних стінок. Оглядовий маршрут сухий; у греблі немає прихованого отвору, а фізика потоку води не моделюється.',
      },
      steps: {
        'self-level': [
          hold([-15, 7, -17]),
          hold([-15, 12, -22]),
          hold([-11, 12.2, -27]),
          gate('z', -22, 1, -11, 10.5, 2.3),
          gate('z', -16, 1, -11, 7.6, 2.3),
          hold([-11, 7.6, -15], [2, 1.3, 2]),
          gate('z', -10, 1, -11, 4.9, 2.3),
          gate('z', -4, 1, -11, 2.8, 2.3),
          land([-11, 0.8, -2], 'platform-spillway-apron', [2.8, 1.1, 3]),
        ],
        acro: [
          hold([-15, 7.5, -17]),
          hold([-15, 12.5, -22]),
          hold([-11, 12.4, -27]),
          gate('z', -22, 1, -11, 10.7, 2.1),
          gate('z', -16, 1, -11, 7.8, 2.1),
          gate('z', -10, 1, -11, 5.1, 2.1),
          gate('z', -4, 1, -11, 3, 2.1),
          land([-11, 0.8, -2], 'platform-spillway-apron', [2.8, 1.1, 3]),
        ],
      },
    },
    {
      suffix: '07',
      en: {
        title: 'Shoreline circuit',
        brief:
          'Follow the ordered shoreline windows, climb past the dam-side works, then return above the rock terraces to the shore pad. Every section stays over the playable land side of the yellow rail.',
        lesson:
          'Look ahead to the next height and turn before committing to a line. This is a scenic land-side circuit, not an island orbit or permission to fly beyond the reservoir boundary.',
      },
      uk: {
        title: 'Берегове коло',
        brief:
          'Пройдіть берегові створи за порядком, підніміться повз споруди біля греблі й поверніться над кам’яними терасами на береговий майданчик. Усі ділянки залишаються над доступною сушею із західного боку жовтої огорожі.',
        lesson:
          'Перед вибором траєкторії оцініть наступні висоту й поворот. Це оглядове коло над сушею, а не обліт острова чи дозвіл перетинати межу водосховища.',
      },
      steps: {
        'self-level': [
          hold([-27, 4, 26]),
          gate('x', -3, 1, 26, 4, 3.5),
          hold([2, 5, 15]),
          gate('z', 4, -1, 2, 6, 3),
          gate('z', -12, -1, 2, 9.5, 3),
          hold([1, 12, -18.5]),
          gate('x', -14, -1, -20, 12, 3),
          hold([-32, 12, -4]),
          gate('z', 16, 1, -32, 12, 3),
          hold([-30, 5, 23]),
          land([-30, 0.9, 26], 'platform-shore-pad', [5, 1.1, 5]),
        ],
        acro: [
          hold([-27, 4.5, 26]),
          gate('x', -3, 1, 26, 4.5, 3),
          gate('z', 12, -1, 2, 5.5, 2.8),
          gate('z', 2, -1, 2, 7, 2.8),
          gate('z', -12, -1, 2, 10, 2.8),
          hold([1, 12.5, -18.5]),
          gate('x', -14, -1, -20, 12.5, 2.8),
          hold([-32, 12.5, -4]),
          gate('z', 16, 1, -32, 12.5, 2.8),
          hold([-30, 5.5, 23]),
          land([-30, 0.9, 26], 'platform-shore-pad', [5, 1.1, 5]),
        ],
      },
    },
  ];
  return data.map(({ suffix, en, uk, steps }) => ({
    ...structuredClone(base),
    id: 'mountain-reservoir-' + suffix,
    locales: { en, uk },
    steps,
  }));
}
