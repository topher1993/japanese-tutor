import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Personalized Mastery System integration', () => {
  it('renders the mastery map on Progress and routes each word group to Flashcards', () => {
    const progress = readFileSync('src/screens/ProgressScreen.tsx', 'utf8');
    const component = readFileSync('src/components/MasteryMapCard.tsx', 'utf8');
    const renderTab = readFileSync('src/app/renderTab.tsx', 'utf8');
    expect(progress).toContain('buildMasteryMap');
    expect(progress).toContain('<MasteryMapCard');
    expect(progress).toContain("track('mastery_focus_opened'");
    expect(component).toContain('memory, reading, listening, and speaking');
    expect(component).toContain('mastery-focus-');
    expect(component).toContain('Phrases & expressions');
    expect(component).toContain('Next items to strengthen');
    expect(component).toContain('Practice weakest items');
    expect(component).toContain('mastery-practice-weak');
    expect(renderTab).toContain('onPracticeWordGroup={props.onPracticeWordGroup}');
    expect(renderTab).toContain('onPracticeTopic={props.onPracticeTopic}');
    expect(renderTab).toContain('onPracticeWeak={props.onPracticeWeak}');
    expect(renderTab).toContain('initialTopic={props.flashcardTopic}');
  });

  it('enforces the evidence-backed mastery gate in week unlocking', () => {
    const weekly = readFileSync('src/services/weeklyTodoService.ts', 'utf8');
    const lessons = readFileSync('src/screens/LessonsScreen.tsx', 'utf8');
    expect(weekly).toContain('evaluatePersistedMasteryGate');
    expect(weekly).toContain('priorBoard.canAdvance && masteryGate.allowed');
    expect(lessons).toContain('Strengthen prerequisite mastery first');
    expect(lessons).toContain('Reach prerequisite mastery to unlock Week');
  });

  it('records mastery evidence from core practice surfaces', () => {
    for (const file of ['FlashcardsScreen.tsx', 'DailyRushScreen.tsx', 'SentenceLabScreen.tsx']) {
      expect(readFileSync(`src/screens/${file}`, 'utf8')).toContain('recordMasteryEvidence');
    }
  });
});
