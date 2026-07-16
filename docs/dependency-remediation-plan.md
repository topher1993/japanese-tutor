# Dependency remediation plan

Status: current for Expo SDK 54 / app v1.1.0 (2026-07-14).

## Audit boundary

The live production-dependency audit scans 830 dependencies and reports 12
moderate advisories, with zero high or critical findings. The chain is in Expo
CLI/config/prebuild tooling (`postcss` and `uuid` through `xcode`), not in an
application HTTP server or an app-controlled rendering path. The authoritative
generated detail is `phase-22-dependency-audit.md`.

npm's supported fix is Expo 57, a semver-major SDK migration. Forcing that
upgrade into the v1.1 repair pass would also change React Native, native build
configuration, and store/runtime compatibility, so it is a separate migration
rather than a safe patch-level cleanup.

## Migration plan

1. Create a dedicated Expo 57 branch.
2. Follow Expo's SDK upgrade sequence and use `npx expo install --fix`.
3. Regenerate native projects only after diffing the committed custom Android
   audio service, signing policy, manifest, and backup/export settings.
4. Run strict TypeScript, all tests, Expo Doctor, web/Android exports, Android
   Gradle builds, and the full physical-device matrix.
5. Regenerate `phase-22-dependency-audit.md`; require zero high/critical and
   explicitly disposition any remaining moderate findings.

Do not use `npm audit fix --force` on the v1.1 branch.
