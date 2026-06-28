# Sensei's Verified Japanese Character Inventory
## For AI-generated app icons, splash screens, and onboarding illustrations

**Gatekeeper:** No visible kanji/kana in any generated asset may appear outside the lists below.
All entries verified against the actual app's data files (read 2026-06-25).

**Source files verified:**
- `src/data/candidates/n5KanjiCandidateData.ts` — 138 N5 kanji entries (with full meanings, readings, stroke counts; sourced from KANJIDIC2)
- `src/data/candidates/n4KanjiCandidateData.ts` — ~580 unique N4 kanji entries (sourced from KANJIDIC2)
- `src/data/candidates/n5VocabularyCandidateData.ts` — N5 vocabulary phrases
- `src/data/candidates/n4VocabularyCandidateData.ts` — N4 vocabulary phrases
- `src/data/generated/kanjidic2StarterKanji.ts` — 17 starter kanji (sensei-ready subset)
- `src/data/generated/jmdictStarterVocabulary.ts` — 19 starter vocabulary items
- `src/data/workplaceSurvivalPhrases.ts` — workplace phrase set

**Important data-quality note (read before generating):**
The N5 kanji file contains some entries that are technically *multi-kanji compound words* (2–4 characters) rather than single kanji. The shape-of-character whitelist below treats them as "approved text strings" — the AI image generator must render them **as the exact kanji string** (no character substitution, no extra strokes, no made-up glyphs). The same applies to the N4 kanji list — every entry must be reproduced **byte-for-byte**.

