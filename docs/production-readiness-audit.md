# Production readiness audit — Japanese Tutor

Audit date: 2026-07-14. Scope: Expo/React Native app, native Android project, local persistence, learning logic, content adapters, analytics, tests, scripts, configuration, documentation, and generated/build surfaces.

## Verdict

The source tree is a technically green release candidate: strict TypeScript, all 1,067 tests, web and Android bundling, custom Android Java compilation, and a full four-ABI debug APK assembly pass. It is not yet a public-store release because production signing, physical-device foreground-audio QA, and iOS/Xcode verification are external release gates.

The app is local-first. It has no authentication, payments, production backend, cloud sync, file-upload pipeline, or AI API integration; those threat surfaces are not present rather than unreviewed.

## Material repairs in this pass

- Serialized progress mutations and reset so delayed writes cannot resurrect cleared progress.
- Fixed native/in-memory reset parity and SRS startup/read ordering.
- Made placement-aware activity use the learner's active curriculum week.
- Scoped mastery prerequisites to the prior week's actual content instead of unrelated global evidence.
- Made Daily Rush completion persistence truthful and retryable; XP is never claimed before the profile write succeeds.
- Requeued Daily Rush misses so the per-card session cap can actually fire.
- Counted both positive and “Not yet” flashcard actions as reviews and made rating feedback visible before advancing.
- Corrected quiz history attribution when mode/source selectors change after completion.
- Fixed catch-up scheduling so ordinary future-due cards are not mislabeled.
- Isolated analytics failures, made flushing idempotent, scrubbed development output, identified PostHog installs, and covered programmatic tab changes.
- Fixed Android foreground-audio rejection/state handling, notification permission and Stop action, TTS failure behavior, and service restart intent.
- Excluded 300 disconnected sentence candidates with insufficient per-row provenance from every learner-visible pool.
- Corrected duplicate quiz choices, N3 labeling, Japanese romanization/import verification, source URLs, and accessible source links.
- Replaced stale storage/release claims in active documentation and separated current guidance from historical beta material.

## Final automated evidence

| Check | Result |
|---|---|
| `npm run validate:v11` | Pass — 146 test files, 1,067 tests; strict TypeScript included |
| `npm ls --depth=0` | Pass — direct dependency tree clean |
| `npx expo install --check` | Pass — Expo dependencies aligned |
| Web export | Pass — 1,067 modules; 2.96 MB main AppEntry bundle |
| Android Expo export | Pass — 1,363 modules; 5.08 MB Hermes bundle |
| `:app:compileDebugJavaWithJavac` | Pass — 154 Gradle tasks |
| `:app:assembleDebug` | Pass — 261 Gradle tasks, all four ABIs |
| `git diff --check` | Pass (line-ending notices only) |

The final debug assembly produced a 169,122,672-byte universal development APK with SHA-256 `0490F318B4EA6C188FD7097149F81A023D17C50EEB8B5B713B3736B18017233D`. It was verification output, not a distributable release, and is removed during repository cleanup.

Expo Doctor passed all 17 enabled checks earlier in this same repair session. A final remote rerun was not allowed because it would download and execute `expo-doctor@latest` unsandboxed; local dependency alignment, exports, TypeScript, tests, and Gradle builds were rerun after the final changes.

## Content and persistence state

- 99 lessons / 369 lesson items.
- 1,630 approved candidate vocabulary cards.
- 366 authored runtime-valid quiz questions.
- 235 connected example sentences; 125 Sentence Lab eligible.
- 300 unconnected sentence candidates remain staging-only.
- Native progress/SRS/profile data use SQLite.
- Web progress/SRS/profile data use versioned `localStorage` snapshots and survive reloads.

Web persistence is supported for one active tab. Concurrent tabs can still overwrite whole snapshots last-writer-wins; multi-tab transactional consistency is deferred and must not be advertised.

## Security, dependency, and release boundaries

- Android backup is disabled and unnecessary storage/overlay permissions are absent.
- Production release signing requires external credentials; debug signing is not an implicit production fallback.
- The latest recorded production dependency audit covers 830 dependencies: 12 moderate advisories in the Expo/PostCSS/uuid chain, 0 high, and 0 critical. The planned remediation is a controlled Expo SDK 57 upgrade; do not run `npm audit fix --force`.
- EDRDG attribution and monthly refresh steps are documented. Existing starter packs retain source IDs but not their original archive hashes, so they are not described as a current dictionary mirror.
- The official EDRDG HTTPS archive endpoint could not be re-fetched from this Windows environment because its TLS certificate did not validate. Do not bypass certificate verification; retry from a trusted client/server before the next content promotion.
- Gradle reports non-blocking SDK XML-version and Gradle-9 deprecation warnings from the current Android toolchain/dependencies.

## Manual verification and remaining gates

Browser smoke in this repair session covered onboarding, primary routes, activity, responsive phone/tablet layouts, and reload persistence without console errors. Android emulator smoke earlier in the session reached the core learning flows. The final native source subsequently passed Java compilation and complete APK assembly.

Before public distribution:

1. Verify TTS pronunciation, notification controls, process backgrounding, and the Stop action on at least one physical Android 13+ device.
2. Build and smoke-test iOS with Xcode on macOS.
3. Configure external production signing and generate an AAB/split release artifact.
4. Complete the Expo SDK 57 dependency-remediation branch.
5. Re-run Expo Doctor from an approved trusted environment and record its version.

## Repository hygiene

Native Android source, the standard debug keystore required by the template build, current Graphify outputs, tests, and source assets are intentional project files. Exports, Gradle/CMake intermediates, ignored dated graph snapshots, volatile graph cache, stale beta APKs, and temporary agent work products are generated evidence and are removed after validation.
