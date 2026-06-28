import { describe, expect, it } from 'vitest';
import { getSurvivalCategories, getSurvivalTopicDetail, getPriorityEmergencyPhrases, searchSurvivalPhrases } from '../src/services/workplaceSurvivalService';
import { getDesignSystemSummary, getAssetGenerationPrompts } from '../src/services/resourcePlanningService';
import { buildDeviceQaChecklist } from '../src/services/deviceQaService';

describe('Phase 5 workplace survival product layer', () => {
  it('groups survival topics into practical workplace categories', () => {
    const categories = getSurvivalCategories();
    expect(categories.map(category => category.id)).toEqual(expect.arrayContaining(['greetings', 'safety', 'schedule', 'emergency']));
    const safety = categories.find(category => category.id === 'safety')!;
    expect(safety.phraseCount).toBeGreaterThanOrEqual(4);
    expect(safety.description).toContain('safety');
  });

  it('returns multilingual topic details with Japanese, romaji, English, Vietnamese, and Filipino', () => {
    const detail = getSurvivalTopicDetail('safety');
    expect(detail.title).toBe('Safety Instructions');
    expect(detail.phrases.length).toBeGreaterThanOrEqual(4);
    expect(detail.phrases[0]).toMatchObject({ japanese: expect.any(String), romaji: expect.any(String), english: expect.any(String), vietnamese: expect.any(String), filipino: expect.any(String) });
    expect(detail.coachTip).toContain('short');
  });

  it('prioritizes emergency phrases separately for quick access', () => {
    const emergency = getPriorityEmergencyPhrases();
    expect(emergency.length).toBeGreaterThanOrEqual(3);
    expect(emergency.map(phrase => phrase.japanese)).toContain('助けてください');
    expect(emergency.every(phrase => phrase.priority === 'emergency')).toBe(true);
  });

  it('searches survival phrases across translations and romanization', () => {
    expect(searchSurvivalPhrases('helmet').map(p => p.japanese)).toContain('ヘルメットを着けてください');
    expect(searchSurvivalPhrases('tardiness').map(p => p.english).join(' ')).toContain('late');
    expect(searchSurvivalPhrases('tulong').map(p => p.filipino).join(' ')).toContain('tulong');
  });

  it('defines a workplace-appropriate design and asset generation plan', () => {
    const design = getDesignSystemSummary();
    expect(design.tone).toBe('professional-friendly');
    expect(design.forbiddenAssets).toContain('anime characters');
    expect(design.components).toEqual(expect.arrayContaining(['SurvivalTopicCard', 'EmergencyPhraseCard', 'LanguageSupportBadge']));
    const prompts = getAssetGenerationPrompts();
    expect(prompts.every(prompt => !prompt.toLowerCase().includes('anime'))).toBe(true);
    expect(prompts.some(prompt => prompt.includes('workplace safety'))).toBe(true);
  });

  it('creates mobile QA checklist for small-screen survival flows', () => {
    const checklist = buildDeviceQaChecklist('Workplace Survival');
    expect(checklist.screen).toBe('Workplace Survival');
    expect(checklist.checks).toEqual(expect.arrayContaining(['small-phone readable', 'large touch targets', 'emergency phrases visible without scrolling too far']));
  });
});
