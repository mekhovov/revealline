import { dataIdentity } from '../data-json.mjs';
import { validateCampaignFeedback } from '../journey/campaign-feedback.mjs';

// Original presentation lines. They celebrate the arcade route, not real-world
// certification, cultural identity, or the conduct of a named community.
const scenes = {
  'social-drone-people-workshop': [
    'Another window lights up in the workshop.',
    'У майстерні засвітилося ще одне вікно.',
  ],
  'social-drone-community-connections': [
    'Your route brings another corner of the community into view.',
    'Ваш маршрут відкриває ще один куточок спільноти.',
  ],
  'victory-drones-knowledge-connects': [
    'Another discovery joins the learning wall.',
    'Ще одне відкриття з’явилося на стіні знань.',
  ],
  'victory-drones-ideas-understanding': [
    'The idea gallery has a new piece to explore.',
    'У галереї ідей є новий експонат для дослідження.',
  ],
  'ukraine-threads': [
    'Another thread joins your exhibition.',
    'Ще одна нитка доповнила вашу виставку.',
  ],
  'ukraine-colour-clay-spring': [
    'Colour and clay reveal another detail.',
    'Колір і глина відкривають ще одну деталь.',
  ],
  'ukraine-crimea-ornek': [
    'Another ornament story is ready to explore.',
    'Ще одна історія орнаменту чекає на дослідження.',
  ],
  'ukraine-voices-travel': [
    'Another voice finds a place in your collection.',
    'Ще один голос знайшов місце у вашій колекції.',
  ],
  'ukraine-cities-symbols-time': [
    'Your city atlas opens another page.',
    'Ваш атлас міст відкриває ще одну сторінку.',
  ],
  'ukraine-everyday-culture': [
    'Another everyday story joins the table.',
    'За столом з’явилася ще одна повсякденна історія.',
  ],
  'fpv-meet-aircraft': [
    'Another component comes into focus.',
    'Ще один компонент став зрозумілішим.',
  ],
  'fpv-parts-bench': [
    'Another part of the bench model is revealed.',
    'Відкрилася ще одна частина навчальної моделі.',
  ],
  'fpv-soldering-workshop': [
    'Another workshop observation is ready.',
    'Готове ще одне спостереження з майстерні.',
  ],
  'fpv-four-controls': [
    'Your route opens another control concept.',
    'Ваш маршрут відкриває ще одне поняття керування.',
  ],
  'fpv-first-flight': [
    'A new flight-pattern illustration joins your collection.',
    'Нова ілюстрація траєкторії поповнила вашу колекцію.',
  ],
  'fpv-drone-families': [
    'Another aircraft family enters the gallery.',
    'Ще одна родина апаратів з’явилася в галереї.',
  ],
  'fpv-drones-ukraine': [
    'Another source-linked story is ready to inspect.',
    'Ще одна історія з джерелами готова до перегляду.',
  ],
  'fpv-care-repair': [
    'Another care decision joins your reference cards.',
    'Ще одне рішення з догляду поповнило ваші довідкові картки.',
  ],
};
export function curriculumCampaignFeedback(campaignId) {
  const line = scenes[campaignId];
  if (!line) throw new Error('Missing authored campaign feedback: ' + campaignId);
  const content = {
    lines: { en: [line[0]], uk: [line[1]] },
    victoryMotif: campaignId.startsWith('ukraine-')
      ? 'open-horizon-v1'
      : campaignId.startsWith('fpv-')
        ? 'bright-return-v1'
        : 'shared-spark-v1',
  };
  return validateCampaignFeedback({
    format: 'revealline-campaign-feedback.v1',
    revision: `feedback-${dataIdentity(content)}`,
    ...content,
  });
}