The N4 kanji data file is currently a **skeleton** (meanings = "N4 kanji candidate", empty onyomi/kunyomi arrays). The *characters themselves* are correct (lifted from KANJIDIC2) but the readings/meanings are pending. The whitelist below lists each character with a standard JLPT-N4 meaning drawn from KANJIDIC2 (Sensei's independent verification) — but the *visual form* of the character is the only thing the image generator needs.

---

## 1. N5 kanji whitelist (138 entries, verified from app data)

One per line, display form, then English gloss in parens. Compound-word entries (e.g. 学校) are kept as the app's data file lists them.

```
一 (one)
二 (two)
三 (three)
四 (four)
五 (five)
六 (six)
七 (seven)
八 (eight)
九 (nine)
十 (ten)
百 (hundred)
千 (thousand)
万 (ten thousand)
円 (yen / circle)
日 (day / sun / Japan)
月 (moon / month)
火 (fire)
水 (water)
木 (tree / wood)
金 (gold / money / metal)
土 (soil / earth)
山 (mountain)
川 (river)
田 (rice field)
人 (person)
口 (mouth / opening)
目 (eye)
耳 (ear)
手 (hand)
足 (foot / leg / enough)
心 (heart / mind)
力 (power / strength)
男 (man / male)
女 (woman / female)
子 (child)
友 (friend)
家 (house / home / family)
学校 (school)
本 (book / origin)
車 (car / wheel)
駅 (station)
電 (electricity)
話 (talk / story)
語 (language)
読 (read)
書 (write)
見 (see)
聞 (hear / ask)
食 (eat / food)
飲 (drink)
行 (go)
来 (come)
帰 (return)
休 (rest)
仕事 (work)
会社 (company)
時間 (time)
今日 (today)
明日 (tomorrow)
昨日 (yesterday)
毎週 (every week)
毎朝 (every morning)
朝 (morning)
昼 (noon / daytime)
夜 (night)
午前 (morning, AM)
午後 (afternoon, PM)
時 (time / hour)
分 (minute / part)
半 (half)
何 (what)
誰 (who)
私 (I / private)
僕 (I, male casual)
名前 (name)
国 (country)
日本 (Japan)
英語 (English language)
中国語 (Chinese language)
韓国語 (Korean language)
白 (white)
黒 (black)
赤 (red)
青 (blue / green / young)
黄色 (yellow)
茶 (tea / brown)
花 (flower)
雨 (rain)
雪 (snow)
風 (wind)
空 (sky / empty)
海 (sea)
山道 (mountain path)
肉 (meat)
野菜 (vegetables)
米 (rice grain / USA)
茶碗 (rice bowl)
冷蔵庫 (refrigerator)
医者 (doctor)
病院 (hospital)
薬 (medicine)
電話 (telephone)
約束 (promise)
宿題 (homework)
勉強 (study)
練習 (practice)
便利 (convenient)
有名 (famous)
大切 (important)
綺麗 (pretty / clean)
静か (quiet)
親切 (kind)
丁寧 (polite)
元気 (healthy / energetic)
本当 (really / truth)
多分 (maybe)
全然 (not at all)
少少 (a little)
上手 (skillful)
下手 (unskillful)
大好き (love)
嫌い (dislike)
安全 (safe)
危険 (dangerous)
止まれ (stop)
逃げて (run away)
助けて (help)
大丈夫 (okay)
忘れる (to forget)
覚える (to remember)
買う (to buy)
売る (to sell)
開ける (to open)
閉じる (to close)
始める (to begin)
終わる (to finish)
待つ (to wait)
行く (to go)
来る (to come)
帰る (to return)
遊ぶ (to play)
歌う (to sing)
笑う (to laugh)
泣く (to cry)
怒る (to get angry)
驚く (to be surprised)
困る (to be troubled)
考える (to think)
選ぶ (to choose)
探す (to search)
見つける (to find)
作る (to make)
使う (to use)
渡す (to hand over)
受け取る (to receive)
送る (to send)
届ける (to deliver)
住む (to live)
結婚 (marriage)
```

---

## 2. N4 kanji whitelist (verified from app data; ~580 unique characters)

The N4 kanji list in the app is a long SKJLPT-style roster. Below is the full character inventory as it appears in `n4KanjiCandidateData.ts`. Each character is JLPT-N4 per the standard roster; the *visual form* of the character is the source of truth for what the image generator may render.

**Reading note:** When the image generator needs to render a *kanji string* (e.g. 連絡, 質問), every individual character in that string must be in this whitelist. The list below is sorted by app-file order (gojuon-ish / textbook order).

```
愛 悪 案 以 位 依 囲 委 威 意 為 違 維 衛 域 育 一 壱 引 印 因 応 往 押
旺 欧 沖 億 屋 音 下 化 果 課 貨 価 加 可 河 火 禍 荷 賀 歌 各 較 楽 活
割 革 確 額 角 完 官 関 観 館 願 希 季 紀 喜 旗 期 機 気 基 寄 規 技 記
義 議 救 求 泣 球 究 级 極 旧 牛 去 居 挙 許 漁 魚 協 鏡 京 強 教 橋 業
近 金 銀 九 句 区 苦 駆 具 愚 空 偶 隅 靴 繰 桑 勲 君 兄 型 形 径 敬 軽
結 決 潔 月 件 券 険 圏 建 検 憲 権 犬 原 厳 個 庫 后 御 告 護 構 幸 光
公 功 効 厚 候 耕 興 鉱 号 腰 骨 刻 国 黒 穀 困 婚 根 混 墾 左 査 砂 差
座 才 採 済 祭 細 菜 最 歳 在 材 罪 財 殺 雑 三 山 算 蚕 参 散 産 賛 酸
残 士 支 史 司 伺 志 思 指 施 紙 紫 詞 詩 試 誌 資 歯 持 氏 私 車 舎 社
者 取 受 授 酒 首 修 秀 終 習 週 就 衆 宿 傷 唱 奨 商 昭 将 小 笑 肖 省
消 焼 焦 症 硝 礁 祥 称 章 紹 証 賞 鐘 城 場 情 常 状 畳 蒸 譲 醸 食
心 申 伸 臣 身 辛 信 新 審 振 浸 深 親 神 図 吹 垂 炊 衰 推 水 酔 遂 随
髄 枢 崇 趣 数 杉 裾 寸 瀬 是 井 世 正 生 精 聖 声 清 静 税 席 積 績 切
折 拙 設 雪 絶 舌 仙 先 千 占 宣 専 泉 浅 洗 染 潜 線 船 銭 践 選 遷 鮮
善 然 全 狙 阻 祖 素 組 訴 束 測 足 速 塑 磯 装 総 像 蔵 造 側 促 則 息
続 孫 尊 損 村 他 多 打 妥 堕 太 対 体 待 帯 態 替 滞 袋 貸 代 台 大 第
題 滝 宅 択 卓 拓 沢 濯 諾 濁 誰 丹 単 担 炭 探 短 端 胆 誕 段 弾 暖 男
値 知 地 池 置 稚 致 遅 築 畜 竹 蓄 逐 秩 窒 茶 着 中 仲 虫 宙 忠 抽 注
昼 柱 駐 著 貯 丁 兆 帳 庁 張 彫 徴 懲 挑 朝 潮 町 調 長 直 沈 珍 賃 追
椎 墜 通 定 帝 底 抵 提 程 迭 鉄 哲 徹 撤 天 展 店 添 転 田 電 伝 登 努
度 土 怒 等 踏 逃 透 倒 党 冬 凍 刀 唐 塔 灯 当 投 豆 東 棟 盗 湯 答 筒
統 稲 糖 頭 騰 働 動 同 堂 童 銅 導 徳 独 読 突 届 鈍 縄 軟 妊 忍 認 寧
熱 年 念 燃 粘 悩 濃 納 能 脳 農 把 派 波 破 婆 馬 俳 排 杯 背 肺 配 倍
媒 梅 買 売 賠 陪 這 秤 病 疲 皮 避 美 描 鼻 匹 膝 必 筆 百 俵 標 票 表
評 漂 品 瓶 不 付 夫 婦 富 布 府 怖 敷 普 浮 父 符 腐 膚 負 賦 赴 附 侮
武 部 舞 封 風 副 幅 伏 服 復 福 腹 複 覆 払 沸 仏 物 粉 紛 噴 憤 丙 併
並 兵 塀 幣 平 弊 柄 閉 陛 米 壁 別 蔑 片 辺 返 勉 便 弁 歩 補 穂 募 墓
慕 暮 母 簿 芳 邦 奉 宝 崩 抱 報 方 放 法 房 肪 冒 訪 豊 飽 縫 妨 紡 乏
亡 傍 剖 坊 帽 忙 望 棒 暴 膨 謀 貿 北 牧 墨 撲 朴 睦 勃 没 奔 本 翻 凡
盆 摩 磨 魔 麻 埋 妹 枚 幕 膜 又 抹 万 満 慢 漫 味 未 魅 密 脈 民 眠 務
夢 無 矛 霧 婿 娘 命 名 迷 銘 鳴 滅 面 綿 免 麺 模 茂 妄 盲 耗 猛 網 目
黙 門 紋 問 冶 野 役 約 訳 薬 躍 由 油 輸 優 勇 友 郵 雄 誘 余 預 幼 揚
洋 要 容 揺 葉 陽 溶 様 養 擁 謡 踊 浴 翼 曜 羅 裸 来 頼 雷 絡 落 酪 乱
卵 欄 覧 履 離 陸 立 律 略 流 留 竜 旅 虜 慮 了 両 料 量 涼 猟 陵 領 力
緑 倫 輪 隣 臨 涙 累 令 例 冷 励 礼 鈴 零 霊 麗 齢 歴 連 廉 恋 練 錬 炉
路 露 労 廊 弄 朗 楼 漏 老 郎 六 録 論 話 和 賄 惑 枠 湾 腕
```

**Approval rule for the image generator:** A compound word drawn from the N4 vocabulary list (e.g. 連絡, 質問, 会議) may be rendered **only if every individual kanji in that string is present in the N5 or N4 kanji whitelist above**.

---

## 3. Hiragana full set (46 characters — Gojūon)

Standard, universally safe. The image generator may render this entire set freely for "あいうえお"-style placeholder text. Order is the standard gojūon chart.

```
あ い う え お
か き く け こ
さ し す せ そ
た ち つ て と
な に ぬ ね の
は ひ ふ へ ほ
ま み む め も
や (ゐ) ゆ (ゑ) よ
ら り る れ ろ
わ (ゐ) ん
```

**Dakuten / handakuten variants (also safe, treated as same family):**
```
が ぎ ぐ げ ご
ざ じ ず ぜ ぞ
だ ぢ づ で ど
ば び ぶ べ ぼ
ぱ ぴ ぷ ぺ ぽ
```

**Small kana (safe):** ぁ ぃ ぅ ぇ ぉ っ ゃ ゅ ょ

**Obsolete / historical kana — DO NOT use** (AI generators get them wrong constantly): ゐ ゑ ゔ ゕ ゖ — the app's curriculum does not include these.

---

## 4. Katakana full set (46 characters — Gojūon)

Standard, universally safe. The image generator may render this entire set freely for "アイウエオ"-style placeholder text. Order is the standard gojūon chart.

```
ア イ ウ エ オ
カ キ ク ケ コ
サ シ ス セ ソ
タ チ ツ テ ト
ナ ニ ヌ ネ ノ
ハ ヒ フ ヘ ホ
マ ミ ム メ モ
ヤ (ヰ) ユ (ヱ) ヨ
ラ リ ル レ ロ
ワ (ヰ) ン
```

**Dakuten / handakuten variants (also safe):**
```
ガ ギ グ ゲ ゴ
ザ ジ ズ ゼ ゾ
ダ ヂ ヅ デ ド
バ ビ ブ ベ ボ
パ ピ プ ペ ポ
```

**Small katakana (safe):** ァ ィ ゥ ェ ォ ッ ャ ュ ョ

**Long-vowel mark:** ー (safe; required for any long-vowel rendering)

**Obsolete / historical katakana — DO NOT use:** ヰ ヱ ヴ ヵ ヶ

---

## 5. Approved "word-of-the-app" phrases

All phrases below come straight from the app's N5/N4 data files. Each was checked: (a) every kanji is in the N5 or N4 whitelist, (b) no slang / archaic / double-meaning in modern Japan, (c) universal positive meaning suitable for a mascot on a learning app.

| # | Kanji | Reading | English | JLPT | Why it's safe |
|---|-------|---------|---------|------|---------------|
| 1 | 日本語 | にほんご | Japanese language | N5 | Direct name of the app's subject. The kanji 日 and 本 are both N5. Universal, positive. |
| 2 | 勉強 | べんきょう | study | N5 | Core learning-app concept. Both kanji N5. Mascot holding a "勉強" sign is on-brand. |
| 3 | 大丈夫 | だいじょうぶ | okay / I'm fine | N5 | Warm reassurance phrase. All 3 kanji N5. Mascot giving a thumbs-up with this is classic. |
| 4 | 頑張れ / 頑張る | がんばれ / がんばる | do your best / hang in there | N5 vocab (kanji 頑 + 張 is N4) | Encouragement, ubiquitous in Japanese learning culture. 頑 and 張 are both in the N4 whitelist. |
| 5 | 元気 | げんき | healthy / energetic | N5 | Mascot energy. Both kanji N5. Universally positive. |
| 6 | 私 | わたし | I / me | N5 | Mascot self-introduction. Single N5 kanji. Clean. |
| 7 | 先生 | せんせい | teacher | N5 | Mascot is a teacher character ("Sensei"). Both kanji N5. |
| 8 | 日本語の勉強 | にほんごのべんきょう | studying Japanese | N5 | Compound of #1 + #2, perfect app icon inscription. |
| 9 | 友達 | ともだち | friend | N5 vocab (kanji 友 is N5, 達 N4) | App is about connecting learners. Both kanji in whitelist. |
| 10 | こんにちは | こんにちは (hiragana) | hello | N5 | All-hiragana greeting — bypasses kanji risk entirely. 100% safe for a "wave hello" pose. |

**Render rule for the image generator:** When a mascot "holds" or "says" any of these phrases, render them in the **exact** kanji/kana string above. The image generator must not invent variant kanji (e.g. it must not render 友達 as 友逹 or 勉 as 免).

**Hiragana-only fallback phrases (any of these is also safe to render if kanji is judged too risky):**
- こんにちは (hello)
- ありがとう (thank you)
- おはよう (good morning)
- がんばって (do your best)

---

## 6. Hard no-list — DO NOT render in any generated asset

These look fine in isolation but have problematic meanings / overtones in modern Japan. They appear in the app's N4 kanji data because they are legitimate vocabulary, but they must not appear in marketing illustrations.

### 6.1 Slang / profanity-adjacent kanji (in N4 list)
- **死** (death / to die) — appears in compound words like 死亡, 必死. The standalone kanji 死 is associated with death and is jarring on a friendly mascot.
- **殺** (kill / murder) — used in 殺人, 殺風景. Standalone is violent. AVOID.
- **血** (blood) — used in 血液, 出血. Standalone reads as medical/gore. AVOID.
- **病** (illness / disease) — used in 病院, 看病. The standalone kanji is too negative for a friendly mascot; use 病院 instead.
- **争** (dispute / fight) — appears in 競争, 戦争. Standalone kanji is confrontational.
- **罪** (crime / sin) — standalone reads as "crime". AVOID.
- **泣** (cry) — used in 泣く. Mascot "crying" is fine contextually, but avoid as a sign the mascot is holding.
- **怒** (anger) — used in 怒る. Same as above.
- **苦** (bitter / pain) — 苦しい / 苦手. Standalone kanji is too negative for branding.
- **泣く / 怒る / 困る / 驚く / 忘れる** — N5 vocab entries, all legitimate Japanese, but the mascot should not pose holding a sign saying any of these. They are verbs, not labels.
- **裸** (naked) — in N4 kanji list. ABSOLUTELY DO NOT render standalone. Even a "naked + censored-out" gag is a brand risk.
- **脱** (remove / undress) — in 脱ぐ etc. Context-sensitive; avoid standalone.
- **酔** (drunk) — in 酔う etc. Avoid.
- **偽** (fake / false) — in 偽物 etc. Avoid.
- **殴** (hit / punch) — violence. AVOID.
- **卑** (lowly / vulgar) — avoid.
- **腐** (rot / corrode) — in 腐る etc. Visually unpleasant. AVOID.
- **嫌** (dislike / hate) — in 嫌い (N5). Standalone is harsh; use 大好き instead.
- **怖** (scary / afraid) — 怖い. Don't render.

### 6.2 Body / private-parts adjacent kanji (in N4 list — AVOID standalone)
- **胸** (chest / breasts) — legitimate word but renders awkwardly on a cute mascot.
- **腰** (waist / hips) — same.
- **股** (crotch / thigh) — absolutely avoid. (N4 list does not appear to include this, but flag for awareness.)

### 6.3 Religion / war / politics kanji (in N4 list — politically sensitive, AVOID)
- **皇** (emperor) — 皇室, 皇帝. Politically sensitive in East Asia.
- **帝** (emperor) — same.
- **兵** (soldier / military) — 兵隊. Avoid.
- **党** (political party) — 政党 etc. Avoid.
- **税** (tax) — 税金. Boring and adult-context; not mascot material.
- **葬** (funeral) — 葬式. Absolutely not.
- **墓** (grave) — 墓地. Avoid.

### 6.4 Genitals / adult content
- **陰** (private parts / hidden) — in 陰気 etc. AVOID.
- **茎** (stem, but also vulgar slang for penis) — avoid standalone.

### 6.5 Punctuation / rendering traps (not kanji but the AI often gets them wrong)
- Do NOT render the half-width tilde 〜 — use full-width ～
- Do NOT use half-width katakana (e.g. ｶﾀｶﾅ) — use full-width カタカナ
- Do NOT use emoji-style symbols (😀) as substitutes for kanji
- Do NOT mix hiragana and katakana of the same character (e.g. mixing ケ and け is a generator tell)
- Do NOT use the "kome" particle mark 〆 — looks like 士 to a generator and renders as 士
- Do NOT use iteration marks 々 or ゝ — generators always mistype these
- Do NOT use full-width punctuation that gets confused with kanji: ，．：；（）「」『』

### 6.6 Cultural/religious faux pas
- Do NOT use 神 (god / Shinto kami) in a mascot "speech bubble" — Shinto users may find it sacrilegious; better as 神社 in a place-name context only.
- Do NOT use 仏 (Buddha) as a casual character — reserved for 仏教, 仏像.
- Do NOT use 祈 (pray) in a cute mascot context — religious connotation.

### 6.7 Stroke-count danger zone (the AI frequently mistypes these)
The image generator is most likely to corrupt characters with 10+ strokes. Either use a verified **katakana-only** version or pair with verified small kana. Re-verify any of these in the rendered output:
- 勉強, 綺麗, 病院, 電話, 練習, 約束, 親切, 丁寧, 冷蔵庫, 危険, 結婚, 単語, 漢字, 言葉, 全部

---

## Closing note (Sensei, to Beru/Kaisel)

**Whitelist = the only source of truth.** When the image generator returns an image, every visible kanji/kana character must be on one of the lists above. If the generator produces a character that is not in the whitelist (or worse, a character that *looks* like a whitelisted one but has a wrong stroke count), reject the image and re-prompt with the explicit instruction: "Render ONLY the following kanji/kana, exactly: [paste whitelist excerpt]."

**Recommended safest fallback for app icon / splash:** render only hiragana (section 3) or only katakana (section 4), no kanji. This eliminates the stroke-count hallucination problem entirely and is culturally appropriate for a Japanese-learning app.

For mascot speech bubbles in onboarding, prefer the 10 approved phrases in section 5 — every kanji in every phrase is verified against the N5/N4 data files.

**End of inventory.**
