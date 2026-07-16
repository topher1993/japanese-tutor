import type { LessonItem, SenseiLesson } from '../types/lesson';
import { hydrateLessonVocabulary } from '../services/vocabularyEntryService';

interface RuleDefinition {
  pattern: string;
  formation: string;
  explanation: string;
  exampleJapanese: string;
  exampleRomaji: string;
  exampleEnglish: string;
  commonMistake?: string;
}

function ruleItem(lessonId: string, index: number, definition: RuleDefinition): LessonItem {
  return {
    id: `${lessonId}-rule-${index}`,
    japanese: definition.pattern,
    romaji: definition.formation,
    english: definition.explanation,
    vietnamese: '',
    filipino: '',
    category: 'grammar',
    exampleJapanese: definition.exampleJapanese,
    exampleRomaji: definition.exampleRomaji,
    exampleEnglish: definition.exampleEnglish,
    translationReviewStatus: 'approved',
    formation: definition.formation,
    commonMistake: definition.commonMistake,
  };
}

function grammarLesson(
  id: string,
  week: number,
  day: number,
  title: string,
  objective: string,
  summary: string,
  rules: RuleDefinition[],
): SenseiLesson {
  return {
    id: `grammar-${id}`,
    title,
    level: week <= 5 ? 'N5' : 'N4',
    week,
    day,
    category: 'grammar',
    objective,
    summary,
    items: rules.map((definition, index) => ruleItem(id, index + 1, definition)),
  };
}

