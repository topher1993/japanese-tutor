# Phase 7 Dependency Audit Decision

Date: 2026-06-18
Owner: Igris / Engineering Division

## Commands Run

```bash
npm audit --json > phase7-npm-audit.json || true
npm audit fix --dry-run
```

No dependency fix was applied.

## Audit Summary

```text
info: 0
low: 0
moderate: 10
high: 0
critical: 0
total: 10
```

## Findings

```text
@expo/cli: moderate, transitive
@expo/config: moderate, transitive
@expo/config-plugins: moderate, transitive
@expo/inline-modules: moderate, transitive
@expo/local-build-cache-provider: moderate, transitive
@expo/metro-config: moderate, transitive
@expo/prebuild-config: moderate, transitive
expo: moderate, direct
uuid: moderate, transitive
xcode: moderate, transitive
```

## Dry-Run Result

`npm audit fix --dry-run` reports the available full fix requires:

```text
npm audit fix --force
```

and would install:

```text
expo@46.0.21
```

## Decision

```text
Do not run npm audit fix --force.
```

## Reason

Installing `expo@46.0.21` would be a breaking downgrade from the current Expo 56 line and could destabilize the app. The audit has no high or critical findings, so the safer path is to track the moderate Expo/transitive issue and wait for an Expo-compatible upstream remediation.

## Follow-Up

- Keep current lockfile unless a safe Expo-compatible patch is available.
- Re-run audit during the next dependency maintenance pass.
- Escalate only if high/critical findings appear.
