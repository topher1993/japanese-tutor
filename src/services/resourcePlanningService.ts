export function getDesignSystemSummary() {
  return { tone: 'professional-friendly', palette: { primary: '#256D85', safety: '#E76F51', calm: '#F8FAF7', success: '#2A9D8F' }, components: ['SurvivalTopicCard', 'EmergencyPhraseCard', 'LanguageSupportBadge', 'PhrasePracticeCard', 'SafetyAccentBanner'], forbiddenAssets: ['copyrighted characters', 'anime characters', 'Solo Leveling assets', 'company confidential assets'] } as const;
}
export function getAssetGenerationPrompts(): string[] {
  return [
    'professional friendly mobile illustration of diverse foreign workers learning workplace safety Japanese on a phone, no brands, realistic clean vector style',
    'simple workplace safety icon set: helmet, gloves, stop sign, emergency help, schedule clock, clean vector style',
    'beginner-friendly workplace survival lesson card graphics with calm blue and teal color palette',
    'empty state illustration for completed Japanese practice, professional workplace appropriate style'
  ];
}
