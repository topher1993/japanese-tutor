export const createTablesSql = [
  `CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, level TEXT NOT NULL, week INTEGER NOT NULL, day INTEGER, summary TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS lesson_items (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, type TEXT NOT NULL, japanese TEXT NOT NULL, romaji TEXT NOT NULL, english TEXT NOT NULL, vietnamese TEXT NOT NULL, filipino TEXT NOT NULL, notes TEXT);`,
  `CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY, category TEXT NOT NULL, japanese TEXT NOT NULL, romaji TEXT NOT NULL, english TEXT NOT NULL, vietnamese TEXT NOT NULL, filipino TEXT NOT NULL, example_japanese TEXT, example_english TEXT);`,
  `CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, lesson_id TEXT, title TEXT NOT NULL, category TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS quiz_questions (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, question TEXT NOT NULL, choice_a TEXT NOT NULL, choice_b TEXT NOT NULL, choice_c TEXT NOT NULL, choice_d TEXT NOT NULL, correct_choice TEXT NOT NULL, explanation TEXT NOT NULL);`,
  // Phase 37a: extended from v1 5-tuple to v2 8-tuple. The three new columns are
  // JSON-blob payloads for the weekly-todo gating feature (§3.3 of the proposal).
  // They default to '{}' so existing v1 progress rows upgraded via the migration
  // in sqliteLearningRepository still satisfy NOT NULL.
  `CREATE TABLE IF NOT EXISTS progress (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, completed INTEGER NOT NULL, completed_at TEXT, score INTEGER, todo_states TEXT NOT NULL DEFAULT '{}', week_todos_initialized TEXT NOT NULL DEFAULT '{}', todo_event_counts TEXT NOT NULL DEFAULT '{}', weekly_review_completions TEXT NOT NULL DEFAULT '[]');`,
  `CREATE TABLE IF NOT EXISTS streaks (id TEXT PRIMARY KEY, current_streak INTEGER NOT NULL, longest_streak INTEGER NOT NULL, last_study_date TEXT);`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // Phase 22 audit fix P0-01 + P0-02: durable key/value store for onboarding
  // preference, and any future learner-level settings. Lives in SQLite so
  // the data survives cold start on React Native.
  `CREATE TABLE IF NOT EXISTS kv_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);`,
  // Phase 22 audit fix P0-03: persistent spaced-repetition scheduler state.
  // Rows are SRS cards; one row per card the learner has created.
  //
  // Phase 51: 8th column `stage` for the interactional card-stages state
  // machine (seen → recognized → memorized). DEFAULT 'memorized' so
  // existing v1 rows upgraded via the migration in
  // sqliteLearningRepository satisfy NOT NULL and behave as 'memorized'
  // on first read (Beru Q5 Mod 2: don't dump the existing deck into
  // Daily Rush on upgrade day).
  `CREATE TABLE IF NOT EXISTS kv_srs_cards (id TEXT PRIMARY KEY, ref_id TEXT NOT NULL, interval_days INTEGER NOT NULL, repetitions INTEGER NOT NULL, ease_factor REAL NOT NULL, due_on TEXT NOT NULL, last_reviewed_on TEXT, stage TEXT NOT NULL DEFAULT 'memorized');`,
  // Phase 28 user-profile foundation: single-row JSON payload store.
  // v1 keeps schemaVersion inside the JSON payload; future migrations can read
  // and rewrite this row without inventing a separate app-wide migration table.
  `CREATE TABLE IF NOT EXISTS user_profile (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);`,
  // Phase 37a (P1-2 fix): single-row schema-meta table that records the on-disk
  // schema version. Picked over stuffing the version inside `user_profile` so
  // every table can participate in migrations independently. The `key` column is
  // TEXT PRIMARY KEY; today's only key is `progress` mapping to the integer
  // version of the `progress` table layout.
  `CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
] as const;

// Phase 37a: bumped from 1 (legacy 5-tuple progress) to 2 (8-tuple with todo
// JSON blobs). The P1-2 fix from the work card notes that this constant did not
// exist before — it is invented here, not "bumped". The repo reads it via
// sqliteLearningRepository's migration logic and writes the corresponding row
// into `schema_meta` on first run.
//
// Phase 46: bumped from 2 (8-tuple with todo blobs) to 3 (9-tuple: adds
// `weekly_review_completions` JSON column for the JLPT N3 weekly-review
// 4-week-streak badge). Old saves without the column continue to load — the
// repo migration adds the column with `DEFAULT '[]'` and the deserializer
// falls back to `[]` when the value is missing.
export const CURRENT_SCHEMA_VERSION = 3;