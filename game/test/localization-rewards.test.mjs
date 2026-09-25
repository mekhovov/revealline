import test from 'node:test';
import assert from 'node:assert/strict';
import { t, getLocale, setLocale } from '../i18n/index.mjs';
import { emptyProgress, appearanceMilestones, achievements } from '../progress.mjs';
import { milestoneName, achievementName, achievementDescription } from '../ui/reward-copy.mjs';

test('reward presentation uses derived targets and leaves canonical progress records untouched', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  for (const length of [1, 2, 3, 4, 12]) {
    const campaign = {
      version: 'xonix-campaign.v1',
      id: 'reward-copy',
      revision: '1',
      levels: Array.from({ length }, (_, index) => ({ id: `map-${index}` })),
    };
    const progress = emptyProgress(campaign);
    const milestones = appearanceMilestones(progress, campaign);
    const badges = achievements(progress, campaign);
    const target = milestones.find((tier) => tier.id === 'chapter-explorer').target;
    const before = JSON.stringify({ campaign, progress, milestones, badges });
    for (const language of ['en', 'uk', 'en']) {
      setLocale(language, { persist: false });
      for (const milestone of milestones) {
        if (language === 'en') assert.equal(milestoneName(milestone), milestone.name);
        else assert.match(milestoneName(milestone), /[А-Яа-яІіЇїЄєҐґ]/);
      }
      for (const badge of badges) {
        if (language === 'en') {
          assert.equal(achievementName(badge), badge.name);
          assert.equal(achievementDescription(badge, target), badge.description);
        } else {
          assert.match(achievementName(badge), /[А-Яа-яІіЇїЄєҐґ]/);
          assert.match(achievementDescription(badge, target), /[А-Яа-яІіЇїЄєҐґ]/);
          assert.doesNotMatch(
            achievementDescription(badge, target),
            /mission|undefined|achievements:/,
          );
        }
      }
      assert.equal(JSON.stringify({ campaign, progress, milestones, badges }), before);
    }
  }
});

test('reward progress and remaining missions use Ukrainian plural categories and decimal formatting', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('uk', { persist: false });
  for (const [count, noun] of [
    [0, 'місій'],
    [1, 'місію'],
    [2, 'місії'],
    [5, 'місій'],
    [11, 'місій'],
    [21, 'місію'],
    [22, 'місії'],
    [1.5, 'місії'],
  ]) {
    const number = new Intl.NumberFormat('uk').format(count);
    assert.match(t('interface:rewards.remaining', { count }), new RegExp(`ще ${number} ${noun}`));
    for (const key of ['interface:rewards.availableProgress', 'interface:rewards.lockedProgress']) {
      const text = t(key, { completed: 0, count });
      assert.ok(text.includes(`0 / ${number}`));
      assert.doesNotMatch(text, /mission|undefined|rewards\./);
    }
  }
});