export const grammarLessons: SenseiLesson[] = [
  grammarLesson('sentence-order', 1, 1, 'Japanese Sentence Order', 'Build simple Japanese sentences in the correct order.', 'Japanese commonly places the topic first, the object next, and the verb at the end.', [
    { pattern: 'A は B です', formation: 'topic は description です', explanation: 'Use this pattern to identify or describe something politely.', exampleJapanese: '私は学生です。', exampleRomaji: 'Watashi wa gakusei desu.', exampleEnglish: 'I am a student.' },
    { pattern: 'A は B を Vます', formation: 'topic は object を verb', explanation: 'The verb normally comes at the end of the sentence.', exampleJapanese: '私は水を飲みます。', exampleRomaji: 'Watashi wa mizu o nomimasu.', exampleEnglish: 'I drink water.', commonMistake: 'Do not place the main verb before the object as in English.' },
  ]),
  grammarLesson('copula-present', 1, 2, 'The Polite Copula', 'Say what something is or is not.', 'Learn the polite present and negative forms of です.', [
    { pattern: 'です', formation: 'A は B です', explanation: 'Polite statement: A is B.', exampleJapanese: 'これは本です。', exampleRomaji: 'Kore wa hon desu.', exampleEnglish: 'This is a book.' },
    { pattern: 'ではありません', formation: 'A は B ではありません', explanation: 'Polite negative: A is not B.', exampleJapanese: 'これは新聞ではありません。', exampleRomaji: 'Kore wa shinbun dewa arimasen.', exampleEnglish: 'This is not a newspaper.' },
  ]),
  grammarLesson('copula-past', 1, 3, 'Past Copula Forms', 'Describe what something was or was not.', 'Use でした and ではありませんでした for polite past statements.', [
    { pattern: 'でした', formation: 'A は B でした', explanation: 'Polite past: A was B.', exampleJapanese: '昨日は休みでした。', exampleRomaji: 'Kinou wa yasumi deshita.', exampleEnglish: 'Yesterday was a day off.' },
    { pattern: 'ではありませんでした', formation: 'A は B ではありませんでした', explanation: 'Polite past negative: A was not B.', exampleJapanese: '昨日は休日ではありませんでした。', exampleRomaji: 'Kinou wa kyuujitsu dewa arimasen deshita.', exampleEnglish: 'Yesterday was not a holiday.' },
  ]),
  grammarLesson('topic-subject', 1, 4, 'Topic and Subject: は and が', 'Choose は or が for basic statements.', 'は sets the topic; が identifies or emphasizes the subject.', [
    { pattern: 'A は ...', formation: 'known topic は information', explanation: 'Use は when setting the topic of the conversation.', exampleJapanese: '私は日本語を勉強します。', exampleRomaji: 'Watashi wa nihongo o benkyou shimasu.', exampleEnglish: 'As for me, I study Japanese.' },
    { pattern: 'A が ...', formation: 'subject が information', explanation: 'Use が when identifying a subject or presenting new information.', exampleJapanese: '誰が来ますか。田中さんが来ます。', exampleRomaji: 'Dare ga kimasu ka. Tanaka-san ga kimasu.', exampleEnglish: 'Who is coming? Tanaka is coming.', commonMistake: 'Do not treat は and が as interchangeable in every sentence.' },
  ]),
  grammarLesson('object-destination', 1, 5, 'Object and Destination: を and に', 'Mark what receives an action and where an action is directed.', 'を marks the direct object; に marks a destination, time, or target.', [
    { pattern: 'N を Vます', formation: 'object を verb', explanation: 'Use を for the direct object of an action.', exampleJapanese: '本を読みます。', exampleRomaji: 'Hon o yomimasu.', exampleEnglish: 'I read a book.' },
    { pattern: 'Place に 行きます', formation: 'destination に go/come', explanation: 'Use に to mark a destination or specific target.', exampleJapanese: '会社に行きます。', exampleRomaji: 'Kaisha ni ikimasu.', exampleEnglish: 'I go to the company.' },
  ]),
  grammarLesson('location-direction', 1, 6, 'Location, Direction, and Connection', 'Use で, へ, と, も, から, and まで.', 'These particles describe where an action happens, direction, company, inclusion, and limits.', [
    { pattern: 'Place で V', formation: 'action place で verb', explanation: 'で marks the place where an action happens.', exampleJapanese: '食堂で昼ご飯を食べます。', exampleRomaji: 'Shokudou de hirugohan o tabemasu.', exampleEnglish: 'I eat lunch in the cafeteria.' },
    { pattern: 'A から B まで', formation: 'from から to まで', explanation: 'から marks a starting point and まで marks an endpoint.', exampleJapanese: '九時から五時まで働きます。', exampleRomaji: 'Kuji kara goji made hatarakimasu.', exampleEnglish: 'I work from nine to five.' },
  ]),
  grammarLesson('demonstratives', 2, 1, 'Demonstratives', 'Point to things and describe their location.', 'Use これ, それ, あれ for nouns and この, その, あの before nouns.', [
    { pattern: 'これ・それ・あれ', formation: 'this / that / that over there', explanation: 'These words stand alone as nouns.', exampleJapanese: 'これは私のかばんです。', exampleRomaji: 'Kore wa watashi no kaban desu.', exampleEnglish: 'This is my bag.' },
    { pattern: 'この・その・あの + N', formation: 'this/that + noun', explanation: 'These words must be followed by a noun.', exampleJapanese: 'その機械を使います。', exampleRomaji: 'Sono kikai o tsukaimasu.', exampleEnglish: 'I use that machine.', commonMistake: 'Do not say この by itself; use これ when no noun follows.' },
  ]),
  grammarLesson('questions', 2, 2, 'Questions and Question Words', 'Ask basic who, what, where, when, and how questions.', 'Add か to polite statements and replace the unknown information with a question word.', [
    { pattern: 'Sentence + か', formation: 'polite sentence か', explanation: 'か turns a polite statement into a question.', exampleJapanese: 'これは安全ですか。', exampleRomaji: 'Kore wa anzen desu ka.', exampleEnglish: 'Is this safe?' },
    { pattern: '何・誰・どこ・いつ・どう', formation: 'what / who / where / when / how', explanation: 'Question words take the same particle as the missing information.', exampleJapanese: 'いつ会社に行きますか。', exampleRomaji: 'Itsu kaisha ni ikimasu ka.', exampleEnglish: 'When do you go to the company?' },
  ]),
  grammarLesson('i-adjective-present', 2, 3, 'い-Adjectives: Present and Negative', 'Describe things using present and negative い-adjective forms.', 'Most い-adjectives end in い and change that ending for negative forms.', [
    { pattern: '高いです', formation: 'い-adjective + です', explanation: 'Use the unchanged form for a polite present statement.', exampleJapanese: 'このビルは高いです。', exampleRomaji: 'Kono biru wa takai desu.', exampleEnglish: 'This building is tall.' },
    { pattern: '高くないです', formation: 'い → くない', explanation: 'Replace final い with くない for the polite negative.', exampleJapanese: '今日は暑くないです。', exampleRomaji: 'Kyou wa atsukunai desu.', exampleEnglish: 'Today is not hot.', commonMistake: 'Do not add じゃない directly to a normal い-adjective.' },
  ]),
  grammarLesson('i-adjective-past', 2, 4, 'い-Adjectives: Past Forms', 'Talk about how something was or was not.', 'Change い to かった for past and くなかった for past negative.', [
    { pattern: '高かったです', formation: 'い → かった', explanation: 'Use かった for a polite past statement.', exampleJapanese: '昨日は暑かったです。', exampleRomaji: 'Kinou wa atsukatta desu.', exampleEnglish: 'Yesterday was hot.' },
    { pattern: '高くなかったです', formation: 'い → くなかった', explanation: 'Use くなかった for a polite past negative.', exampleJapanese: '先週は忙しくなかったです。', exampleRomaji: 'Senshuu wa isogashiku nakatta desu.', exampleEnglish: 'Last week was not busy.' },
  ]),
  grammarLesson('na-adjective-present', 2, 5, 'な-Adjectives: Present Forms', 'Use な-adjectives in polite positive and negative sentences.', 'な-adjectives use です and ではありません as predicate endings.', [
    { pattern: '静かです', formation: 'な-adjective + です', explanation: 'Use this form to say something is quiet or has a quality.', exampleJapanese: 'この部屋は静かです。', exampleRomaji: 'Kono heya wa shizuka desu.', exampleEnglish: 'This room is quiet.' },
    { pattern: '静かではありません', formation: 'な-adjective + ではありません', explanation: 'Use this form for a polite negative sentence.', exampleJapanese: 'この場所は便利ではありません。', exampleRomaji: 'Kono basho wa benri dewa arimasen.', exampleEnglish: 'This place is not convenient.' },
  ]),
  grammarLesson('na-adjective-past', 2, 6, 'な-Adjectives: Past Forms', 'Use past and past-negative な-adjective sentences.', 'Use でした and ではありませんでした after the adjective.', [
    { pattern: '静かでした', formation: 'な-adjective + でした', explanation: 'Polite past form for a な-adjective.', exampleJapanese: '昨日の町は静かでした。', exampleRomaji: 'Kinou no machi wa shizuka deshita.', exampleEnglish: 'The town was quiet yesterday.' },
    { pattern: '静かではありませんでした', formation: 'な-adjective + ではありませんでした', explanation: 'Polite past negative form for a な-adjective.', exampleJapanese: '部屋はきれいではありませんでした。', exampleRomaji: 'Heya wa kirei dewa arimasen deshita.', exampleEnglish: 'The room was not clean.' },
  ]),
  grammarLesson('adjective-modifiers', 2, 7, 'Adjectives Before Nouns and as Adverbs', 'Modify nouns and describe how actions happen.', 'い-adjectives directly modify nouns; な-adjectives use な before nouns and に as adverbs.', [
    { pattern: '高い車・静かな部屋', formation: 'い-adj + noun / な-adj + な + noun', explanation: 'Place an adjective before the noun it describes.', exampleJapanese: '静かな部屋で勉強します。', exampleRomaji: 'Shizuka na heya de benkyou shimasu.', exampleEnglish: 'I study in a quiet room.' },
    { pattern: '速く・静かに', formation: 'い → く / な → に', explanation: 'Change an adjective into an adverb with く or に.', exampleJapanese: 'ゆっくり、静かに話してください。', exampleRomaji: 'Yukkuri, shizuka ni hanashite kudasai.', exampleEnglish: 'Please speak slowly and quietly.', commonMistake: 'Use 静かな before a noun but 静かに before a verb.' },
  ]),
  grammarLesson('adjective-exceptions-comparison', 2, 8, 'Adjective Exceptions, Comparison, and Change', 'Use いい correctly and compare or describe changing qualities.', 'Learn the irregular いい forms, comparison patterns, and くなる/になる.', [
    { pattern: 'いい → よくない → よかった', formation: 'irregular いい conjugation', explanation: 'いい changes to よく in negative and past forms.', exampleJapanese: '今日は天気がよかったです。', exampleRomaji: 'Kyou wa tenki ga yokatta desu.', exampleEnglish: 'The weather was good today.' },
    { pattern: 'A より B のほうが / もっと', formation: 'A より B のほうが adjective; い → くなる / な → になる', explanation: 'Use より and のほうが for comparison; use くなる or になる for change.', exampleJapanese: '春より夏のほうが暑いです。', exampleRomaji: 'Haru yori natsu no hou ga atsui desu.', exampleEnglish: 'Summer is hotter than spring.' },
  ]),
  grammarLesson('verb-groups', 3, 1, 'Japanese Verb Groups', 'Identify godan, ichidan, and irregular verbs before conjugating.', 'Verb group identification determines how the ending changes.', [
    { pattern: '食べる・見る', formation: 'ichidan: remove る', explanation: 'Many verbs ending in える or いる are ichidan verbs.', exampleJapanese: '毎日ご飯を食べます。', exampleRomaji: 'Mainichi gohan o tabemasu.', exampleEnglish: 'I eat meals every day.' },
    { pattern: '飲む・書く・話す', formation: 'godan: change final kana', explanation: 'Godan verbs change their final kana across conjugation rows.', exampleJapanese: '水を飲みます。', exampleRomaji: 'Mizu o nomimasu.', exampleEnglish: 'I drink water.', commonMistake: 'Not every verb ending in る is ichidan; 帰る and 入る are godan.' },
  ]),
  grammarLesson('masu-present', 3, 2, 'Polite Verb: ます and ません', 'Make polite present and negative verb sentences.', 'Godan verbs move to the i-row; ichidan verbs drop る; irregular verbs have special forms.', [
    { pattern: '飲みます・食べます', formation: 'verb stem + ます', explanation: 'Use ます for a polite non-past action.', exampleJapanese: '毎朝コーヒーを飲みます。', exampleRomaji: 'Maiasa koohii o nomimasu.', exampleEnglish: 'I drink coffee every morning.' },
    { pattern: '飲みません・食べません', formation: 'verb stem + ません', explanation: 'Use ません for a polite non-past negative.', exampleJapanese: '私はお酒を飲みません。', exampleRomaji: 'Watashi wa osake o nomimasen.', exampleEnglish: 'I do not drink alcohol.' },
  ]),
  grammarLesson('masu-past', 3, 3, 'Polite Verb Past Forms', 'Talk about completed actions politely.', 'Use ました for past and ませんでした for past negative.', [
    { pattern: '飲みました', formation: 'verb stem + ました', explanation: 'Polite past: did the action.', exampleJapanese: '昨日、本を読みました。', exampleRomaji: 'Kinou, hon o yomimashita.', exampleEnglish: 'I read a book yesterday.' },
    { pattern: '飲みませんでした', formation: 'verb stem + ませんでした', explanation: 'Polite past negative: did not do the action.', exampleJapanese: '昨日は働きませんでした。', exampleRomaji: 'Kinou wa hatarakimasen deshita.', exampleEnglish: 'I did not work yesterday.' },
  ]),
  grammarLesson('dictionary-form', 3, 4, 'Dictionary and Plain Non-Past Forms', 'Recognize the plain form used in dictionaries and casual grammar.', 'Dictionary form is the plain non-past form used before many grammar patterns.', [
    { pattern: '行く・食べる・する・来る', formation: 'plain non-past', explanation: 'These are the dictionary forms of common verbs.', exampleJapanese: '明日、会社へ行く。', exampleRomaji: 'Ashita, kaisha e iku.', exampleEnglish: 'I will go to work tomorrow. (plain)' },
    { pattern: 'Verb + noun', formation: 'plain verb + noun', explanation: 'A plain verb can modify a noun in a relative clause.', exampleJapanese: '私が作る料理です。', exampleRomaji: 'Watashi ga tsukuru ryouri desu.', exampleEnglish: 'It is food that I make.' },
  ]),
  grammarLesson('plain-negative', 3, 5, 'Plain Negative Forms', 'Make casual negative statements and use ない before grammar patterns.', 'Godan verbs use the a-row, with う becoming わ; ichidan verbs drop る.', [
    { pattern: '飲まない・食べない', formation: 'godan a-row + ない / ichidan stem + ない', explanation: 'Use ない for a plain negative verb.', exampleJapanese: '今日はテレビを見ない。', exampleRomaji: 'Kyou wa terebi o minai.', exampleEnglish: 'I will not watch TV today.' },
    { pattern: 'しない・来ない', formation: 'する → しない / 来る → 来ない', explanation: 'Irregular verbs have their own plain negative forms.', exampleJapanese: '無理はしないでください。', exampleRomaji: 'Muri wa shinaide kudasai.', exampleEnglish: 'Please do not overdo it.' },
  ]),
  grammarLesson('plain-past', 3, 6, 'Plain Past Forms', 'Recognize た and なかった forms in everyday grammar.', 'The plain past is used in casual speech and before many N4 grammar patterns.', [
    { pattern: '食べた・飲んだ・書いた', formation: 'verb-specific た-form', explanation: 'Use the plain past to say an action happened.', exampleJapanese: 'もう昼ご飯を食べた。', exampleRomaji: 'Mou hirugohan o tabeta.', exampleEnglish: 'I already ate lunch.' },
    { pattern: '食べなかった', formation: 'ない → なかった', explanation: 'Change ない to なかった for plain past negative.', exampleJapanese: '朝ご飯を食べなかった。', exampleRomaji: 'Asagohan o tabenakatta.', exampleEnglish: 'I did not eat breakfast.' },
  ]),
  grammarLesson('te-form-rules', 4, 1, 'て-Form Conjugation Rules', 'Convert verbs into the て-form accurately.', 'Learn the sound-change groups and the special exception 行く.', [
    { pattern: 'う・つ・る → って', formation: '買う → 買って', explanation: 'These godan endings become って.', exampleJapanese: 'ここに名前を書いてください。', exampleRomaji: 'Koko ni namae o kaite kudasai.', exampleEnglish: 'Please write your name here.' },
    { pattern: 'む・ぶ・ぬ → んで / く → いて / す → して', formation: '読む → 読んで / 書く → 書いて', explanation: 'Use the correct sound-change group; 行く is 行って.', exampleJapanese: '本を読んで、寝ます。', exampleRomaji: 'Hon o yonde, nemasu.', exampleEnglish: 'I read a book and sleep.', commonMistake: '行く is 行って, not 行いて.' },
  ]),
  grammarLesson('te-kudasai', 4, 2, 'Requests with てください', 'Give a polite request or instruction.', 'Attach ください to the て-form.', [
    { pattern: 'Vてください', formation: 'て-form + ください', explanation: 'Use this for a polite request.', exampleJapanese: 'もう一度言ってください。', exampleRomaji: 'Mou ichido itte kudasai.', exampleEnglish: 'Please say it one more time.' },
    { pattern: 'N を Vてください', formation: 'object を て-form + ください', explanation: 'Place the object before the requested action.', exampleJapanese: 'この書類を見てください。', exampleRomaji: 'Kono shorui o mite kudasai.', exampleEnglish: 'Please look at this document.' },
  ]),
  grammarLesson('te-iru', 4, 3, 'Ongoing Actions and States', 'Describe actions in progress and continuing states.', 'ています can mean be doing, be in a state, or have a continuing result.', [
    { pattern: 'Vています', formation: 'て-form + います', explanation: 'Use this for an action happening now.', exampleJapanese: '今、日本語を勉強しています。', exampleRomaji: 'Ima, nihongo o benkyou shite imasu.', exampleEnglish: 'I am studying Japanese now.' },
    { pattern: '住んでいます・知っています', formation: 'continuing state', explanation: 'Some verbs describe a state rather than an action in progress.', exampleJapanese: '東京に住んでいます。', exampleRomaji: 'Toukyou ni sunde imasu.', exampleEnglish: 'I live in Tokyo.' },
  ]),
  grammarLesson('permission-prohibition', 4, 4, 'Permission and Prohibition', 'Ask permission and say that something is not allowed.', 'Use てもいいです for permission and てはいけません for prohibition.', [
    { pattern: 'Vてもいいですか', formation: 'て-form + もいいですか', explanation: 'Ask if an action is permitted.', exampleJapanese: 'ここで写真を撮ってもいいですか。', exampleRomaji: 'Koko de shashin o totte mo ii desu ka.', exampleEnglish: 'May I take a photo here?' },
    { pattern: 'Vてはいけません', formation: 'て-form + はいけません', explanation: 'Say that an action is prohibited.', exampleJapanese: 'ここでたばこを吸ってはいけません。', exampleRomaji: 'Koko de tabako o sutte wa ikemasen.', exampleEnglish: 'You must not smoke here.' },
  ]),
  grammarLesson('existence', 4, 5, 'Existence: ある and いる', 'Say that people, animals, or things exist.', 'Use いる for people and animals; use ある for objects and places.', [
    { pattern: '人・動物がいます', formation: 'living thing が います', explanation: 'Use います for people and animals.', exampleJapanese: '部屋に先生がいます。', exampleRomaji: 'Heya ni sensei ga imasu.', exampleEnglish: 'There is a teacher in the room.' },
    { pattern: '物があります', formation: 'thing が あります', explanation: 'Use あります for inanimate things.', exampleJapanese: '机の上に本があります。', exampleRomaji: 'Tsukue no ue ni hon ga arimasu.', exampleEnglish: 'There is a book on the desk.' },
  ]),
  grammarLesson('existence-location', 4, 6, 'Locations with あります and います', 'Describe where people and things are located.', 'The location comes before に; the thing that exists is marked with は or が.', [
    { pattern: 'N は Place にあります', formation: 'thing は place に あります', explanation: 'Locate an object or facility.', exampleJapanese: '駅は右にあります。', exampleRomaji: 'Eki wa migi ni arimasu.', exampleEnglish: 'The station is on the right.' },
    { pattern: 'N は Place にいます', formation: 'person/animal は place に います', explanation: 'Locate a person or animal.', exampleJapanese: '田中さんは食堂にいます。', exampleRomaji: 'Tanaka-san wa shokudou ni imasu.', exampleEnglish: 'Tanaka is in the cafeteria.' },
  ]),
  grammarLesson('obligation', 5, 1, 'Obligation and Necessity', 'Say that someone must do something.', 'Use the negative ない-form plus ければなりません.', [
    { pattern: 'Vなければなりません', formation: 'ない → なければなりません', explanation: 'Polite obligation: must do.', exampleJapanese: '安全ルールを守らなければなりません。', exampleRomaji: 'Anzen ruuru o mamoranakereba narimasen.', exampleEnglish: 'You must follow the safety rules.' },
    { pattern: 'Vなくてはいけません', formation: 'ない → なくてはいけません', explanation: 'Another common polite way to express must do.', exampleJapanese: '明日、早く起きなくてはいけません。', exampleRomaji: 'Ashita, hayaku okinakute wa ikemasen.', exampleEnglish: 'I must wake up early tomorrow.' },
  ]),
  grammarLesson('no-need', 5, 2, 'No Need to Do Something', 'Say that an action is not necessary.', 'Use the negative ない-form plus なくてもいいです.', [
    { pattern: 'Vなくてもいいです', formation: 'ない → なくてもいいです', explanation: 'Say that someone does not need to do something.', exampleJapanese: '今日は来なくてもいいです。', exampleRomaji: 'Kyou wa konakute mo ii desu.', exampleEnglish: 'You do not need to come today.' },
    { pattern: 'Vなくてもいいですか', formation: 'negative + てもいいですか', explanation: 'Ask whether an action is unnecessary.', exampleJapanese: '靴を脱がなくてもいいですか。', exampleRomaji: 'Kutsu o nuganakute mo ii desu ka.', exampleEnglish: 'Is it okay if I do not take off my shoes?' },
  ]),
  grammarLesson('time-counters', 5, 3, 'Time, Counters, and Duration', 'Use particles and counters with times and quantities.', 'Learn に for specific times, から/まで for ranges, and common counter patterns.', [
    { pattern: 'Time に V', formation: 'specific time に verb', explanation: 'Use に with a specific clock time or date.', exampleJapanese: '八時に仕事が始まります。', exampleRomaji: 'Hachi-ji ni shigoto ga hajimarimasu.', exampleEnglish: 'Work starts at eight.' },
    { pattern: 'Number + counter', formation: 'number + counter + noun/verb', explanation: 'Japanese uses counters such as 人, 枚, 本, and 個.', exampleJapanese: 'りんごを二つ買いました。', exampleRomaji: 'Ringo o futatsu kaimashita.', exampleEnglish: 'I bought two apples.' },
  ]),
  grammarLesson('frequency', 5, 4, 'Frequency and Degree', 'Describe how often or how much something happens.', 'Place frequency adverbs before the verb or adjective they modify.', [
    { pattern: 'いつも・よく・ときどき', formation: 'frequency adverb + verb', explanation: 'Use these for always, often, and sometimes.', exampleJapanese: 'よく日本語を聞きます。', exampleRomaji: 'Yoku nihongo o kikimasu.', exampleEnglish: 'I often listen to Japanese.' },
    { pattern: 'あまり + negative', formation: 'あまり + negative verb/adjective', explanation: 'あまり means not very much and normally uses a negative.', exampleJapanese: 'あまり辛くありません。', exampleRomaji: 'Amari karaku arimasen.', exampleEnglish: 'It is not very spicy.' },
  ]),
  grammarLesson('experience', 5, 5, 'Past Experience', 'Talk about whether something has happened before.', 'Use the plain past form plus ことがあります.', [
    { pattern: 'Vたことがあります', formation: 'た-form + ことがあります', explanation: 'Say that you have done something before.', exampleJapanese: '日本へ行ったことがあります。', exampleRomaji: 'Nihon e itta koto ga arimasu.', exampleEnglish: 'I have been to Japan.' },
    { pattern: 'Vたことがありません', formation: 'た-form + ことがありません', explanation: 'Say that you have never done something.', exampleJapanese: '富士山を見たことがありません。', exampleRomaji: 'Fujisan o mita koto ga arimasen.', exampleEnglish: 'I have never seen Mount Fuji.' },
  ]),
  grammarLesson('tari-listing', 5, 6, 'Listing Actions with たり', 'List representative actions without giving a complete list.', 'Use the past form plus り, and finish with します or another predicate.', [
    { pattern: 'Vたり、Vたりします', formation: 'た-form + り ... た-form + り', explanation: 'List examples of actions such as doing this and that.', exampleJapanese: '週末は映画を見たり、買い物をしたりします。', exampleRomaji: 'Shuumatsu wa eiga o mitari, kaimono o shitari shimasu.', exampleEnglish: 'On weekends I watch movies, go shopping, and so on.' },
    { pattern: 'Aかったり、Bかったり', formation: 'adjective past + り', explanation: 'Adjectives can also be listed with たり.', exampleJapanese: '季節によって暑かったり寒かったりします。', exampleRomaji: 'Kisetsu ni yotte atsukattari samukattari shimasu.', exampleEnglish: 'Depending on the season, it is sometimes hot and sometimes cold.' },
  ]),
  grammarLesson('desire', 6, 1, 'Desire: たい and ほしい', 'Say what you want to do and what you want to have.', 'たい attaches to a verb stem; ほしい describes a desired noun.', [
    { pattern: 'Vたいです', formation: 'verb stem + たいです', explanation: 'Say that you want to do an action.', exampleJapanese: '日本語を話したいです。', exampleRomaji: 'Nihongo o hanashitai desu.', exampleEnglish: 'I want to speak Japanese.' },
    { pattern: 'N がほしいです', formation: 'desired noun が ほしいです', explanation: 'Say that you want to have a thing.', exampleJapanese: '新しい辞書がほしいです。', exampleRomaji: 'Atarashii jisho ga hoshii desu.', exampleEnglish: 'I want a new dictionary.' },
  ]),
  grammarLesson('plans', 6, 2, 'Plans and Intentions', 'Describe intentions and scheduled plans.', 'つもりです describes intention; 予定です describes a plan or schedule.', [
    { pattern: 'Vるつもりです', formation: 'dictionary form + つもりです', explanation: 'Say that you intend to do something.', exampleJapanese: '来年、日本で働くつもりです。', exampleRomaji: 'Rainen, Nihon de hataraku tsumori desu.', exampleEnglish: 'I intend to work in Japan next year.' },
    { pattern: 'Vる予定です', formation: 'dictionary form + 予定です', explanation: 'Describe a planned or scheduled action.', exampleJapanese: '会議は三時に始まる予定です。', exampleRomaji: 'Kaigi wa san-ji ni hajimaru yotei desu.', exampleEnglish: 'The meeting is scheduled to start at three.' },
  ]),
  grammarLesson('volitional', 6, 3, 'Volitional Form', 'Suggest doing something and express a decision.', 'The volitional form means let us or I will, depending on context.', [
    { pattern: '行こう・食べよう', formation: 'godan o-row + う / ichidan + よう', explanation: 'Use the casual volitional form for let us or I will.', exampleJapanese: '一緒に昼ご飯を食べよう。', exampleRomaji: 'Issho ni hirugohan o tabeyou.', exampleEnglish: 'Let us eat lunch together.' },
    { pattern: 'Vようと思います', formation: 'volitional + と思います', explanation: 'Use this to soften a stated intention.', exampleJapanese: '毎日練習しようと思います。', exampleRomaji: 'Mainichi renshuu shiyou to omoimasu.', exampleEnglish: 'I think I will practice every day.' },
  ]),
  grammarLesson('potential', 6, 4, 'Potential Form', 'Say that someone can or cannot do something.', 'Godan verbs move to the e-row plus る; ichidan verbs use られる; する becomes できる.', [
    { pattern: '話せる・書ける', formation: 'godan e-row + る', explanation: 'Make a godan verb potential form with the e-row.', exampleJapanese: '日本語が少し話せます。', exampleRomaji: 'Nihongo ga sukoshi hanasemasu.', exampleEnglish: 'I can speak a little Japanese.' },
    { pattern: '食べられる・できる', formation: 'ichidan + られる / する → できる', explanation: 'Use られる for ichidan verbs and できる for する.', exampleJapanese: '漢字を読むことができます。', exampleRomaji: 'Kanji o yomu koto ga dekimasu.', exampleEnglish: 'I can read kanji.', commonMistake: 'Potential ability often uses が rather than を.' },
  ]),
  grammarLesson('nagara', 6, 5, 'Simultaneous Actions with ながら', 'Say that two actions happen at the same time.', 'Attach ながら to the stem of the first verb; the second verb is the main action.', [
    { pattern: 'Vながら V', formation: 'verb stem + ながら + main verb', explanation: 'Describe doing one action while doing another.', exampleJapanese: '音楽を聞きながら勉強します。', exampleRomaji: 'Ongaku o kikinagara benkyou shimasu.', exampleEnglish: 'I study while listening to music.' },
    { pattern: 'Vながら', formation: 'same subject for both actions', explanation: 'The subject normally stays the same for both actions.', exampleJapanese: '歩きながら電話をしないでください。', exampleRomaji: 'Arukinagara denwa o shinaide kudasai.', exampleEnglish: 'Please do not make a call while walking.', commonMistake: 'The main verb comes after ながら.' },
  ]),
  grammarLesson('conditional-tara', 7, 1, 'Conditional たら', 'Talk about a condition or what happens after something.', 'たら is useful for specific if or when situations.', [
    { pattern: 'Vたら', formation: 'た-form + ら', explanation: 'Use this for a condition that must happen first.', exampleJapanese: '仕事が終わったら、帰ります。', exampleRomaji: 'Shigoto ga owattara, kaerimasu.', exampleEnglish: 'When work finishes, I will go home.' },
    { pattern: 'もし ... たら', formation: 'もし + condition + たら', explanation: 'もし emphasizes a hypothetical if.', exampleJapanese: '雨が降ったら、電車で行きます。', exampleRomaji: 'Ame ga futtara, densha de ikimasu.', exampleEnglish: 'If it rains, I will go by train.' },
  ]),
  grammarLesson('conditional-nara', 7, 2, 'Conditional なら', 'Respond to a topic or assumption with advice or information.', 'なら means if that is the case or speaking of.', [
    { pattern: 'Nなら', formation: 'noun + なら', explanation: 'Use なら when the condition is a topic already mentioned.', exampleJapanese: '日本なら、東京が便利です。', exampleRomaji: 'Nihon nara, Toukyou ga benri desu.', exampleEnglish: 'If you mean Japan, Tokyo is convenient.' },
    { pattern: 'Vるなら', formation: 'plain form + なら', explanation: 'Give advice based on a plan or situation.', exampleJapanese: '行くなら、早く出ましょう。', exampleRomaji: 'Iku nara, hayaku demashou.', exampleEnglish: 'If you are going, let us leave early.' },
  ]),
  grammarLesson('conditional-ba', 7, 3, 'Conditional ば', 'Express general conditions and logical results.', 'ば is common for general if statements and advice.', [
    { pattern: '行けば・食べれば', formation: 'godan e-row + ば / ichidan + れば', explanation: 'Make the conditional with the e-row or れば.', exampleJapanese: '毎日練習すれば、上手になります。', exampleRomaji: 'Mainichi renshuu sureba, jouzu ni narimasu.', exampleEnglish: 'If you practice every day, you will improve.' },
    { pattern: 'なければ', formation: 'ない → なければ', explanation: 'Use the negative conditional for if not.', exampleJapanese: '急がなければ、遅れます。', exampleRomaji: 'Isoganakereba, okuremasu.', exampleEnglish: 'If you do not hurry, you will be late.' },
  ]),
  grammarLesson('conditional-to', 7, 4, 'Conditional と', 'Describe automatic, natural, or repeated results.', 'と is used when the result reliably follows the condition.', [
    { pattern: 'Vると', formation: 'plain non-past + と', explanation: 'Use と for natural consequences or automatic results.', exampleJapanese: 'このボタンを押すと、ドアが開きます。', exampleRomaji: 'Kono botan o osu to, doa ga akimasu.', exampleEnglish: 'When you press this button, the door opens.' },
    { pattern: '春になると', formation: 'condition と result', explanation: 'Use と for repeated seasonal or habitual results.', exampleJapanese: '春になると、花が咲きます。', exampleRomaji: 'Haru ni naru to, hana ga sakimasu.', exampleEnglish: 'When spring comes, flowers bloom.', commonMistake: 'と is usually not used for a one-time personal request or intention.' },
  ]),
  grammarLesson('reason', 7, 5, 'Reasons with から and ので', 'Explain why something happens.', 'から is direct and conversational; ので sounds softer and more explanatory.', [
    { pattern: 'から', formation: 'reason から result', explanation: 'Give a direct reason for a decision or request.', exampleJapanese: '危ないから、入らないでください。', exampleRomaji: 'Abunai kara, hairanaide kudasai.', exampleEnglish: 'Because it is dangerous, please do not enter.' },
    { pattern: 'ので', formation: 'reason ので result', explanation: 'Give a softer, less forceful reason.', exampleJapanese: '体調が悪いので、休みます。', exampleRomaji: 'Taichou ga warui node, yasumimasu.', exampleEnglish: 'Because I do not feel well, I will rest.' },
  ]),
  grammarLesson('contrast', 7, 6, 'Contrast with けど and のに', 'Connect contrasting ideas.', 'けど is a common but, while のに expresses an unexpected result or despite.', [
    { pattern: 'けど', formation: 'clause けど clause', explanation: 'Connect two ideas with a soft contrast.', exampleJapanese: '難しいけど、面白いです。', exampleRomaji: 'Muzukashii kedo, omoshiroi desu.', exampleEnglish: 'It is difficult, but interesting.' },
    { pattern: 'のに', formation: 'plain form + のに', explanation: 'Express surprise that the result differs from expectation.', exampleJapanese: '勉強したのに、忘れました。', exampleRomaji: 'Benkyou shita noni, wasuremashita.', exampleEnglish: 'Even though I studied, I forgot.' },
  ]),
  grammarLesson('relative-clauses', 8, 1, 'Relative Clauses', 'Describe a noun with a verb or adjective clause.', 'Japanese puts the modifying clause before the noun and does not use who or that.', [
    { pattern: 'Vる + N', formation: 'plain clause + noun', explanation: 'Use a plain-form clause before a noun.', exampleJapanese: '私が買った本です。', exampleRomaji: 'Watashi ga katta hon desu.', exampleEnglish: 'It is the book that I bought.' },
    { pattern: 'N を使う人', formation: 'clause + noun', explanation: 'The noun after the clause is the person or thing being described.', exampleJapanese: '日本語を話す人がいます。', exampleRomaji: 'Nihongo o hanasu hito ga imasu.', exampleEnglish: 'There is a person who speaks Japanese.' },
  ]),
  grammarLesson('nominalization', 8, 2, 'Nominalization with の and こと', 'Turn actions into noun-like ideas.', 'の and こと allow a verb clause to function as a noun.', [
    { pattern: 'Vるのが好きです', formation: 'plain verb + のが好き', explanation: 'Use の to talk about enjoying an action.', exampleJapanese: '音楽を聞くのが好きです。', exampleRomaji: 'Ongaku o kiku no ga suki desu.', exampleEnglish: 'I like listening to music.' },
    { pattern: 'Vることができます', formation: 'plain verb + ことができる', explanation: 'Use ことができる to express ability.', exampleJapanese: '漢字を書くことができます。', exampleRomaji: 'Kanji o kaku koto ga dekimasu.', exampleEnglish: 'I can write kanji.' },
  ]),
  grammarLesson('explanatory-n-desu', 8, 3, 'Explanations with んです', 'Give background information or ask for an explanation.', 'んです adds an explanatory or contextual tone.', [
    { pattern: 'んです・のです', formation: 'plain form + んです', explanation: 'Use this to explain a situation or give context.', exampleJapanese: '今日は休みなんです。', exampleRomaji: 'Kyou wa yasumi nan desu.', exampleEnglish: 'The thing is, today is my day off.' },
    { pattern: 'どうしたんですか', formation: 'question + んですか', explanation: 'Ask what happened or why in a concerned way.', exampleJapanese: 'どうしたんですか。', exampleRomaji: 'Dou shitan desu ka.', exampleEnglish: 'What happened?' },
  ]),
  grammarLesson('giving-receiving', 8, 4, 'Giving and Receiving', 'Choose the correct verb for giving and receiving.', 'The choice depends on the direction of the action or object.', [
    { pattern: 'あげる', formation: 'giver は receiver に あげる', explanation: 'Use あげる when the subject gives to someone else.', exampleJapanese: '私は友達に本をあげました。', exampleRomaji: 'Watashi wa tomodachi ni hon o agemashita.', exampleEnglish: 'I gave a book to my friend.' },
    { pattern: 'くれる・もらう', formation: 'someone が くれる / I が もらう', explanation: 'くれる is giving to me or my group; もらう is receiving.', exampleJapanese: '先生が辞書をくれました。', exampleRomaji: 'Sensei ga jisho o kuremashita.', exampleEnglish: 'The teacher gave me a dictionary.', commonMistake: 'The receiver perspective determines whether to use くれる or もらう.' },
  ]),
  grammarLesson('favor-giving', 8, 5, 'Giving and Receiving Favors', 'Talk about doing helpful actions for others.', 'Attach あげる, くれる, or もらう to a て-form to show who benefits.', [
    { pattern: 'Vてあげる', formation: 'て-form + あげる', explanation: 'Say that you do something as a favor for someone.', exampleJapanese: '友達に日本語を教えてあげました。', exampleRomaji: 'Tomodachi ni nihongo o oshiete agemashita.', exampleEnglish: 'I taught Japanese to my friend as a favor.' },
    { pattern: 'Vてくれる・Vてもらう', formation: 'て-form + くれる / もらう', explanation: 'Show that someone helps me or that I receive help.', exampleJapanese: '同僚が手伝ってくれました。', exampleRomaji: 'Douryou ga tetsudatte kuremashita.', exampleEnglish: 'My coworker helped me.' },
  ]),
  grammarLesson('passive-causative', 8, 6, 'Passive and Causative Forms', 'Recognize passive and causative sentences.', 'Passive describes an action received by the subject; causative describes making or allowing someone to act.', [
    { pattern: '読まれる・書かれる', formation: 'godan a-row + れる', explanation: 'Godan verbs change to the a-row plus れる.', exampleJapanese: 'この本は多くの人に読まれています。', exampleRomaji: 'Kono hon wa ooku no hito ni yomarete imasu.', exampleEnglish: 'This book is read by many people.' },
    { pattern: '食べられる・される・来られる', formation: 'ichidan + られる / する → される', explanation: 'Ichidan verbs use られる; する and 来る are irregular.', exampleJapanese: '財布を盗まれました。', exampleRomaji: 'Saifu o nusumaremashita.', exampleEnglish: 'My wallet was stolen.' },
    { pattern: '行かせる・読ませる', formation: 'godan a-row + せる', explanation: 'Godan verbs change to the a-row plus せる.', exampleJapanese: '先生は学生を立たせました。', exampleRomaji: 'Sensei wa gakusei o tatasemashita.', exampleEnglish: 'The teacher made the student stand.' },
    { pattern: '食べさせる・させる・来させる', formation: 'ichidan + させる / する → させる', explanation: 'Ichidan verbs use させる; する and 来る are irregular.', exampleJapanese: '母は子どもに野菜を食べさせます。', exampleRomaji: 'Haha wa kodomo ni yasai o tabesasemasu.', exampleEnglish: 'The mother makes the child eat vegetables.' },
  ]),
  grammarLesson('keigo-basics', 8, 8, 'Politeness and Basic Keigo', 'Recognize polite, respectful, and humble language.', 'Use polite language as the default and recognize common honorific workplace verbs.', [
    { pattern: 'ていねい語', formation: 'です・ます style', explanation: 'Polite language uses です and ます for respectful everyday communication.', exampleJapanese: '明日、伺います。', exampleRomaji: 'Ashita, ukagaimasu.', exampleEnglish: 'I will visit tomorrow. (polite/humble)' },
    { pattern: 'いらっしゃる・おっしゃる・伺う', formation: '尊敬語 / 謙譲語', explanation: 'Recognize common respectful and humble replacements in the workplace.', exampleJapanese: '部長がおっしゃいました。', exampleRomaji: 'Buchou ga osshaimashita.', exampleEnglish: 'The department head said. (respectful)', commonMistake: 'Do not use humble verbs to describe a customer or supervisor.' },
  ]),
];

hydrateLessonVocabulary(grammarLessons);
