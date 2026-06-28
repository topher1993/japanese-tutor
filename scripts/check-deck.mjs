import { createFlashcardDeck } from '../src/services/flashcardService.ts';
import { getAllLessons } from '../src/services/lessonService.ts';
import { supplementalFlashcards } from '../src/data/supplementalFlashcards.ts';

console.log('mockSenseiLessons items:', getAllLessons().reduce((s, l) => s + l.items.length, 0));
console.log('supplementalFlashcards:', supplementalFlashcards.length);
const deck = createFlashcardDeck(getAllLessons());
console.log('deck.cards.length:', deck.cards.length);
const uniq = new Set(deck.cards.map(c => c.japanese));
console.log('unique JP values:', uniq.size);
const dupes = {};
deck.cards.forEach(c => { dupes[c.japanese] = (dupes[c.japanese] || 0) + 1; });
const d = Object.entries(dupes).filter(([_, c]) => c > 1);
console.log('JP duplicates:', d);
