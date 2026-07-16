import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('App.tsx', 'utf8');
const navigation = readFileSync('src/app/useAppNavigation.ts', 'utf8');
const renderTab = readFileSync('src/app/renderTab.tsx', 'utf8');
const home = readFileSync('src/screens/HomeScreen.tsx', 'utf8');
const lessons = readFileSync('src/screens/LessonsScreen.tsx', 'utf8');
const lab = readFileSync('src/screens/SentenceLabScreen.tsx', 'utf8');

describe('Listening & Sentence Lab integration', () => {
  it('is reachable directly from Home and from Lessons tools', () => {
    expect(home).toContain('home-sentence-lab-cta');
    expect(home).toContain('Start Sentence Lab');
    expect(lessons).toContain('Listening & Sentence Lab');
    expect(lessons).toContain('onOpenSentenceLab');
    expect(renderTab).toContain('onOpenSentenceLab={props.onOpenSentenceLab}');
  });

  it('has a top-level back route and a development deep-link gate', () => {
    expect(navigation).toContain("getParam('screen') === 'sentence-lab'");
    expect(app).toContain('if (nav.showSentenceLab)');
    expect(app).toContain('nav.setShowSentenceLab(false)');
  });

  it('exposes audio, sentence-order, and mistake-review controls', () => {
    expect(lab).toContain('sentence-lab-play-audio');
    expect(lab).toContain('sentence-lab-check-order');
    expect(lab).toContain('Mistake Notebook');
    expect(lab).toContain('recordSentenceLabResult');
  });
});
