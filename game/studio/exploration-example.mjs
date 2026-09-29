import { validateExplorationPayload } from '../rewards/exploration.mjs';

/** Small editable authoring example, never automatically installed in an edition.
 * Source reviewed 2026-09-28; fictional classroom scenario, no wiring procedure. */
export function createExplorationExample() {
  return validateExplorationPayload({
    id: 'video-role-atlas',
    type: 'exploration',
    locales: {
      en: {
        title: 'Two roles in a video link',
        intro:
          'Inspect the two cards, then apply their different roles to a fictional classroom diagram. This is a conceptual comparison, not assembly or flight instruction.',
      },
      uk: {
        title: 'Дві ролі у відеозв’язку',
        intro:
          'Розгляньте дві картки, а потім застосуйте відмінності їхніх ролей до вигаданої навчальної схеми. Це порівняння понять, а не інструкція зі складання чи польоту.',
      },
    },
    recipe: {
      id: 'inspect-compare-atlas',
      revision: 1,
      cards: [
        {
          id: 'camera',
          sourceIds: ['video-reference'],
          locales: {
            en: {
              title: 'Camera: create the image',
              body: 'The camera supplies an image of the scene. In our classroom model, this role is separate from carrying the image to a remote display.',
              sourceNote:
                'A simplified civilian teaching model. Real products can integrate several components.',
            },
            uk: {
              title: 'Камера: створити зображення',
              body: 'Камера формує зображення сцени. У нашій навчальній моделі ця роль відокремлена від передавання зображення на віддалений екран.',
              sourceNote:
                'Спрощена цивільна навчальна модель. Реальні вироби можуть поєднувати кілька компонентів.',
            },
          },
        },
        {
          id: 'video-transmitter',
          sourceIds: ['video-reference'],
          locales: {
            en: {
              title: 'VTX: transmit the video',
              body: 'VTX means video transmitter. Its role in this comparison is to send the video signal; it does not replace the camera’s role of observing a scene.',
              sourceNote:
                'Role comparison only. No frequency, power, connection or configuration settings are implied.',
            },
            uk: {
              title: 'VTX: передати відео',
              body: 'VTX означає відеопередавач. У цьому порівнянні він передає відеосигнал, а не замінює роль камери, яка спостерігає за сценою.',
              sourceNote:
                'Лише порівняння ролей. Частоти, потужність, з’єднання й налаштування тут не визначаються.',
            },
          },
        },
      ],
      predictions: [
        {
          id: 'missing-role',
          cardIds: ['camera', 'video-transmitter'],
          expectedChoiceId: 'transmission',
          locales: {
            en: {
              prompt:
                'A fictional diagram already has an “image of the scene” box. Which role belongs in the next box labelled “send this image to the viewing link”?',
              explanation:
                'Separate what creates the information from what carries it. This question applies a role distinction; it does not diagnose hardware.',
            },
            uk: {
              prompt:
                'У вигаданій схемі вже є блок «зображення сцени». Яка роль відповідає наступному блоку «передати це зображення до каналу перегляду»?',
              explanation:
                'Розрізняйте створення інформації та її передавання. Це застосування понять, а не діагностика обладнання.',
            },
          },
          choices: [
            {
              id: 'observation',
              locales: {
                en: {
                  label: 'Create another image',
                  feedback:
                    'That repeats the observation role. The diagram already contains the image; it still needs the separate transmission role.',
                },
                uk: {
                  label: 'Створити ще одне зображення',
                  feedback:
                    'Це повторює роль спостереження. Зображення у схемі вже є; окрема роль передавання ще потрібна.',
                },
              },
            },
            {
              id: 'transmission',
              locales: {
                en: {
                  label: 'Transmit the existing video',
                  feedback:
                    'The VTX role fits this box: it carries the video supplied by the camera. Both roles remain necessary in the simplified diagram.',
                },
                uk: {
                  label: 'Передати наявне відео',
                  feedback:
                    'Цьому блоку відповідає роль VTX: він передає відео від камери. У спрощеній схемі потрібні обидві ролі.',
                },
              },
            },
          ],
        },
      ],
      sources: [
        {
          id: 'video-reference',
          title: 'Betaflight — Video transmitters',
          url: 'https://betaflight.com/docs/wiki/getting-started/hardware/vtx',
        },
      ],
    },
  });
}
