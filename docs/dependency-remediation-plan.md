# Japanese Tutor Mobile App — Dependency Remediation Plan

**Status:** Plan-only. No dependency fix applied.

## Current Audit Summary

```text
moderate: 10
high: 0
critical: 0
total: 10
```

## Allowed Next Actions

- Inspect the full npm audit report.
- Identify direct vs transitive vulnerable packages.
- Check Expo SDK 56 compatibility before changing versions.
- Create a controlled dependency-remediation work card.
- Run tests/typecheck/export after each dependency change.

## Forbidden Without Approval

- Do not run `npm audit fix --force`.
- Do not upgrade Expo SDK without approval.
- Do not change lockfile outside a controlled dependency pass.
- Do not deploy or publish.
- Do not touch secrets, tokens, env vars, Sensei systems, cron jobs, or automations.

## Recommended Approach

1. Read full `npm audit --json` output.
2. Identify if the vulnerabilities come from Expo-managed dependencies.
3. Prefer Expo-compatible patch upgrades.
4. If fixes require major upgrades, defer to a dedicated Phase 6.5/7 dependency pass.
5. Validate with:

```bash
npm test
npm run typecheck
npx expo export --platform web --output-dir dist-web-depcheck
```

## Approval Needed

Chris approval required before dependency changes beyond normal project-local installs.
