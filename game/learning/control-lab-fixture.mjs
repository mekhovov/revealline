import { CONTROL_LAB_FORMAT } from './control-lab.mjs';

/** Original educational copy. Source links remain explicit reading actions. */
export const FOUR_CONTROLS_FIXTURE = {
  format: CONTROL_LAB_FORMAT,
  id: 'civilian-four-controls',
  revision: 'v1',
  scenario: 'civilian-training',
  layout: 'mode-2',
  locales: {
    en: {
      title: 'Understand the four controls',
      summary:
        'Explore a civilian training aircraft one command at a time. Compare its orientation with the direction of a stick command.',
    },
    uk: {
      title: 'Зрозумійте чотири органи керування',
      summary:
        'Досліджуйте навчальний цивільний апарат по одній команді. Порівнюйте його орієнтацію з напрямком руху стика.',
    },
  },
  controls: [
    {
      id: 'throttle',
      sourceIds: ['mode-2', 'stabilized', 'position'],
      locales: {
        en: {
          title: 'Throttle',
          explanation:
            'Throttle is a thrust-related command. Its effect depends on the flight mode; this diagram does not predict height or show a hover setting.',
          negative: 'Lower command.',
          neutral: 'Idle illustration: no thrust command is shown.',
          positive: 'A larger thrust-related command is shown. This is not a measured climb rate.',
        },
        uk: {
          title: 'Газ',
          explanation:
            'Газ задає команду, пов’язану з тягою. Її дія залежить від режиму польоту; схема не прогнозує висоту й не показує положення зависання.',
          negative: 'Менша команда.',
          neutral: 'Початковий стан: команда тяги не показана.',
          positive: 'Показано більшу команду тяги. Це не виміряна швидкість набору висоти.',
        },
      },
    },
    {
      id: 'yaw',
      sourceIds: ['mode-2', 'stabilized'],
      locales: {
        en: {
          title: 'Yaw',
          explanation:
            'Yaw changes the direction the nose faces around the vertical axis. Turning the nose and moving sideways are different actions.',
          negative: 'Turn the nose left.',
          neutral: 'No left or right yaw command.',
          positive: 'Turn the nose right.',
        },
        uk: {
          title: 'Рискання',
          explanation:
            'Рискання змінює напрямок носа навколо вертикальної осі. Поворот носа й переміщення вбік — різні дії.',
          negative: 'Поверніть ніс ліворуч.',
          neutral: 'Немає команди рискання ліворуч або праворуч.',
          positive: 'Поверніть ніс праворуч.',
        },
      },
    },
    {
      id: 'pitch',
      sourceIds: ['mode-2', 'stabilized'],
      locales: {
        en: {
          title: 'Pitch',
          explanation:
            'Pitch tilts the nose down or up around the side-to-side axis. The direction of a tilt is not a promise of speed or position.',
          negative: 'Stick back: nose-up illustration.',
          neutral: 'No forward or backward pitch command.',
          positive: 'Stick forward: nose-down illustration.',
        },
        uk: {
          title: 'Тангаж',
          explanation:
            'Тангаж нахиляє ніс униз або вгору навколо поперечної осі. Напрямок нахилу не визначає наперед швидкість чи положення.',
          negative: 'Стик назад: показано піднятий ніс.',
          neutral: 'Немає команди тангажу вперед або назад.',
          positive: 'Стик уперед: показано опущений ніс.',
        },
      },
    },
    {
      id: 'roll',
      sourceIds: ['mode-2', 'stabilized'],
      locales: {
        en: {
          title: 'Roll',
          explanation:
            'Roll banks the aircraft around its nose-to-tail axis. Compare the tilted body with the horizontal reference line.',
          negative: 'Bank left.',
          neutral: 'No left or right roll command.',
          positive: 'Bank right.',
        },
        uk: {
          title: 'Крен',
          explanation:
            'Крен нахиляє апарат навколо поздовжньої осі. Порівняйте нахил корпуса з горизонтальною опорною лінією.',
          negative: 'Крен ліворуч.',
          neutral: 'Немає команди крену ліворуч або праворуч.',
          positive: 'Крен праворуч.',
        },
      },
    },
  ],
  sources: [
    {
      id: 'mode-2',
      title: 'ArduPilot: radio control layouts',
      url: 'https://ardupilot.org/copter/docs/common-radio-control-calibration.html',
    },
    {
      id: 'stabilized',
      title: 'PX4: Manual / Stabilized mode',
      url: 'https://docs.px4.io/main/en/flight_modes_mc/manual_stabilized',
    },
    {
      id: 'position',
      title: 'PX4: Position mode',
      url: 'https://docs.px4.io/v1.17/en/flight_modes_mc/position',
    },
  ],
};
