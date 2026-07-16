import type { LessonItem, SenseiLesson } from '../types/lesson';
import { hydrateLessonVocabulary } from '../services/vocabularyEntryService';

type FoundationItem = {
  id: string;
  japanese: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
};

function item(lessonId: string, index: number, content: FoundationItem): LessonItem {
  return {
    ...content,
    id: `${lessonId}-${index}`,
    category: 'daily-life',
    exampleJapanese: content.japanese,
    exampleRomaji: content.romaji,
    exampleEnglish: content.english,
    translationReviewStatus: 'approved',
    contentReviewStatus: 'sensei-reviewed',
  };
}

function lesson(
  id: string,
  day: number,
  title: string,
  objective: string,
  summary: string,
  items: FoundationItem[],
): SenseiLesson {
  return {
    id: `absolute-beginner-${id}`,
    title,
    level: 'Absolute Beginner',
    week: 1,
    day,
    category: 'daily-life',
    objective,
    summary,
    items: items.map((content, index) => item(id, index + 1, content)),
  };
}

export const absoluteBeginnerLessons: SenseiLesson[] = [
  lesson('greetings', 1, 'Your First Japanese Greetings', 'Recognize and say a few friendly Japanese greetings.', 'Start speaking immediately with useful greetings and polite thanks.', [
    { id: 'ohayou', japanese: 'おはようございます', romaji: 'ohayou gozaimasu', english: 'Good morning (polite).', vietnamese: 'Chào buổi sáng (lịch sự).', filipino: 'Magandang umaga po.' },
    { id: 'konnichiwa', japanese: 'こんにちは', romaji: 'konnichiwa', english: 'Hello / good afternoon.', vietnamese: 'Xin chào / chào buổi chiều.', filipino: 'Magandang hapon po.' },
    { id: 'arigatou', japanese: 'ありがとうございます', romaji: 'arigatou gozaimasu', english: 'Thank you very much.', vietnamese: 'Cảm ơn rất nhiều.', filipino: 'Maraming salamat po.' },
    { id: 'sumimasen', japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me / I am sorry.', vietnamese: 'Xin lỗi / cho tôi hỏi.', filipino: 'Paumanhin / excuse me po.' },
  ]),
  lesson('hiragana-vowels', 2, 'Hiragana: The Five Vowels', 'Read and recognize あ, い, う, え, and お.', 'Build your first Japanese reading foundation with the five vowel sounds.', [
    { id: 'a', japanese: 'あ', romaji: 'a', english: 'The a sound.', vietnamese: 'Âm a.', filipino: 'Tunog a.' },
    { id: 'i', japanese: 'い', romaji: 'i', english: 'The i sound.', vietnamese: 'Âm i.', filipino: 'Tunog i.' },
    { id: 'u', japanese: 'う', romaji: 'u', english: 'The u sound.', vietnamese: 'Âm u.', filipino: 'Tunog u.' },
    { id: 'eo', japanese: 'え・お', romaji: 'e / o', english: 'The e and o sounds.', vietnamese: 'Âm e và o.', filipino: 'Tunog e at o.' },
  ]),
  lesson('hiragana-k-lines', 3, 'Hiragana: K Sounds', 'Read the k-row syllables and combine them with the vowels.', 'Practice reading か, き, く, け, and こ without memorizing whole words yet.', [
    { id: 'ka', japanese: 'か', romaji: 'ka', english: 'ka sound.', vietnamese: 'Âm ka.', filipino: 'Tunog ka.' },
    { id: 'ki', japanese: 'き', romaji: 'ki', english: 'ki sound.', vietnamese: 'Âm ki.', filipino: 'Tunog ki.' },
    { id: 'ku', japanese: 'く', romaji: 'ku', english: 'ku sound.', vietnamese: 'Âm ku.', filipino: 'Tunog ku.' },
    { id: 'keko', japanese: 'け・こ', romaji: 'ke / ko', english: 'ke and ko sounds.', vietnamese: 'Âm ke và ko.', filipino: 'Tunog ke at ko.' },
  ]),
  lesson('hiragana-s-t-lines', 4, 'Hiragana: S and T Sounds', 'Read common s-row and t-row syllables.', 'Expand your kana reading with two more sound families.', [
    { id: 'sa', japanese: 'さ', romaji: 'sa', english: 'sa sound.', vietnamese: 'Âm sa.', filipino: 'Tunog sa.' },
    { id: 'shi', japanese: 'し', romaji: 'shi', english: 'shi sound.', vietnamese: 'Âm shi.', filipino: 'Tunog shi.' },
    { id: 'ta', japanese: 'た', romaji: 'ta', english: 'ta sound.', vietnamese: 'Âm ta.', filipino: 'Tunog ta.' },
    { id: 'chi-tsu', japanese: 'ち・つ', romaji: 'chi / tsu', english: 'chi and tsu sounds.', vietnamese: 'Âm chi và tsu.', filipino: 'Tunog chi at tsu.' },
  ]),
  lesson('katakana', 5, 'Katakana: Names and Loanwords', 'Recognize the purpose and basic shapes of katakana.', 'Understand that katakana is used for many foreign names, places, and loanwords.', [
    { id: 'a', japanese: 'ア', romaji: 'a', english: 'Katakana a.', vietnamese: 'Katakana a.', filipino: 'Katakana a.' },
    { id: 'ka', japanese: 'カ', romaji: 'ka', english: 'Katakana ka.', vietnamese: 'Katakana ka.', filipino: 'Katakana ka.' },
    { id: 'koohii', japanese: 'コーヒー', romaji: 'koohii', english: 'Coffee.', vietnamese: 'Cà phê.', filipino: 'Kape.' },
    { id: 'terebi', japanese: 'テレビ', romaji: 'terebi', english: 'Television.', vietnamese: 'Tivi.', filipino: 'Telebisyon.' },
  ]),
  lesson('numbers-time', 6, 'Numbers, Time, and Days', 'Recognize basic numbers and simple time expressions.', 'Use beginner numbers for prices, schedules, and everyday routines.', [
    { id: 'ichi', japanese: 'いち', romaji: 'ichi', english: 'One.', vietnamese: 'Một.', filipino: 'Isa.' },
    { id: 'ni', japanese: 'に', romaji: 'ni', english: 'Two.', vietnamese: 'Hai.', filipino: 'Dalawa.' },
    { id: 'san', japanese: 'さん', romaji: 'san', english: 'Three.', vietnamese: 'Ba.', filipino: 'Tatlo.' },
    { id: 'nanji', japanese: 'なんじですか', romaji: 'nanji desu ka', english: 'What time is it?', vietnamese: 'Mấy giờ?', filipino: 'Anong oras na po?' },
  ]),
  lesson('basic-sentences', 7, 'Your First Japanese Sentences', 'Use simple patterns to identify yourself and things.', 'Build confidence with short sentences before studying formal grammar terms.', [
    { id: 'watashi', japanese: 'わたしは ___ です', romaji: 'watashi wa ___ desu', english: 'I am ___.', vietnamese: 'Tôi là ___.', filipino: 'Ako si ___.' },
    { id: 'kore', japanese: 'これは ___ です', romaji: 'kore wa ___ desu', english: 'This is ___.', vietnamese: 'Đây là ___.', filipino: 'Ito ay ___.' },
    { id: 'hajimemashite', japanese: 'はじめまして', romaji: 'hajimemashite', english: 'Nice to meet you.', vietnamese: 'Rất vui được gặp bạn.', filipino: 'Ikinagagalak kitang makilala.' },
    { id: 'yoroshiku', japanese: 'よろしくおねがいします', romaji: 'yoroshiku onegaishimasu', english: 'Please treat me well.', vietnamese: 'Rất mong được giúp đỡ.', filipino: 'Sana ay maging mabuti ang samahan natin.' },
  ]),
  lesson('classroom-survival', 8, 'When You Do Not Understand', 'Ask for repetition, slower speech, and help.', 'Learn the phrases that let a new learner continue even when Japanese feels difficult.', [
    { id: 'wakarimasen', japanese: 'わかりません', romaji: 'wakarimasen', english: 'I do not understand.', vietnamese: 'Tôi không hiểu.', filipino: 'Hindi ko po naiintindihan.' },
    { id: 'mouichido', japanese: 'もういちどおねがいします', romaji: 'mou ichido onegaishimasu', english: 'One more time, please.', vietnamese: 'Vui lòng nói lại một lần nữa.', filipino: 'Pakiulit po.' },
    { id: 'yukkuri', japanese: 'ゆっくりおねがいします', romaji: 'yukkuri onegaishimasu', english: 'Slowly, please.', vietnamese: 'Vui lòng nói chậm.', filipino: 'Dahan-dahan po, pakiusap.' },
    { id: 'daijoubu', japanese: 'だいじょうぶです', romaji: 'daijoubu desu', english: 'It is okay / I am okay.', vietnamese: 'Ổn / Tôi ổn.', filipino: 'Ayos lang / Okay lang ako.' },
  ]),
];

hydrateLessonVocabulary(absoluteBeginnerLessons);
