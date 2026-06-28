export const createTablesSql = [
  `CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, level TEXT NOT NULL, week INTEGER NOT NULL, day INTEGER, summary TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS lesson_items (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, type TEXT NOT NULL, japanese TEXT NOT NULL, romaji TEXT NOT NULL, english TEXT NOT NULL, vietnamese TEXT NOT NULL, filipino TEXT NOT NULL, notes TEXT);`,
  `CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY, category TEXT NOT NULL, japanese TEXT NOT NULL, romaji TEXT NOT NULL, english TEXT NOT NULL, vietnamese TEXT NOT NULL, filipino TEXT NOT NULL, example_japanese TEXT, example_english TEXT);`,
  `CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, lesson_id TEXT, title TEXT NOT NULL, category TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS quiz_questions (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, question TEXT NOT NULL, choice_a TEXT NOT NULL, choice_b TEXT NOT NULL, choice_c TEXT NOT NULL, choice_d TEXT NOT NULL, correct_choice TEXT NOT NULL, explanation TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS progress (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, completed INTEGER NOT NULL, completed_at TEXT, score INTEGER);`,
  `CREATE TABLE IF NOT EXISTS streaks (id TEXT PRIMARY KEY, current_streak INTEGER NOT NULL, longest_streak INTEGER NOT NULL, last_study_date TEXT);`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // Phase 22 audit fix P0-01 + P0-02: durable key/value store for onboarding
  // preference, and any future learner-level settings. Lives in SQLite so
  // the data survives cold start on React Native.
  `CREATE TABLE IF NOT EXISTS kv_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);`,
  // Phase 22 audit fix P0-03: persistent spaced-repetition scheduler state.
  // Rows are SRS cards; one row per card the learner has created.
  `CREATE TABLE IF NOT EXISTS kv_srs_cards (id TEXT PRIMARY KEY, ref_id TEXT NOT NULL, interval_days INTEGER NOT NULL, repetitions INTEGER NOT NULL, ease_factor REAL NOT NULL, due_on TEXT NOT NULL, last_reviewed_on TEXT);`,
] as const;