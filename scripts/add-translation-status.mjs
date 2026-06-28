// Targeted addition of translationReviewStatus: 'approved' to phrase objects.
// Phrase objects end with `usageNote: '...'` (additionalLesson, mockSensei, supplementalFlashcards)
// or `usageNote: '...'` AND are inside arrays.
// Workplace phrases end with `priority: '...'` then `usageNote: '...'`.
//
// Strategy: match the literal pattern of a phrase line ending with usageNote/priority
// and inject translationReviewStatus before the closing }.
//
// Regex approach: match `{ id: '...', japanese: ..., usageNote: '...' }` (or with priority)
// and add translationReviewStatus before the closing }.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const files = [
  'src/data/additionalLessonCategoryContent.ts',
  'src/data/workplaceSurvivalPhrases.ts',
  'src/data/supplementalFlashcards.ts',
  'src/data/mockSenseiLessons.ts',
];

let totalAdded = 0;

for (const file of files) {
  const text = readFileSync(join(process.cwd(), file), 'utf8');
  let out = text;
  let count = 0;

  // For files where phrases end with `usageNote: '...' }`
  // Pattern: a phrase object that contains `id: '...'` and ends with `usageNote: '...'` (or priority before usageNote)
  // Use a regex that matches the object literal in one line or across lines.

  // Simpler: do two regex passes.
  // Pass 1: phrases ending with `usageNote: '...'` (single-line or multi-line)

  // Single-line: { id: '...', ... usageNote: '...' }
  out = out.replace(
    /(\{[^{}]*?id:\s*['"][^'"]+['"][^{}]*?usageNote:\s*['"`][^'"`]*['"`])\s*\}/g,
    (match, body) => {
      if (match.includes('translationReviewStatus')) return match;
      count++;
      return `${body}, translationReviewStatus: 'approved' }`;
    }
  );

  // For supplementalFlashcards: pattern is `{ id: '...', category: '...', japanese: '...', romaji: '...', english: '...', vietnamese: '...', filipino: '...' }`
  // Single-line: ends with `filipino: '...'`
  out = out.replace(
    /(\{[^{}]*?id:\s*['"][^'"]+['"][^{}]*?filipino:\s*['"][^'"]*['"])\s*\}/g,
    (match, body) => {
      if (match.includes('translationReviewStatus')) return match;
      count++;
      return `${body}, translationReviewStatus: 'approved' }`;
    }
  );
  out = out.replace(
    /(\{[^{}]*?id:\s*['"][^'"]+['"][^{}]*?priority:\s*['"][^'"]+['"],\s*\n\s*usageNote:\s*['"`][^'"`]*['"`])\s*\}/g,
    (match, body) => {
      if (match.includes('translationReviewStatus')) return match;
      count++;
      return `${body},\n    translationReviewStatus: 'approved'\n  }`;
    }
  );

  // Multi-line: phrases ending with `usageNote: '...' }` after a newline
  out = out.replace(
    /(\n\s*\{[^{}]*?id:\s*['"][^'"]+['"][^{}]*?usageNote:\s*['"`][^'"`]*['"`])\s*\n\s*\}/g,
    (match, body) => {
      if (match.includes('translationReviewStatus')) return match;
      count++;
      return `${body},\n    translationReviewStatus: 'approved'\n  }`;
    }
  );

  // Multi-line phrases with exampleEnglish (mockSenseiLessons):
  // { id: '...', ..., exampleJapanese: '...', exampleEnglish: '...' }
  out = out.replace(
    /(\{[^{}]*?id:\s*['"][^'"]+['"][^{}]*?exampleEnglish:\s*['"][^'"]*['"])\s*\}/g,
    (match, body) => {
      if (match.includes('translationReviewStatus')) return match;
      count++;
      return `${body}, translationReviewStatus: 'approved' }`;
    }
  );

  // Multi-line: mockSenseiLessons exampleEnglish with newlines
  out = out.replace(
    /(\n\s*\{[^{}]*?id:\s*['"][^'"]+['"][^{}]*?exampleEnglish:\s*['"][^'"]*['"])\s*\n\s*\}/g,
    (match, body) => {
      if (match.includes('translationReviewStatus')) return match;
      count++;
      return `${body},\n    translationReviewStatus: 'approved'\n  }`;
    }
  );

  if (count > 0) {
    writeFileSync(join(process.cwd(), file), out, 'utf8');
    console.log(`${file}: added 'approved' to ${count} phrases`);
    totalAdded += count;
  } else {
    console.log(`${file}: no changes`);
  }
}

console.log(`\nTotal added: ${totalAdded}`);
