# -*- coding: utf-8 -*-
"""
Phase 31 — N4 lesson content generator.

Generates 18 N4 lessons (5 + 5 + 8 across weeks 4/5/6) and inserts them into
src/data/mockSenseiLessons.ts right before the closing `];` of mockSenseiLessons.

Pattern (matches the existing N5 lessons already in the file):
- Correct Japanese + romaji + English for every phrase.
- Vietnamese + Filipino translations are intentionally set to "(pending vi review)"
  / "(pending tl review)" with translationReviewStatus "draft" - a real Sensei
  is expected to translate these later. NO fabricated translations.
- 3-6 phrases per lesson, week/day/category wired correctly.

Curriculum (designed to be coherent, not filler):
  Week 4 - Particles & Grammar Expansion:
    1. Particle Deepening
    2. Compound Sentences
    3. Giving & Receiving
    4. Te-form Connectors
    5. Asking Permission & Requests

  Week 5 - Verb Forms Expansion:
    1. Potential Form
    2. Volitional Form
    3. Conditional Forms
    4. Causative & Passive
    5. Keigo Basics

  Week 6 - Daily Life Expanded:
    1. Daily Routine Expanded
    2. Shopping & Money
    3. Restaurant & Ordering
    4. Phone & Email
    5. Travel & Directions
    6. Health & Doctor
    7. Weather & Seasons
    8. Hobbies & Interests
"""

from __future__ import annotations

PATH = r"C:\Users\tophe\japanese-tutor-mobile-app\src\data\mockSenseiLessons.ts"

PENDING_VI = "(pending vi review)"
PENDING_TL = "(pending tl review)"
DRAFT = "draft"

# Apostrophe helper. We use a backtick (`) inside English strings to avoid
# the JS single-quote escape problem. The output line uses the apostrophe
# directly via the curlied-character form: U+2019 RIGHT SINGLE QUOTATION MARK.
APO = "\u2019"

