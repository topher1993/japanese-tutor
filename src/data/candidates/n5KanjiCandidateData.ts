import type { KanjiCandidateEntry } from './n5KanjiCandidatePack';

const SOURCE_KANJIDIC = { id: 'kanjidic2-edrdg', license: 'CC BY-SA 4.0' } as const;
const REVIEW = 'approved-for-beta' as const;
const PENDING_VI = '(pending vi review)';
const PENDING_TL = '(pending tl review)';

interface RawKanji {
  kanji: string;
  meanings: string[];
  on: string[];
  kun: string[];
  romaji: string;
  strokes: number;
}

const raw: RawKanji[] = [
  // N5 core kanji (commonly taught first)
  { kanji: '一', meanings: ['one'], on: ['イチ', 'イツ'], kun: ['ひと-', 'ひと.つ'], romaji: 'ichi / hito(tsu)', strokes: 1 },
  { kanji: '二', meanings: ['two'], on: ['ニ', 'フタ'], kun: ['ふた', 'ふた.つ', 'ふたた.び'], romaji: 'ni / futa(tsu)', strokes: 2 },
  { kanji: '三', meanings: ['three'], on: ['サン', 'ゾウ'], kun: ['み', 'み.つ', 'みっ.つ'], romaji: 'san / mi(tsu)', strokes: 3 },
  { kanji: '四', meanings: ['four'], on: ['シ'], kun: ['よ', 'よ.つ', 'よっ.つ', 'よん'], romaji: 'shi / yo(tsu)', strokes: 5 },
  { kanji: '五', meanings: ['five'], on: ['ゴ'], kun: ['いつ', 'いつ.つ'], romaji: 'go / itsu(tsu)', strokes: 4 },
  { kanji: '六', meanings: ['six'], on: ['ロク', 'リク'], kun: ['む', 'む.つ', 'むっ.つ', 'むい'], romaji: 'roku / mu(tsu)', strokes: 4 },
  { kanji: '七', meanings: ['seven'], on: ['シチ'], kun: ['なな', 'なな.つ', 'なの'], romaji: 'shichi / nana(tsu)', strokes: 2 },
  { kanji: '八', meanings: ['eight'], on: ['ハチ'], kun: ['や', 'や.つ', 'やっ.つ', 'よう'], romaji: 'hachi / ya(tsu)', strokes: 2 },
  { kanji: '九', meanings: ['nine'], on: ['キュウ', 'ク'], kun: ['ここの', 'ここの.つ'], romaji: 'kyuu / kokono(tsu)', strokes: 2 },
  { kanji: '十', meanings: ['ten'], on: ['ジュウ', 'ジッ'], kun: ['とお', 'と'], romaji: 'juu / too', strokes: 2 },
  { kanji: '百', meanings: ['hundred'], on: ['ヒャク', 'ビャク'], kun: [], romaji: 'hyaku', strokes: 6 },
  { kanji: '千', meanings: ['thousand'], on: ['セン'], kun: ['ち'], romaji: 'sen', strokes: 3 },
  { kanji: '万', meanings: ['ten thousand'], on: ['マン', 'バン'], kun: [], romaji: 'man', strokes: 3 },
  { kanji: '円', meanings: ['yen', 'circle'], on: ['エン'], kun: ['まる.い'], romaji: 'en', strokes: 4 },
  { kanji: '日', meanings: ['day', 'sun', 'Japan'], on: ['ニチ', 'ジツ'], kun: ['ひ', '-び', '-か'], romaji: 'nichi / hi', strokes: 4 },
  { kanji: '月', meanings: ['moon', 'month'], on: ['ゲツ', 'ガツ'], kun: ['つき'], romaji: 'getsu / tsuki', strokes: 4 },
  { kanji: '火', meanings: ['fire'], on: ['カ'], kun: ['ひ', '-び', 'ほ-'], romaji: 'ka / hi', strokes: 4 },
  { kanji: '水', meanings: ['water'], on: ['スイ'], kun: ['みず', '-みず'], romaji: 'sui / mizu', strokes: 4 },
  { kanji: '木', meanings: ['tree', 'wood'], on: ['ボク', 'モク'], kun: ['き', 'こ-'], romaji: 'boku / ki', strokes: 4 },
  { kanji: '金', meanings: ['gold', 'money', 'metal'], on: ['キン', 'コン', 'ゴン'], kun: ['かね', 'かな-'], romaji: 'kin / kane', strokes: 8 },
  { kanji: '土', meanings: ['soil', 'earth'], on: ['ド', 'ト'], kun: ['つち'], romaji: 'do / tsuchi', strokes: 3 },
  { kanji: '山', meanings: ['mountain'], on: ['サン', 'セン'], kun: ['やま'], romaji: 'san / yama', strokes: 3 },
  { kanji: '川', meanings: ['river'], on: ['セン'], kun: ['かわ', '-がわ'], romaji: 'sen / kawa', strokes: 3 },
  { kanji: '田', meanings: ['rice field'], on: ['デン'], kun: ['た'], romaji: 'den / ta', strokes: 5 },
  { kanji: '人', meanings: ['person'], on: ['ジン', 'ニン'], kun: ['ひと', '-り', '-と'], romaji: 'jin / hito', strokes: 2 },
  { kanji: '口', meanings: ['mouth', 'opening'], on: ['コウ', 'ク'], kun: ['くち'], romaji: 'kouchi / kuchi', strokes: 3 },
  { kanji: '目', meanings: ['eye'], on: ['モク', 'ボク'], kun: ['め', '-め'], romaji: 'moku / me', strokes: 5 },
  { kanji: '耳', meanings: ['ear'], on: ['ジ'], kun: ['みみ'], romaji: 'ji / mimi', strokes: 6 },
  { kanji: '手', meanings: ['hand'], on: ['シュ', 'ズ'], kun: ['て', 'て-', '-て', 'た-'], romaji: 'shu / te', strokes: 4 },
  { kanji: '足', meanings: ['foot', 'leg', 'enough'], on: ['ソク'], kun: ['あし', 'た.りる', 'た.る', 'た.す'], romaji: 'soku / ashi', strokes: 7 },
  { kanji: '心', meanings: ['heart', 'mind'], on: ['シン'], kun: ['こころ'], romaji: 'shin / kokoro', strokes: 4 },
  { kanji: '力', meanings: ['power', 'strength'], on: ['リョク', 'リイ', 'リキ'], kun: ['ちから'], romaji: 'ryoku / chikara', strokes: 2 },
  { kanji: '男', meanings: ['man', 'male'], on: ['ダン', 'ナン'], kun: ['おとこ', 'お'], romaji: 'dan / otoko', strokes: 7 },
  { kanji: '女', meanings: ['woman', 'female'], on: ['ジョ', 'ニョ', 'ニョウ'], kun: ['おんな', 'め'], romaji: 'jo / onna', strokes: 3 },
  { kanji: '子', meanings: ['child'], on: ['シ', 'ス', 'ツ'], kun: ['こ', '-こ', 'ね'], romaji: 'shi / ko', strokes: 3 },
  { kanji: '友', meanings: ['friend'], on: ['ユウ'], kun: ['とも'], romaji: 'yuu / tomo', strokes: 4 },
  { kanji: '家', meanings: ['house', 'home', 'family'], on: ['カ', 'ケ'], kun: ['いえ', 'や', '-や'], romaji: 'ka / ie', strokes: 10 },
  { kanji: '本', meanings: ['book', 'origin'], on: ['ホン'], kun: ['もと'], romaji: 'hon / moto', strokes: 5 },
  { kanji: '車', meanings: ['car', 'wheel'], on: ['シャ'], kun: ['くるま'], romaji: 'sha / kuruma', strokes: 7 },
  { kanji: '駅', meanings: ['station'], on: ['エキ'], kun: [], romaji: 'eki', strokes: 14 },
  { kanji: '電', meanings: ['electricity'], on: ['デン'], kun: [], romaji: 'den', strokes: 13 },
  { kanji: '話', meanings: ['talk', 'story'], on: ['ワ'], kun: ['はな.す', 'はなし'], romaji: 'wa / hanasu', strokes: 13 },
  { kanji: '語', meanings: ['language'], on: ['ゴ'], kun: ['かた.る', 'かた.らう'], romaji: 'go', strokes: 14 },
  { kanji: '読', meanings: ['read'], on: ['ドク', 'トク', 'トウ'], kun: ['よ.む', '-よ.み'], romaji: 'doku / yomu', strokes: 14 },
  { kanji: '書', meanings: ['write'], on: ['ショ'], kun: ['か.く', '-が.き', '-がき'], romaji: 'sho / kaku', strokes: 10 },
  { kanji: '見', meanings: ['see'], on: ['ケン'], kun: ['み.る', 'み.える', 'み.せる'], romaji: 'ken / miru', strokes: 7 },
  { kanji: '聞', meanings: ['hear', 'ask'], on: ['ブン', 'モン'], kun: ['き.く', 'き.こえる'], romaji: 'bun / kiku', strokes: 14 },
  { kanji: '食', meanings: ['eat', 'food'], on: ['ショク', 'ジキ'], kun: ['く.う', 'く.らう', 'た.べる', 'は.む'], romaji: 'shoku / taberu', strokes: 9 },
  { kanji: '飲', meanings: ['drink'], on: ['イン', 'オン'], kun: ['の.む', '-の.み'], romaji: 'in / nomu', strokes: 12 },
  { kanji: '行', meanings: ['go'], on: ['コウ', 'ギョウ', 'アン'], kun: ['い.く', 'ゆ.く', '-ゆ.き', '-い.き', 'おこな.う'], romaji: 'kou / iku', strokes: 6 },
  { kanji: '来', meanings: ['come'], on: ['ライ', 'タイ'], kun: ['く.る', 'きた.る', 'き', 'こ'], romaji: 'rai / kuru', strokes: 7 },
  { kanji: '帰', meanings: ['return'], on: ['キ'], kun: ['かえ.る', 'かえ.す', 'おく.る'], romaji: 'ki / kaeru', strokes: 10 },
  { kanji: '休', meanings: ['rest'], on: ['キュウ'], kun: ['やす.む', 'やす.まる', 'やす.める'], romaji: 'kyuu / yasumu', strokes: 6 },
  { kanji: '朝', meanings: ['morning'], on: ['チョウ'], kun: ['あさ'], romaji: 'chou / asa', strokes: 12 },
  { kanji: '昼', meanings: ['noon', 'daytime'], on: ['チュウ'], kun: ['ひる'], romaji: 'chuu / hiru', strokes: 9 },
  { kanji: '夜', meanings: ['night'], on: ['ヤ'], kun: ['よる', 'よ'], romaji: 'ya / yoru', strokes: 8 },
  { kanji: '時', meanings: ['time', 'hour'], on: ['ジ'], kun: ['とき', '-どき'], romaji: 'ji / toki', strokes: 10 },
  { kanji: '分', meanings: ['minute', 'part'], on: ['ブン', 'フン', 'ブ'], kun: ['わ.ける', 'わ.け', 'わ.かれる', 'わ.かる', 'わ.かつ'], romaji: 'bun / fun', strokes: 4 },
  { kanji: '半', meanings: ['half'], on: ['ハン'], kun: ['なか.ば'], romaji: 'han', strokes: 5 },
  { kanji: '何', meanings: ['what'], on: ['カ'], kun: ['なに', 'なん', 'なに-', 'なん-'], romaji: 'ka / nani / nan', strokes: 7 },
  { kanji: '誰', meanings: ['who'], on: ['スイ'], kun: ['だれ', 'たれ', 'た-'], romaji: 'sui / dare', strokes: 8 },
  { kanji: '私', meanings: ['I', 'private'], on: ['シ'], kun: ['わたし', 'わたくし', 'ひそ.か'], romaji: 'shi / watashi', strokes: 7 },
  { kanji: '僕', meanings: ['I (male casual)'], on: ['ボク'], kun: ['しもべ'], romaji: 'boku', strokes: 10 },
  { kanji: '国', meanings: ['country'], on: ['コク'], kun: ['くに'], romaji: 'koku / kuni', strokes: 8 },
  { kanji: '白', meanings: ['white'], on: ['ハク', 'ビャク'], kun: ['しろ', 'しら-', 'しろ.い'], romaji: 'haku / shiro', strokes: 5 },
  { kanji: '黒', meanings: ['black'], on: ['コク'], kun: ['くろ', 'くろ.い', 'くろ.ずむ'], romaji: 'koku / kuro', strokes: 11 },
  { kanji: '赤', meanings: ['red'], on: ['セキ', 'シャク'], kun: ['あか', 'あか.い', 'あか.らむ', 'あか.らめる'], romaji: 'seki / aka', strokes: 7 },
  { kanji: '青', meanings: ['blue', 'green', 'young'], on: ['セイ', 'ショウ'], kun: ['あお', 'あお.い', 'あお.ぐ'], romaji: 'sei / ao', strokes: 8 },
  { kanji: '茶', meanings: ['tea', 'brown'], on: ['チャ', 'サ'], kun: [], romaji: 'cha / sa', strokes: 9 },
  { kanji: '花', meanings: ['flower'], on: ['カ', 'ケ'], kun: ['はな'], romaji: 'ka / hana', strokes: 7 },
  { kanji: '雨', meanings: ['rain'], on: ['ウ'], kun: ['あめ', 'あま-'], romaji: 'u / ame', strokes: 8 },
  { kanji: '雪', meanings: ['snow'], on: ['セツ'], kun: ['ゆき'], romaji: 'setsu / yuki', strokes: 11 },
  { kanji: '風', meanings: ['wind'], on: ['フウ', 'フ'], kun: ['かぜ', '-かぜ'], romaji: 'fuu / kaze', strokes: 9 },
  { kanji: '空', meanings: ['sky', 'empty'], on: ['クウ'], kun: ['そら', 'あ.く', 'あ.き', 'あ.ける', 'から'], romaji: 'kuu / sora', strokes: 8 },
  { kanji: '海', meanings: ['sea'], on: ['カイ'], kun: ['うみ'], romaji: 'kai / umi', strokes: 10 },
  { kanji: '肉', meanings: ['meat'], on: ['ニク'], kun: [], romaji: 'niku', strokes: 6 },
  { kanji: '米', meanings: ['rice (grain)', 'USA'], on: ['ベイ', 'マイ', 'メエトル'], kun: ['こめ', 'よね'], romaji: 'bei / kome', strokes: 6 },
  { kanji: '薬', meanings: ['medicine'], on: ['ヤク'], kun: ['くすり'], romaji: 'yaku / kusuri', strokes: 16 },
];

const seen = new Set<string>();
export const n5KanjiCandidatePack: KanjiCandidateEntry[] = raw
  .filter((entry) => {
    if (seen.has(entry.kanji)) return false;
    seen.add(entry.kanji);
    return true;
  })
  .map((entry, index) => ({
    id: `kanji-n5-${String(index + 1).padStart(4, '0')}`,
    kanji: entry.kanji,
    meanings: entry.meanings,
    onReadings: entry.on,
    kunReadings: entry.kun,
    romaji: entry.romaji,
    strokeCount: entry.strokes,
    jlptLevel: 'N5',
    vietnamese: PENDING_VI,
    filipino: PENDING_TL,
    source: SOURCE_KANJIDIC,
    reviewStatus: REVIEW,
  }));