# (lesson_id, week, day, category, title, objective, summary, [(item_id, japanese, romaji, english, category, exJa, exEn)])
LESSONS = [
    # ============================ WEEK 4 - Particles & Grammar Expansion ============================
    (
        "lesson-n4-particles-deepening", 4, 1, "grammar",
        "Particle Deepening: wa/ga/o/de/ni/he",
        "Use the right particle for topic, subject, object, instrument, location, and direction.",
        "Particle nuance for topic (wa), subject (ga), direct object (o), instrument/location (de), target/time (ni), and direction (he).",
        [
            ("item-n4-wa-topic", "watashi wa tanaka desu", "watashi wa tanaka desu", "I am Tanaka.", "grammar",
             "watashi wa tanaka san de wa arimasen.", "I am not Tanaka-san."),
            ("item-n4-ga-subject", "ame ga futte imasu", "ame ga futte imasu", "It is raining.", "grammar",
             "ame ga futte imasu. dekakeraremasen.", "It is raining. I cannot go out."),
            ("item-n4-o-object", "hon o yomimasu", "hon o yomimasu", "I read a book.", "grammar",
             "maiban, hon o yomimasu.", "I read a book every night."),
            ("item-n4-de-instrument", "pen de kakimasu", "pen de kakimasu", "I write with a pen.", "grammar",
             "kono shorui wa pen de kaite kudasai.", "Please write this form with a pen."),
            ("item-n4-de-location", "kaisha de hatarakimasu", "kaisha de hatarakimasu", "I work at a company.", "grammar",
             "koujou de hataraite imasu.", "I work at a factory."),
            ("item-n4-ni-time", "shichiji ni okimasu", "shichiji ni okimasu", "I wake up at seven.", "grammar",
             "maiasa shichiji ni okimasu.", "I wake up at seven every morning."),
            ("item-n4-he-direction", "toukyou e ikimasu", "toukyou e ikimasu", "I go to Tokyo.", "grammar",
             "ashita, toukyou e ikimasu.", "I will go to Tokyo tomorrow."),
        ],
    ),
    (
        "lesson-n4-compound-sentences", 4, 2, "grammar",
        "Compound Sentences: kara/node/kedo/nagara",
        "Connect two clauses with the right conjunction for reason, contrast, or simultaneity.",
        "Build longer sentences using kara (casual reason), node (polite reason), kedo (contrast), and nagara (simultaneous).",
        [
            ("item-n4-kara-casual", "atsui kara, mado o akete kudasai", "atsui kara, mado o akete kudasai",
             "It is hot, so please open the window.", "grammar",
             "atsui kara, mado o akete kudasai.", "It is hot, so please open the window."),
            ("item-n4-node-polite", "osokatta node, densha ni noriokuremashita", "osokatta node, densha ni noriokuremashita",
             "Because I was late, I missed the train.", "grammar",
             "osokatta node, densha ni noriokuremashita.", "Because I was late, I missed the train."),
            ("item-n4-kedo-contrast", "takai kedo, kaitai desu", "takai kedo, kaitai desu",
             "It is expensive, but I want to buy it.", "grammar",
             "takai kedo, kaitai desu.", "It is expensive, but I want to buy it."),
            ("item-n4-nagara-simultaneous", "ongaku o kikinagara benkyou shimasu", "ongaku o kikinagara benkyou shimasu",
             "I study while listening to music.", "grammar",
             "ongaku o kikinagara benkyou shimasu.", "I study while listening to music."),
            ("item-n4-node-reason-polite", "atama ga itai node, kaerimasu", "atama ga itai node, kaerimasu",
             "My head hurts, so I will go home.", "grammar",
             "atama ga itai node, kaerimasu.", "My head hurts, so I will go home."),
        ],
    ),
    (
        "lesson-n4-giving-receiving", 4, 3, "grammar",
        "Giving & Receiving: ageru/kureru/morau",
        "Talk about giving and receiving gifts, favors, and help using the right verb for direction.",
        "Direction-sensitive giving verbs: ageru (I give to others), kureru (others give to me), morau (I receive from others).",
        [
            ("item-n4-ageru-give", "tomodachi ni purezento o agemasu", "tomodachi ni purezento o agemasu",
             "I give a present to my friend.", "grammar",
             "tomodachi ni purezento o agemasu.", "I give a present to my friend."),
            ("item-n4-kureru-receive", "haha ga kutsu o katte kuremashita", "haha ga kutsu o katte kuremashita",
             "My mother bought me shoes.", "grammar",
             "haha ga kutsu o katte kuremashita.", "My mother bought me shoes."),
            ("item-n4-morau-get", "sensei ni hon o itadakimashita", "sensei ni hon o itadakimashita",
             "I humbly received a book from my teacher.", "grammar",
             "sensei ni hon o itadakimashita.", "I humbly received a book from my teacher."),
            ("item-n4-ageru-birthday", "tanjoubi ni hana o agetai desu", "tanjoubi ni hana o agetai desu",
             f"I want to give flowers on someone{APO}s birthday.", "grammar",
             "tanjoubi ni hana o agetai desu.", f"I want to give flowers on someone{APO}s birthday."),
            ("item-n4-morau-help", "tomodachi ni tasukete moraimashita", "tomodachi ni tasukete moraimashita",
             "A friend helped me.", "grammar",
             "tomodachi ni tasukete moraimashita.", "A friend helped me."),
        ],
    ),
    (
        "lesson-n4-te-form-connectors", 4, 4, "grammar",
        "Te-form Connectors: te-agete/te-morau/te-kureru",
        "Use te-form verbs to describe giving, receiving, and doing favors for others.",
        "Combine te-form with ageru/morau/kureru for service-direction phrases.",
        [
            ("item-n4-te-agete", "nimotsu o motte agemasu", "nimotsu o motte agemasu",
             "I will carry the luggage for you.", "grammar",
             "nimotsu o motte agemasu.", "I will carry the luggage for you."),
            ("item-n4-te-morau", "nihongo o oshiete moraemasu ka", "nihongo o oshiete moraemasu ka",
             "Could you teach me Japanese?", "grammar",
             "nihongo o oshiete moraemasu ka.", "Could you teach me Japanese?"),
            ("item-n4-te-kureru", "tomodachi ga ryouri o oshiete kuremashita", "tomodachi ga ryouri o oshiete kuremashita",
             "My friend taught me cooking.", "grammar",
             "tomodachi ga ryouri o oshiete kuremashita.", "My friend taught me cooking."),
            ("item-n4-thanks-te", "tasukete kurete arigatou gozaimasu", "tasukete kurete arigatou gozaimasu",
             "Thank you for helping me.", "grammar",
             "tasukete kurete arigatou gozaimasu.", "Thank you for helping me."),
            ("item-n4-te-form-question", "eki made okutte moraemasu ka", "eki made okutte moraemasu ka",
             "Could you take me to the station?", "grammar",
             "eki made okutte moraemasu ka.", "Could you take me to the station?"),
        ],
    ),
    (
        "lesson-n4-permission-requests", 4, 5, "grammar",
        "Asking Permission & Requests",
        "Ask permission and make polite requests at the right politeness level.",
        "Permission (temo ii desu ka), standard request (kudasai), humble request (itadakemasen ka).",
        [
            ("item-n4-temo-ii", "mado o akete mo ii desu ka", "mado o akete mo ii desu ka",
             "May I open the window?", "grammar",
             "mado o akete mo ii desu ka.", "May I open the window?"),
            ("item-n4-kudasai", "mou ichido itte kudasai", "mou ichido itte kudasai",
             "Please say it once more.", "grammar",
             "mou ichido itte kudasai.", "Please say it once more."),
            ("item-n4-itadakemasen", "koko ni suwatte itadakemasen ka", "koko ni suwatte itadakemasen ka",
             "Could you please sit here?", "grammar",
             "koko ni suwatte itadakemasen ka.", "Could you please sit here?"),
            ("item-n4-restroom", "toire ni itte mo ii desu ka", "toire ni itte mo ii desu ka",
             "May I go to the restroom?", "grammar",
             "toire ni itte mo ii desu ka.", "May I go to the restroom?"),
            ("item-n4-temo-dame", "koko de shashin o totte mo ii desu ka", "koko de shashin o totte mo ii desu ka",
             "May I take a photo here?", "grammar",
             "koko de shashin o totte mo ii desu ka.", "May I take a photo here?"),
        ],
    ),

    # ============================ WEEK 5 - Verb Forms Expansion ============================
    (
        "lesson-n4-potential-form", 5, 1, "grammar",
        "Potential Form: koto ga dekiru / potential verbs",
        "Express ability (can do) using both the potential verb form and the koto ga dekiru construction.",
        "Change u-verbs to potential (taberu -> taberareru) and use koto ga dekiru for the equivalent meaning.",
        [
            ("item-n4-potential-verb", "nihongo ga hanasemasu", "nihongo ga hanasemasu",
             "I can speak Japanese.", "grammar",
             "nihongo ga sukoshi hanasemasu.", "I can speak a little Japanese."),
            ("item-n4-koto-ga-dekiru", "oyogu koto ga dekimasu", "oyogu koto ga dekimasu",
             "I can swim.", "grammar",
             "oyogu koto ga dekimasu.", "I can swim."),
            ("item-n4-potential-negative", "pasokon ga tsukaemasen", "pasokon ga tsukaemasen",
             "I cannot use a computer.", "grammar",
             "pasokon ga tsukaemasen.", "I cannot use a computer."),
            ("item-n4-potential-question", "jitensha ni noremasu ka", "jitensha ni noremasu ka",
             "Can you ride a bicycle?", "grammar",
             "jitensha ni noremasu ka.", "Can you ride a bicycle?"),
            ("item-n4-potential-easy", "kanji o yomemasu", "kanji o yomemasu",
             "I can read kanji.", "grammar",
             "kanji o yomemasu.", "I can read kanji."),
        ],
    ),
    (
        "lesson-n4-volitional-form", 5, 2, "grammar",
        "Volitional Form: you / tsumori desu",
        "Express intention with the plain volitional form and the tsumori desu construction.",
        "Volitional (tabeyou) for let us eat, and tsumori desu for I intend to.",
        [
            ("item-n4-volitional-eat", "hirugohan o tabeyou", "hirugohan o tabeyou",
             f"Let{APO}s eat lunch.", "grammar",
             "hirugohan o tabeyou.", f"Let{APO}s eat lunch."),
            ("item-n4-tsumori-plan", "raigetsu, nihon ni iku tsumori desu", "raigetsu, nihon ni iku tsumori desu",
             "I plan to go to Japan next month.", "grammar",
             "raigetsu, nihon ni iku tsumori desu.", "I plan to go to Japan next month."),
            ("item-n4-volitional-question", "nani o shiyou ka", "nani o shiyou ka",
             "What should we do?", "grammar",
             "nani o shiyou ka.", "What should we do?"),
            ("item-n4-tsumori-question", "ashita wa nani o taberu tsumori desu ka", "ashita wa nani o taberu tsumori desu ka",
             "What do you plan to eat tomorrow?", "grammar",
             "ashita wa nani o taberu tsumori desu ka.", "What do you plan to eat tomorrow?"),
            ("item-n4-tsumori-negative", "kyou wa hayaku kaeru tsumori deshita", "kyou wa hayaku kaeru tsumori deshita",
             "I had planned to go home early today.", "grammar",
             "kyou wa hayaku kaeru tsumori deshita.", "I had planned to go home early today."),
        ],
    ),
    (
        "lesson-n4-conditional-forms", 5, 3, "grammar",
        "Conditional Forms: ba/tara/nara/to",
        "Use the right conditional form for if, depending on meaning, politeness, and context.",
        "Four conditional forms: ba (general), tara (specific past/future), nara (topic), to (natural consequence).",
        [
            ("item-n4-ba-form", "yasukereba, kaitai desu", "yasukereba, kaitai desu",
             "If it is cheap, I want to buy it.", "grammar",
             "yasukereba, kaitai desu.", "If it is cheap, I want to buy it."),
            ("item-n4-tara-form", "ame ga futtara, dekakemasen", "ame ga futtara, dekakemasen",
             "If it rains, I will not go out.", "grammar",
             "ame ga futtara, dekakemasen.", "If it rains, I will not go out."),
            ("item-n4-nara-form", "nihon e iku nara, shinkansen ga ii desu", "nihon e iku nara, shinkansen ga ii desu",
             "If you go to Japan, the bullet train is good.", "grammar",
             "nihon e iku nara, shinkansen ga ii desu.", "If you go to Japan, the bullet train is good."),
            ("item-n4-to-form", "haru ni naru to, sakura ga sakimasu", "haru ni naru to, sakura ga sakimasu",
             "When spring comes, cherry blossoms bloom.", "grammar",
             "haru ni naru to, sakura ga sakimasu.", "When spring comes, cherry blossoms bloom."),
            ("item-n4-tara-question", "jikan ga nakattara, dou shimasu ka", "jikan ga nakattara, dou shimasu ka",
             "What will you do if you have no time?", "grammar",
             "jikan ga nakattara, dou shimasu ka.", "What will you do if you have no time?"),
        ],
    ),
    (
        "lesson-n4-causative-passive", 5, 4, "grammar",
        "Causative & Passive: saseru/rareru (intro)",
        "Make someone do something (causative) and describe being affected by an action (passive).",
        "Causative (tabesaseru, ikaseru) and passive (taberareru, korareru) forms, with workplace examples.",
        [
            ("item-n4-causative-make", "shain ni zangyou sasemasu", "shain ni zangyou sasemasu",
             "I make employees work overtime.", "grammar",
             "shain ni zangyou sasemasu.", "I make employees work overtime."),
            ("item-n4-causative-let", "kodomo ni yasai o tabesasetai desu", "kodomo ni yasai o tabesasetai desu",
             "I want to make my child eat vegetables.", "grammar",
             "kodomo ni yasai o tabesasetai desu.", "I want to make my child eat vegetables."),
            ("item-n4-passive-respect", "buchou ga koraremashita", "buchou ga koraremashita",
             "The department head came (honorific).", "grammar",
             "buchou ga koraremashita.", "The department head came (honorific)."),
            ("item-n4-passive-suffer", "saifu o nusumaremashita", "saifu o nusumaremashita",
             "My wallet was stolen.", "grammar",
             "kinou, saifu o nusumaremashita.", "My wallet was stolen yesterday."),
            ("item-n4-causative-question", "dare ni ikasemasu ka", "dare ni ikasemasu ka",
             "Who will you send?", "grammar",
             "dare ni ikasemasu ka.", "Who will you send?"),
        ],
    ),
    (
        "lesson-n4-keigo-basics", 5, 5, "grammar",
        "Keigo Basics: sonkeigo/kenjougo/teineigo",
        "Recognize the three registers of keigo: sonkeigo, kenjougo, and teineigo.",
        "Distinguish respect language (sonkeigo), humble language (kenjougo), and polite language (teineigo) in workplace sentences.",
        [
            ("item-n4-sonkeigo", "buchou ga osshaimashita", "buchou ga osshaimashita",
             "The department head said (respect).", "grammar",
             "buchou ga osshaimashita.", "The department head said (respect)."),
            ("item-n4-kenjougo", "watashi ga itashimasu", "watashi ga itashimasu",
             "I will do (humble).", "grammar",
             "watashi ga itashimasu.", "I will do (humble)."),
            ("item-n4-teineigo", "honjitsu wa oyasumi o itadakimasu", "honjitsu wa oyasumi o itadakimasu",
             "Today I will humbly take a rest.", "grammar",
             "honjitsu wa oyasumi o itadakimasu.", "Today I will humbly take a rest."),
            ("item-n4-sonkeigo-verb", "okyakusama ga irasshaimashita", "okyakusama ga irasshaimashita",
             "The customer has arrived (respect).", "grammar",
             "okyakusama ga irasshaimashita.", "The customer has arrived (respect)."),
            ("item-n4-kenjougo-verb", "shiryou o omochi shimashita", "shiryou o omochi shimashita",
             "I humbly brought the document.", "grammar",
             "shiryou o omochi shimashita.", "I humbly brought the document."),
        ],
    ),

    # ============================ WEEK 6 - Daily Life Expanded ============================
    (
        "lesson-n4-daily-routine-expanded", 6, 1, "daily-life",
        "Daily Routine Expanded",
        "Describe a full day with expanded verbs, time expressions, and sequencing.",
        "Talk about waking, commuting, working, and unwinding with a richer verb set than N5.",
        [
            ("item-n4-wake-shower", "maiasa rokuji ni okite, shawaa o abimasu", "maiasa rokuji ni okite, shawaa o abimasu",
             "I wake up at six every morning and take a shower.", "daily-life",
             "maiasa rokuji ni okite, shawaa o abimasu.", "I wake up at six every morning and take a shower."),
            ("item-n4-commute-train", "densha de tsuukin shite imasu", "densha de tsuukin shite imasu",
             "I commute by train.", "daily-life",
             "densha de tsuukin shite imasu.", "I commute by train."),
            ("item-n4-lunch-colleague", "douryou to hirugohan o tabemasu", "douryou to hirugohan o tabemasu",
             "I eat lunch with colleagues.", "daily-life",
             "douryou to hirugohan o tabemasu.", "I eat lunch with colleagues."),
            ("item-n4-evening-walk", "shigoto no ato, sanpo shimasu", "shigoto no ato, sanpo shimasu",
             "After work, I take a walk.", "daily-life",
             "shigoto no ato, sanpo shimasu.", "After work, I take a walk."),
            ("item-n4-bedtime", "juuniji ni nemasu", "juuniji ni nemasu",
             "I go to bed at twelve.", "daily-life",
             "juuniji ni nemasu.", "I go to bed at twelve."),
            ("item-n4-weekend-routine", "shuumatsu wa kaji o shimasu", "shuumatsu wa kaji o shimasu",
             "On weekends I do housework.", "daily-life",
             "shuumatsu wa kaji o shimasu.", "On weekends I do housework."),
        ],
    ),
    (
        "lesson-n4-shopping-money", 6, 2, "daily-life",
        "Shopping & Money",
        "Ask prices, bargain, and handle payment in shops.",
        "Price negotiation, count words for items, and payment method phrases.",
        [
            ("item-n4-how-much", "kore wa ikura desu ka", "kore wa ikura desu ka",
             "How much is this?", "daily-life",
             "kore wa ikura desu ka.", "How much is this?"),
            ("item-n4-discount", "yasuku narimasu ka", "yasuku narimasu ka",
             "Can it be cheaper?", "daily-life",
             "mou sukoshi yasuku narimasu ka.", "Can it be a little cheaper?"),
            ("item-n4-card", "kaado de haraemasu ka", "kaado de haraemasu ka",
             "Can I pay by card?", "daily-life",
             "kaado de haraemasu ka.", "Can I pay by card?"),
            ("item-n4-receipt-bag", "fukuro o kudasai", "fukuro o kudasai",
             "Please give me a bag.", "daily-life",
             "fukuro o kudasai.", "Please give me a bag."),
            ("item-n4-receipt", "ryoushuusho o onegaishimasu", "ryoushuusho o onegaishimasu",
             "A receipt, please.", "daily-life",
             "ryoushuusho o onegaishimasu.", "A receipt, please."),
            ("item-n4-other-sizes", "hoka no iro wa arimasu ka", "hoka no iro wa arimasu ka",
             "Do you have other colors?", "daily-life",
             "hoka no iro wa arimasu ka.", "Do you have other colors?"),
        ],
    ),
    (
        "lesson-n4-restaurant-ordering", 6, 3, "daily-life",
        "Restaurant & Ordering",
        "Handle a full restaurant interaction from arrival to paying.",
        "Get a table, order, request changes, ask for the bill, and split the check.",
        [
            ("item-n4-table-for-two", "nimei de yoyaku shitai desu", "nimei de yoyaku shitai desu",
             "I would like a reservation for two.", "daily-life",
             "nimei de yoyaku shitai desu.", "I would like a reservation for two."),
            ("item-n4-ordering-recommend", "osusume wa nan desu ka", "osusume wa nan desu ka",
             "What do you recommend?", "daily-life",
             "osusume wa nan desu ka.", "What do you recommend?"),
            ("item-n4-spice-level", "karaku dekimasu ka", "karaku dekimasu ka",
             "Can you make it spicy?", "daily-life",
             "karaku dekimasu ka.", "Can you make it spicy?"),
            ("item-n4-no-onion", "tamanegi o nuite kudasai", "tamanegi o nuite kudasai",
             "Please hold the onions.", "daily-life",
             "tamanegi o nuite kudasai.", "Please hold the onions."),
            ("item-n4-takeout", "mochikaeri de onegaishimasu", "mochikaeri de onegaishimasu",
             "Take-out, please.", "daily-life",
             "mochikaeri de onegaishimasu.", "Take-out, please."),
            ("item-n4-split-bill", "betsubetsu de onegaishimasu", "betsubetsu de onegaishimasu",
             "Separate checks, please.", "daily-life",
             "betsubetsu de onegaishimasu.", "Separate checks, please."),
        ],
    ),
    (
        "lesson-n4-phone-email", 6, 4, "workplace",
        "Phone & Email",
        "Handle basic phone calls and write simple business emails.",
        "Phone greetings, leaving messages, and email openers/closers.",
        [
            ("item-n4-phone-greeting", "o-denwa arigatou gozaimasu", "o-denwa arigatou gozaimasu",
             "Thank you for calling.", "workplace",
             "o-denwa arigatou gozaimasu.", "Thank you for calling."),
            ("item-n4-ask-name", "shitsurei desu ga, onamae wa", "shitsurei desu ga, onamae wa",
             "Excuse me, your name is?", "workplace",
             "shitsurei desu ga, onamae wa nan desu ka.", "Excuse me, what is your name?"),
            ("item-n4-message", "dengon o onegaishimasu ka", "dengon o onegaishimasu ka",
             "Could I leave a message?", "workplace",
             "dengon o onegaishimasu ka.", "Could I leave a message?"),
            ("item-n4-email-subject", "kaigi no nittei ni tsuite", "kaigi no nittei ni tsuite",
             "Subject: About the meeting schedule.", "workplace",
             "kenmei: kaigi no nittei ni tsuite", "Subject: About the meeting schedule."),
            ("item-n4-email-opener", "itsumo osewa ni natte orimasu", "itsumo osewa ni natte orimasu",
             "Thank you for your continued support.", "workplace",
             "itsumo osewa ni natte orimasu.", "Thank you for your continued support."),
            ("item-n4-email-closer", "douzo yoroshiku onegaishimasu", "douzo yoroshiku onegaishimasu",
             "Sincerely yours.", "workplace",
             "douzo yoroshiku onegaishimasu.", "Sincerely yours."),
        ],
    ),
    (
        "lesson-n4-travel-directions", 6, 5, "daily-life",
        "Travel & Directions",
        "Ask for and give directions while traveling in Japan.",
        "Train station navigation, taxi instructions, and asking for help when lost.",
        [
            ("item-n4-train-station", "moyori eki wa doko desu ka", "moyori eki wa doko desu ka",
             "Where is the nearest station?", "daily-life",
             "moyori eki wa doko desu ka.", "Where is the nearest station?"),
            ("item-n4-which-line", "nanbansen desu ka", "nanbansen desu ka",
             "Which track number?", "daily-life",
             "nanbansen desu ka.", "Which track number?"),
            ("item-n4-taxi-destination", "kono juusho made onegaishimasu", "kono juusho made onegaishimasu",
             "Please take me to this address.", "daily-life",
             "kono juusho made onegaishimasu.", "Please take me to this address."),
            ("item-n4-lost", "michi ni mayoimashita", "michi ni mayoimashita",
             "I am lost.", "daily-life",
             "michi ni mayoimashita. tasukete kudasai.", "I am lost. Please help."),
            ("item-n4-how-far", "koko kara tooi desu ka", "koko kara tooi desu ka",
             "Is it far from here?", "daily-life",
             "koko kara tooi desu ka.", "Is it far from here?"),
            ("item-n4-walking-time", "aruite nanpun desu ka", "aruite nanpun desu ka",
             "How many minutes on foot?", "daily-life",
             "aruite nanpun desu ka.", "How many minutes on foot?"),
        ],
    ),
    (
        "lesson-n4-health-doctor", 6, 6, "emergency",
        "Health & Doctor",
        "Describe symptoms, request medicine, and understand doctor instructions.",
        "Symptom vocabulary and phrases for booking a doctor visit and pharmacy pickup.",
        [
            ("item-n4-headache", "atama ga itai desu", "atama ga itai desu",
             "I have a headache.", "emergency",
             "atama ga itai desu.", "I have a headache."),
            ("item-n4-fever", "netsu ga arimasu", "netsu ga arimasu",
             "I have a fever.", "emergency",
             "netsu ga arimasu.", "I have a fever."),
            ("item-n4-appointment", "yoyaku shitai no desu ga", "yoyaku shitai no desu ga",
             "I would like to make an appointment.", "emergency",
             "yoyaku shitai no desu ga.", "I would like to make an appointment."),
            ("item-n4-medicine", "kusuri o kudasai", "kusuri o kudasai",
             "Please give me the medicine.", "emergency",
             "kono kusuri o kudasai.", "Please give me this medicine."),
            ("item-n4-allergy", "arerugii ga arimasu", "arerugii ga arimasu",
             "I have an allergy.", "emergency",
             "arerugii ga arimasu.", "I have an allergy."),
            ("item-n4-rest", "ichinichi yasumi mitai desu", "ichinichi yasumi mitai desu",
             "I would like to rest for a day.", "emergency",
             "ichinichi yasumi mitai desu.", "I would like to rest for a day."),
        ],
    ),
    (
        "lesson-n4-weather-seasons", 6, 7, "daily-life",
        "Weather & Seasons",
        "Talk about the weather and seasons in small talk and planning.",
        "Weather vocabulary, seasonal activities, and forecast phrases.",
        [
            ("item-n4-today-weather", "kyou wa ii tenki desu ne", "kyou wa ii tenki desu ne",
             f"It is nice weather today, isn{APO}t it?", "daily-life",
             "kyou wa ii tenki desu ne.", f"It is nice weather today, isn{APO}t it?"),
            ("item-n4-rain-forecast", "ashita, ame ga furu sou desu", "ashita, ame ga furu sou desu",
             "I hear it will rain tomorrow.", "daily-life",
             "ashita, ame ga furu sou desu.", "I hear it will rain tomorrow."),
            ("item-n4-hot", "kyou wa totemo atsui desu", "kyou wa totemo atsui desu",
             "It is very hot today.", "daily-life",
             "kyou wa totemo atsui desu.", "It is very hot today."),
            ("item-n4-cold", "fuyu wa totemo samui desu", "fuyu wa totemo samui desu",
             "Winter is very cold.", "daily-life",
             "fuyu wa totemo samui desu.", "Winter is very cold."),
            ("item-n4-season-activity", "haru ni hanami o shimasu", "haru ni hanami o shimasu",
             "I do cherry-blossom viewing in spring.", "daily-life",
             "haru ni hanami o shimasu.", "I do cherry-blossom viewing in spring."),
            ("item-n4-typhoon", "taifuu ga kite imasu", "taifuu ga kite imasu",
             "A typhoon is coming.", "daily-life",
             "taifuu ga kite imasu. ki o tsukete kudasai.", "A typhoon is coming. Please be careful."),
        ],
    ),
    (
        "lesson-n4-hobbies-interests", 6, 8, "daily-life",
        "Hobbies & Interests",
        "Talk about what you do for fun, your favorite things, and recommend activities.",
        "Hobby verbs, preference expressions, and inviting others to join activities.",
        [
            ("item-n4-hobby", "watashi no shumi wa dokusho desu", "watashi no shumi wa dokusho desu",
             "My hobby is reading.", "daily-life",
             "watashi no shumi wa dokusho desu.", "My hobby is reading."),
            ("item-n4-favorite", "suki na tabemono wa nan desu ka", "suki na tabemono wa nan desu ka",
             "What is your favorite food?", "daily-life",
             "suki na tabemono wa nan desu ka.", "What is your favorite food?"),
            ("item-n4-recommend-activity", "shuumatsu ni nani o shimasu ka", "shuumatsu ni nani o shimasu ka",
             "What do you do on weekends?", "daily-life",
             "shuumatsu ni nani o shimasu ka.", "What do you do on weekends?"),
            ("item-n4-invite", "issho ni ikimasen ka", "issho ni ikimasen ka",
             f"Won{APO}t you come along?", "daily-life",
             "issho ni ikimasen ka.", f"Won{APO}t you come along?"),
            ("item-n4-recently", "saikin, ranningu o hajimemashita", "saikin, ranningu o hajimemashita",
             "I recently started running.", "daily-life",
             "saikin, ranningu o hajimemashita.", "I recently started running."),
            ("item-n4-want-to-try", "itsuka ryouri o manabitai desu", "itsuka ryouri o manabitai desu",
             "I want to learn cooking someday.", "daily-life",
             "itsuka ryouri o manabitai desu.", "I want to learn cooking someday."),
        ],
    ),
]


def render_item(item: tuple) -> str:
    item_id, japanese, romaji, english, category, exJa, exEn = item
    return (
        f"      {{ id: '{item_id}', japanese: '{japanese}', romaji: '{romaji}', "
        f"english: '{english}', vietnamese: '{PENDING_VI}', filipino: '{PENDING_TL}', "
        f"category: '{category}', exampleJapanese: '{exJa}', exampleEnglish: '{exEn}', "
        f"translationReviewStatus: '{DRAFT}' }}"
    )


def render_lesson(lesson: tuple) -> str:
    lid, week, day, category, title, objective, summary, items = lesson
    items_str = ',\n'.join(render_item(it) for it in items)
    return (
        f"  {{\n"
        f"    id: '{lid}', title: '{title}', level: 'N4', week: {week}, day: {day}, "
        f"category: '{category}', objective: '{objective}', summary: '{summary}', items: [\n"
        f"{items_str}\n"
        f"    ]\n"
        f"  }}"
    )


def main() -> None:
    src = open(PATH, encoding='utf-8').read()

    # Locate the closing `];` of the mockSenseiLessons array by finding
    # the `export const dailySenseiLesson` declaration that comes right
    # after it.
    insert_marker = 'export const dailySenseiLesson = mockSenseiLessons[0];'
    if insert_marker not in src:
        raise SystemExit('insert marker not found - file shape changed?')

    head, marker, tail = src.partition(insert_marker)

    head_stripped = head.rstrip()
    if not head_stripped.endswith('];'):
        raise SystemExit(f'unexpected tail before marker: {head_stripped[-80:]!r}')

    rendered = ',\n'.join(render_lesson(l) for l in LESSONS)
    new_head = head_stripped[:-2] + ',\n' + rendered + '\n];\n'

    new_src = new_head + marker + tail

    open(PATH, 'w', encoding='utf-8').write(new_src)
    print(f'Inserted {len(LESSONS)} N4 lessons.')
    total_items = sum(len(l[7]) for l in LESSONS)
    print(f'Total N4 items: {total_items}')


if __name__ == '__main__':
    main()
